import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { Client, GatewayIntentBits as I, Partials, PermissionFlagsBits as P, ChannelType as C, Events } from 'discord.js';
import { HttpError, deny, snowflake, messageContent, attachments, profilePatch } from './lib/validation.mjs';

const textTypes = [C.GuildText, C.GuildAnnouncement, C.PublicThread, C.PrivateThread, C.AnnouncementThread, C.DM];
const allowedMentions = { parse: [], repliedUser: false };
export function createPanel(client, options = {}) {
  const password = options.password || process.env.PANEL_PASSWORD || '';
  if (password.length < 32) throw new Error('PANEL_PASSWORD precisa ter pelo menos 32 caracteres.');
  const origins = new Set(options.origins || (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim()));
  if (origins.has('*')) throw new Error('Use origens exatas em ALLOWED_ORIGINS.');
  const sessions = new Map(), limits = new Map(), streams = new Set();
  const digest = value => createHash('sha256').update(value).digest();
  const expected = digest(password);
  const staticFiles = new Map([
    ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
    ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]
  ]);
  function throttle(key, count, interval = 60000) {
    const now = Date.now(); let entry = limits.get(key);
    if (!entry || entry.end < now) {
      if (limits.size > 5000) deny(429, 'Servidor ocupado. Aguarde.');
      limits.set(key, entry = { count: 0, end: now + interval });
    }
    if (++entry.count > count) deny(429, 'Muitas solicitações. Aguarde um pouco.');
  }
  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }
  async function readBody(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) deny(415, 'Envie JSON.');
    const chunks = []; let bytes = 0;
    for await (const part of req) {
      bytes += part.length;
      if (bytes > 13 * 1024 * 1024) deny(413, 'Requisição muito grande.');
      chunks.push(part);
    }
    let parsed;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { deny(400, 'JSON inválido.'); }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') deny(400, 'Objeto JSON inválido.');
    return parsed;
  }
  const canView = ch => !ch.guild || !!ch.permissionsFor(client.user)?.has(P.ViewChannel);
  const canWrite = ch => ch.type === C.DM ||
    ((!ch.isThread() || !ch.archived) && !!ch.permissionsFor(client.user)?.has(ch.isThread() ? P.SendMessagesInThreads : P.SendMessages));
  const person = (user, member) => ({
    id: user.id, username: user.username, name: member?.displayName || user.displayName || user.username,
    avatar: member?.displayAvatarURL({ size: 128 }) || user.displayAvatarURL({ size: 128 }),
    banner: user.bannerURL({ size: 1024 }) || null, bot: !!user.bot,
    status: member?.presence?.status || 'offline',
    color: member?.displayHexColor === '#000000' ? null : member?.displayHexColor
  });
  const self = () => ({
    ...person(client.user), status: client.user.presence.status,
    activity: client.user.presence.activities[0]?.name || ''
  });
  const channelInfo = ch => ({
    id: ch.id, guildId: ch.guildId || null,
    name: ch.name || ch.recipient?.displayName || 'Mensagem direta',
    category: ch.isThread() ? 'TÓPICOS ATIVOS' : ch.parent?.name || 'CANAIS',
    topic: ch.topic || '', text: textTypes.includes(ch.type), writable: canWrite(ch)
  });
  const message = m => ({
    id: m.id, channelId: m.channelId, guildId: m.guildId || null,
    content: m.content || '', author: person(m.author, m.member), time: m.createdTimestamp,
    edited: !!m.editedTimestamp, replyId: m.reference?.messageId || null,
    files: m.attachments.map(a => ({ name: a.name, url: a.url, type: a.contentType || '' })),
    reactions: m.reactions.cache.map(r => ({
      key: r.emoji.id ? r.emoji.name + ':' + r.emoji.id : r.emoji.name,
      name: r.emoji.name, count: r.count, me: r.me
    }))
  });
  async function getGuild(id) {
    const g = client.guilds.cache.get(snowflake(id));
    if (!g) deny(404, 'O bot não está nesse servidor.');
    if (!g.members.me) await g.members.fetchMe();
    return g;
  }
  async function getChannel(id, write = false) {
    const ch = await client.channels.fetch(snowflake(id));
    if (!ch || !textTypes.includes(ch.type) || !canView(ch)) deny(403, 'O bot não pode acessar este canal de texto.');
    if (ch.guild && !ch.permissionsFor(client.user)?.has(P.ReadMessageHistory)) deny(403, 'Falta a permissão Ler histórico de mensagens.');
    if (write && !canWrite(ch)) deny(403, 'O bot não pode enviar mensagens neste canal.');
    return ch;
  }
  function broadcast(event) {
    const line = JSON.stringify(event) + '\n';
    for (const stream of streams) {
      if (!sessions.has(stream.token) || stream.expires < Date.now() || stream.res.writableLength > 1048576) {
        stream.res.end(); streams.delete(stream); continue;
      }
      if (!stream.res.write(line)) { stream.res.end(); streams.delete(stream); }
    }
  }
  const permissions = [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.SendMessagesInThreads,
    P.AttachFiles, P.EmbedLinks, P.AddReactions, P.ChangeNickname].reduce((a,b) => a | b, 0n).toString();
  const apiErrors = {
    10003: 'Este canal não existe mais.', 10008: 'Esta mensagem não existe mais.',
    50001: 'O Discord recusou o acesso.', 50013: 'O bot não tem a permissão necessária.',
    50007: 'Esta pessoa não pode receber uma mensagem do bot.',
    50035: 'O Discord rejeitou um campo. Confira o nome, a imagem ou a mensagem.'
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url, 'http://localhost'), path = url.pathname, method = req.method;
      if (method === 'GET' && staticFiles.has(path)) {
        const [file, type] = staticFiles.get(path);
        res.setHeader('Content-Type', type + '; charset=utf-8');
        res.end(await readFile(new URL(file, import.meta.url))); return;
      }
      if (path === '/health' && method === 'GET') {
        json(res, client.isReady() ? 200 : 503, { ready: client.isReady() }); return;
      }
      if (!path.startsWith('/api/')) deny(404, 'Rota não encontrada.');
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) deny(403, 'Endereço do site não autorizado em ALLOWED_ORIGINS.');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      }
      if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (path === '/api/login' && method === 'POST') {
        throttle('login:' + req.socket.remoteAddress, 8);
        const data = await readBody(req);
        if (typeof data.password !== 'string' || !timingSafeEqual(digest(data.password), expected)) deny(401, 'Senha do painel incorreta.');
        if (!client.isReady()) deny(503, 'O bot ainda não está conectado ao Discord.');
        if (sessions.size >= 100) deny(429, 'Limite de sessões atingido.');
        const token = randomBytes(32).toString('hex'), expires = Date.now() + 12 * 3600000;
        sessions.set(token, { expires });
        json(res, 200, { token }); return;
      }
      const token = req.headers.authorization?.replace(/^Bearer /, ''), session = sessions.get(token);
      if (!session || session.expires < Date.now()) deny(401, 'Entre novamente no painel.');
      if (path === '/api/logout' && method === 'POST') {
        sessions.delete(token);
        for (const stream of streams) if (stream.token === token) { stream.res.end(); streams.delete(stream); }
        json(res, 200, { ok: true }); return;
      }
      if (path === '/api/events' && method === 'GET') {
        if ([...streams].filter(s => s.token === token).length >= 4) deny(429, 'Muitas abas conectadas.');
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'X-Accel-Buffering': 'no' });
        res.flushHeaders(); res.write(JSON.stringify({ type: 'ready' }) + '\n');
        const stream = { res, token, expires: session.expires }; streams.add(stream);
        res.on('close', () => streams.delete(stream)); return;
      }
      throttle('api:' + token, 240);
      if (!client.isReady()) deny(503, 'O bot está reconectando ao Discord.');
      if (path === '/api/state' && method === 'GET') {
        json(res, 200, {
          me: self(), guilds: client.guilds.cache.map(g => ({
            id: g.id, name: g.name, icon: g.iconURL({ size: 128 }), nickname: g.members.me?.nickname || ''
          })),
          dms: client.channels.cache.filter(ch => ch.type === C.DM).map(channelInfo),
          invite: 'https://discord.com/oauth2/authorize?client_id=' + client.user.id + '&scope=bot&permissions=' + permissions
        }); return;
      }
      let route;
      if ((route = path.match(/^\/api\/guilds\/(\d+)\/channels$/)) && method === 'GET') {
        const g = await getGuild(route[1]);
        await g.channels.fetch(); await g.channels.fetchActiveThreads();
        json(res, 200, g.channels.cache.filter(ch => ch.type !== C.GuildCategory && canView(ch))
          .sort((a,b) => (a.parent?.rawPosition || 0) - (b.parent?.rawPosition || 0) || (a.rawPosition || 0) - (b.rawPosition || 0)).map(channelInfo)); return;
      }
      if ((route = path.match(/^\/api\/guilds\/(\d+)\/members$/)) && method === 'GET') {
        const g = await getGuild(route[1]), after = url.searchParams.get('after');
        const members = await g.members.list({ limit: 100, ...(after ? { after: snowflake(after) } : {}) });
        json(res, 200, { members: members.map(m => person(m.user, m)), after: members.size === 100 ? members.last().id : null }); return;
      }
      if ((route = path.match(/^\/api\/guilds\/(\d+)\/nickname$/)) && method === 'PATCH') {
        const g = await getGuild(route[1]), data = await readBody(req);
        if (typeof data.nickname !== 'string' || data.nickname.length > 32) deny(400, 'Apelido inválido.');
        await g.members.me.setNickname(data.nickname.trim() || null);
        json(res, 200, { ok: true }); return;
      }
      if (path === '/api/profile' && method === 'PATCH') {
        throttle('profile:' + token, 4);
        const patch = profilePatch(await readBody(req));
        if (Object.keys(patch).length) await client.user.edit(patch);
        await client.user.fetch(); json(res, 200, self()); broadcast({ type: 'profile', me: self() }); return;
      }
      if (path === '/api/presence' && method === 'PATCH') {
        throttle('presence:' + token, 4);
        const data = await readBody(req);
        if (!['online', 'idle', 'dnd', 'invisible'].includes(data.status) || typeof data.activity !== 'string' || data.activity.length > 128)
          deny(400, 'Status inválido.');
        client.user.setPresence({ status: data.status, activities: data.activity.trim() ? [{ name: data.activity.trim(), type: 0 }] : [] });
        json(res, 200, { ok: true }); return;
      }
      if (path === '/api/dms' && method === 'POST') {
        throttle('dm:' + token, 5);
        const data = await readBody(req), u = await client.users.fetch(snowflake(data.userId));
        json(res, 200, channelInfo(await u.createDM())); return;
      }
      if ((route = path.match(/^\/api\/users\/(\d+)$/)) && method === 'GET') {
        json(res, 200, person(await client.users.fetch(snowflake(route[1]), { force: true }))); return;
      }
      if ((route = path.match(/^\/api\/channels\/(\d+)\/typing$/)) && method === 'POST') {
        throttle('typing:' + route[1], 8);
        await (await getChannel(route[1], true)).sendTyping(); json(res, 200, { ok: true }); return;
      }
      if ((route = path.match(/^\/api\/channels\/(\d+)\/messages$/)) && ['GET','POST'].includes(method)) {
        const ch = await getChannel(route[1], method === 'POST');
        if (method === 'GET') {
          const before = url.searchParams.get('before');
          const list = await ch.messages.fetch({ limit: 50, ...(before ? { before: snowflake(before) } : {}) });
          json(res, 200, list.sort((a,b) => a.createdTimestamp - b.createdTimestamp).map(message)); return;
        }
        throttle('send:' + token, 30);
        const data = await readBody(req), files = attachments(data.files);
        const text = messageContent(data.content, files.length > 0);
        const sent = await ch.send({
          content: text || undefined, files, allowedMentions,
          ...(data.replyId ? { reply: { messageReference: snowflake(data.replyId), failIfNotExists: false } } : {})
        });
        json(res, 201, message(sent)); return;
      }
      if ((route = path.match(/^\/api\/channels\/(\d+)\/messages\/(\d+)(\/reactions)?$/))) {
        const ch = await getChannel(route[1]), msg = await ch.messages.fetch(snowflake(route[2]));
        if (route[3] && ['PUT', 'DELETE'].includes(method)) {
          const { emoji } = await readBody(req);
          if (typeof emoji !== 'string' || !emoji || emoji.length > 80 || /[\x00-\x20/\\]/.test(emoji)) deny(400, 'Emoji inválido.');
          if (method === 'PUT') await msg.react(emoji);
          else {
            const reaction = msg.reactions.cache.find(r => (r.emoji.id ? r.emoji.name + ':' + r.emoji.id : r.emoji.name) === emoji);
            if (reaction) await reaction.users.remove(client.user.id);
          }
          json(res, 200, message(await msg.fetch())); return;
        }
        if (route[3] || !['PATCH','DELETE'].includes(method)) deny(405, 'Método inválido.');
        if (msg.author.id !== client.user.id) deny(403, 'Você só pode alterar mensagens deste bot.');
        if (method === 'DELETE') { await msg.delete(); json(res, 200, { ok: true }); return; }
        const data = await readBody(req);
        json(res, 200, message(await msg.edit({ content: messageContent(data.content, msg.attachments.size > 0), allowedMentions }))); return;
      }
      deny(404, 'Rota não encontrada.');
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
      json(res, status, { error: error instanceof HttpError ? error.message : apiErrors[error.code] || 'Não foi possível concluir. Confira as permissões do bot.' });
    }
  });
  const bindings = [];
  const on = (event, fn) => { client.on(event, fn); bindings.push([event, fn]); };
  on(Events.MessageCreate, m => { if (canView(m.channel)) broadcast({ type: 'message', fresh: true, message: message(m) }); });
  on(Events.MessageUpdate, async (_, m) => {
    try { if (m.partial) m = await m.fetch(); if (canView(m.channel)) broadcast({ type: 'message', message: message(m) }); } catch {}
  });
  on(Events.MessageDelete, m => broadcast({ type: 'delete', channelId: m.channelId, id: m.id }));
  on(Events.MessageBulkDelete, list => { for (const m of list.values()) broadcast({ type: 'delete', channelId: m.channelId, id: m.id }); });
  for (const event of [Events.MessageReactionAdd, Events.MessageReactionRemove, Events.MessageReactionRemoveAll, Events.MessageReactionRemoveEmoji])
    on(event, value => broadcast({ type: 'changed', channelId: value.message?.channelId || value.channelId }));
  on(Events.TypingStart, t => { if (t.user.id !== client.user.id && canView(t.channel)) broadcast({ type: 'typing', channelId: t.channel.id, name: t.user.displayName }); });
  on(Events.PresenceUpdate, (_, p) => { if (p.member) broadcast({ type: 'member', guildId: p.guild.id, member: person(p.user, p.member) }); });
  on(Events.GuildMemberUpdate, (_, m) => broadcast({ type: 'member', guildId: m.guild.id, member: person(m.user, m) }));
  on(Events.GuildMemberRemove, m => broadcast({ type: 'memberRemoved', guildId: m.guild.id, id: m.id }));
  for (const event of [Events.GuildCreate, Events.GuildDelete, Events.ChannelCreate, Events.ChannelDelete, Events.ChannelUpdate, Events.ThreadCreate, Events.ThreadDelete, Events.ThreadUpdate])
    on(event, () => broadcast({ type: 'structure' }));
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
    for (const [key, value] of limits) if (value.end < now) limits.delete(key);
    broadcast({ type: 'heartbeat', ready: client.isReady() });
  }, 20000);
  timer.unref();
  server.on('close', () => { clearInterval(timer); for (const [event, fn] of bindings) client.off(event, fn); });
  server.closePanel = () => { for (const stream of streams) stream.res.end(); server.close(); };
  return server;
}
async function start() {
  if (!process.env.DISCORD_TOKEN) throw new Error('Configure DISCORD_TOKEN no ambiente do servidor.');
  const client = new Client({
    intents: [I.Guilds, I.GuildMessages, I.MessageContent, I.GuildMembers, I.GuildPresences,
      I.GuildMessageTyping, I.GuildMessageReactions, I.DirectMessages, I.DirectMessageReactions, I.DirectMessageTyping],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
  });
  const port = Number(process.env.PORT || 3000), panel = createPanel(client);
  client.on(Events.Error, () => console.error('Erro na conexão com o Discord.'));
  client.on(Events.ShardError, () => console.error('Erro no Gateway. Confira o token e os intents.'));
  client.once(Events.ClientReady, async () => {
    try { await client.user.fetch(); } catch {}
    console.log('Bot conectado. Painel em http://localhost:' + port);
  });
  panel.listen(port, '0.0.0.0');
  process.on('SIGTERM', () => { client.destroy(); panel.closePanel(); });
  process.on('SIGINT', () => { client.destroy(); panel.closePanel(); });
  try { await client.login(process.env.DISCORD_TOKEN); }
  catch { client.destroy(); panel.closePanel(); throw new Error('Não foi possível conectar o bot. Confira token e intents.'); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) start().catch(error => { console.error(error.message); process.exitCode = 1; });
