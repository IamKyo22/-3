import { ChannelType } from 'discord.js';
import { discordImages } from './openai-provider.mjs';

const mentions = { parse: [], repliedUser: false };
export function splitReply(text, size = 1850) {
  const parts = []; let remaining = text.slice(0,5400);
  while (remaining.length) {
    let end = Math.min(size, remaining.length);
    if (end < remaining.length) {
      const newline = remaining.lastIndexOf('\n',end);
      if (newline > size / 2) end = newline;
      if (/[\uD800-\uDBFF]/.test(remaining[end-1])) end--;
    }
    parts.push(remaining.slice(0,end)); remaining = remaining.slice(end).trimStart();
  }
  if (text.length > 5400) parts[parts.length-1] += '\n[Resposta longa: peça para continuar.]';
  return parts;
}
export class AutoDM {
  constructor(client, assistant, options = {}) {
    this.client = client; this.ai = assistant; this.pending = new Map(); this.running = new Set();
    this.delay = options.delay ?? 1500; this.started = Date.now(); this.closed = false;
    this.fetcher = options.fetcher;
  }
  eligible(channelId, userId) {
    const d = this.ai.store.data, s = d.settings;
    return !this.closed && this.ai.configured && s.autoDM &&
      (s.dmPolicy === 'all' || s.allowedUsers.includes(userId)) &&
      !s.pausedChannels.includes(channelId) && !d.optedOut.includes(userId) &&
      !d.takeovers.some(t => t.channelId === channelId && t.until > Date.now());
  }
  takeover(channelId) {
    this.ai.store.change(d => {
      d.takeovers = d.takeovers.filter(t => t.channelId !== channelId && t.until > Date.now());
      d.takeovers.push({ channelId, until: Date.now() + 10 * 60000 });
    });
    this.pause(channelId);
    this.ai.emit({ type: 'assistant_status' });
  }
  pause(channelId) {
    const pending = this.pending.get(channelId); if (pending) clearTimeout(pending.timer);
    this.pending.delete(channelId);
    for (const t of this.ai.store.data.threads) if (t.channelId === channelId && t.scope.startsWith('dm:')) this.ai.cancel(t.id);
  }
  async handle(m) {
    if (this.closed || m.channel?.type !== ChannelType.DM || m.author?.bot || m.webhookId || !m.author?.id || m.createdTimestamp < this.started - 5000) return;
    const store = this.ai.store, userId = m.author.id, channelId = m.channel.id;
    const command = m.content.trim().toLowerCase();
    if (['/pausar-ia', '/retomar-ia'].includes(command)) {
      if (!store.data.settings.autoDM && !store.data.optedOut.includes(userId)) return;
      if (store.data.seen.includes(m.id)) return;
      store.change(d => {
        d.seen.push(m.id); d.seen = d.seen.slice(-2000);
        d.optedOut = d.optedOut.filter(id => id !== userId);
        if (command === '/pausar-ia') d.optedOut.push(userId);
      });
      this.pause(channelId);
      await m.channel.send({ content: command === '/pausar-ia' ? '✦ IA pausada nesta DM. Use /retomar-ia para permitir novamente.' : '✦ Preferência atualizada. A IA só responde se o operador tiver habilitado esta DM.', allowedMentions: mentions });
      return;
    }
    if (!this.eligible(channelId,userId) || store.data.seen.includes(m.id)) return;
    if (!m.content.trim() && !m.attachments.size) return;
    if (!this.pending.has(channelId) && this.pending.size >= 30) return;
    let pending = this.pending.get(channelId);
    if (!pending) this.pending.set(channelId,pending = { messages: [], timer: null });
    if (pending.messages.length >= 8) return;
    store.change(d => { d.seen.push(m.id); d.seen = d.seen.slice(-2000); });
    pending.messages.push(m); clearTimeout(pending.timer);
    pending.timer = setTimeout(() => this.flush(channelId), this.delay); pending.timer.unref();
  }
  async flush(channelId) {
    const pending = this.pending.get(channelId);
    if (!pending || this.closed) return;
    if (this.running.has(channelId) || this.ai.jobs.size >= 3) {
      pending.timer = setTimeout(() => this.flush(channelId), Math.max(1000,this.delay)); pending.timer.unref(); return;
    }
    this.pending.delete(channelId);
    const batch = pending.messages, latest = batch.at(-1), userId = latest.author.id;
    if (!this.eligible(channelId,userId)) return;
    this.running.add(channelId);
    let typing;
    try {
      const store = this.ai.store, scope = 'dm:' + userId;
      let thread = store.data.threads.find(t => t.scope === scope);
      if (!thread) thread = store.create(scope,'DM ' + userId,channelId);
      const allFiles = batch.flatMap(m => [...m.attachments.values()]);
      const { images, skipped } = await discordImages(allFiles, this.fetcher);
      if (!this.eligible(channelId,userId)) return;
      const text = batch.map(m => m.content).join('\n').slice(0,14500) +
        (skipped.length ? '\n[Anexos indisponíveis para análise: ' + skipped.join(', ').slice(0,500) + ']' : '');
      const accepted = this.ai.start(thread.id, scope, { text, images, requestId: 'discord-' + latest.id });
      if (accepted.duplicate) return;
      const sendTyping = () => latest.channel.sendTyping().catch(() => {});
      sendTyping(); typing = setInterval(sendTyping,8000); typing.unref();
      const answer = await this.ai.jobs.get(thread.id)?.promise;
      if (!answer || !this.eligible(channelId,userId)) return;
      const intro = '**' + store.data.settings.name.replace(/[*_~`\n]/g,'') + ' · IA**\n';
      const sources = answer.sources?.length ? '\n\nFontes: ' + answer.sources.slice(0,3).map(s=>s.url).join('\n') : '';
      const chunks = splitReply(answer.content + sources);
      for (let i=0;i<chunks.length;i++) {
        if (!this.eligible(channelId,userId)) return;
        await latest.channel.send({ content: (i === 0 ? intro : '') + chunks[i] +
          (i === chunks.length-1 ? '\n-# Resposta automática · /pausar-ia' : ''), allowedMentions: mentions });
      }
      store.log('reply', 'IA respondeu à DM em ' + chunks.length + ' mensagem(ns).',channelId);
      this.ai.emit({ type: 'assistant_status' });
    } catch (error) {
      try { this.ai.store.log('error','Não foi possível responder à DM. Confira limite, conexão e permissões.',channelId); } catch {}
    } finally { clearInterval(typing); this.running.delete(channelId); }
  }
  close() { this.closed = true; for (const id of this.pending.keys()) this.pause(id); }
}
