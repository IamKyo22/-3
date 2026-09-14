import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { deny } from './validation.mjs';

export const defaults = {
  name: 'Nova', instructions: '', timezone: 'America/Sao_Paulo',
  autoDM: false, dmPolicy: 'allowlist', allowedUsers: [], pausedChannels: [],
  webSearch: false, memoryEnabled: true, dailyLimit: 100
};
export function boundedText(value, max, empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) deny(400, 'Texto vazio ou acima do limite.');
  return value.trim();
}
export function settingsPatch(input) {
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(defaults,key)) deny(400, 'Configuração desconhecida.');
    if (['autoDM', 'webSearch', 'memoryEnabled'].includes(key)) {
      if (typeof value !== 'boolean') deny(400, 'Configuração inválida.');
      result[key] = value;
    } else if (key === 'dailyLimit') {
      if (!Number.isInteger(value) || value < 1 || value > 1000) deny(400, 'Use de 1 a 1.000 chamadas por dia.');
      result[key] = value;
    } else if (['allowedUsers', 'pausedChannels'].includes(key)) {
      if (!Array.isArray(value) || value.length > 100 || value.some(id => typeof id !== 'string' || !/^\d{17,20}$/.test(id))) deny(400, 'Informe até 100 IDs do Discord válidos.');
      result[key] = [...new Set(value)];
    } else if (key === 'dmPolicy') {
      if (!['allowlist', 'all'].includes(value)) deny(400, 'Regra de DMs inválida.');
      result[key] = value;
    } else if (key === 'timezone') {
      try { new Intl.DateTimeFormat('pt-BR', { timeZone: boundedText(value, 80) }).format(); } catch { deny(400, 'Fuso horário inválido.'); }
      result[key] = value;
    } else result[key] = boundedText(value, key === 'name' ? 32 : 3000, key === 'instructions');
  }
  return result;
}
const fresh = () => ({ version: 1, settings: { ...defaults }, threads: [], workspaces: [], activity: [],
  usage: { date: '', calls: 0, inputTokens: 0, outputTokens: 0 }, seen: [], optedOut: [], takeovers: [] });

// One process owns this file. Atomic replacement prevents half-written histories.
// The directory must be private and on a persistent volume in production.
export class AssistantStore {
  constructor(file = null) {
    this.file = file;
    this.data = fresh();
    if (file) {
      try {
        const raw = readFileSync(file, 'utf8');
        if (raw.length > 64 * 1024 * 1024) throw new Error('size');
        const data = JSON.parse(raw);
        if (data.version !== 1 || !Array.isArray(data.threads) || !Array.isArray(data.workspaces)) throw new Error('schema');
        this.data = { ...fresh(), ...data, settings: { ...defaults, ...settingsPatch(data.settings || {}) } };
      } catch (error) { if (error.code !== 'ENOENT') throw new Error('Não foi possível abrir os dados da IA. Restaure um backup antes de iniciar.'); }
    }
  }
  change(fn) {
    const previous = structuredClone(this.data);
    try {
      const result = fn(this.data);
      const raw = JSON.stringify(this.data);
      if (Buffer.byteLength(raw) > 64 * 1024 * 1024) deny(413, 'Armazenamento da IA cheio. Exclua conversas antigas.');
      if (this.file) {
        mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
        writeFileSync(this.file + '.tmp', raw, { mode: 0o600 });
        renameSync(this.file + '.tmp', this.file);
      }
      return result;
    } catch (error) { this.data = previous; throw error; }
  }
  get(id, scope) {
    const thread = this.data.threads.find(t => t.id === id && t.scope === scope);
    if (!thread) deny(404, 'Conversa não encontrada.');
    return thread;
  }
  create(scope = 'owner', title = 'Nova conversa', channelId = null) {
    return this.change(d => {
      if (d.threads.length >= 200) deny(429, 'Limite de 200 conversas. Exclua as antigas em Configurações da IA.');
      const thread = { id: randomUUID(), scope, title: boundedText(title, 80), channelId, created: Date.now(), updated: Date.now(), messages: [] };
      d.threads.push(thread); return thread;
    });
  }
  append(id, scope, message) {
    return this.change(() => {
      const t = this.get(id, scope);
      t.messages.push({ id: randomUUID(), time: Date.now(), ...message });
      t.messages = t.messages.slice(-80); t.updated = Date.now();
      // Keep only the two most recent image-bearing messages per conversation.
      let imageTurns = 0;
      for (const m of [...t.messages].reverse()) if (m.images?.length && ++imageTurns > 2) {
        m.images = m.images.map(i => ({ name: i.name }));
      }
      if (t.title === 'Nova conversa' && message.role === 'user') t.title = (message.content || 'Análise de imagem').slice(0,65);
      return t.messages.at(-1);
    });
  }
  workspace(scope) {
    return this.data.workspaces.find(w => w.scope === scope) || { scope, notes: [], tasks: [], memories: [] };
  }
  editWorkspace(scope, kind, action, values = {}) {
    if (!['notes', 'tasks', 'memories'].includes(kind)) deny(400, 'Coleção inválida.');
    return this.change(d => {
      let w = d.workspaces.find(w => w.scope === scope);
      if (!w) {
        if (d.workspaces.length >= 200) deny(429, 'Limite de espaços atingido.');
        d.workspaces.push(w = { scope, notes: [], tasks: [], memories: [] });
      }
      if (action === 'add') {
        if (w[kind].length >= 100) deny(429, 'Limite de 100 itens atingido.');
        const text = boundedText(values.text, kind === 'notes' ? 4000 : 1000);
        let due = null;
        if (kind === 'tasks' && values.due) {
          const time = Date.parse(values.due);
          if (!Number.isFinite(time)) deny(400, 'Prazo inválido.');
          due = new Date(time).toISOString();
        }
        const item = { id: randomUUID(), text, time: Date.now(), ...(kind === 'tasks' ? { completed: false, due } : {}) };
        w[kind].push(item); return item;
      }
      const index = w[kind].findIndex(i => i.id === values.id);
      if (index < 0) deny(404, 'Item não encontrado nesta conversa.');
      if (action === 'delete') return w[kind].splice(index, 1)[0];
      if (kind === 'tasks' && action === 'complete' && typeof values.completed === 'boolean') {
        w.tasks[index].completed = values.completed; return w.tasks[index];
      }
      deny(400, 'Ação inválida.');
    });
  }
  log(kind, detail, channelId = null) {
    this.change(d => { d.activity.unshift({ id: randomUUID(), time: Date.now(), kind, detail: String(detail).slice(0,250), channelId }); d.activity = d.activity.slice(0,60); });
  }
  consume() {
    this.change(d => {
      const date = new Date().toISOString().slice(0,10);
      if (d.usage.date !== date) d.usage = { date, calls: 0, inputTokens: 0, outputTokens: 0 };
      if (d.usage.calls >= d.settings.dailyLimit) deny(429, 'Limite diário da IA atingido. Reinicia à meia-noite UTC.');
      d.usage.calls++;
    });
  }
}
