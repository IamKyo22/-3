import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { once } from 'node:events';
import { Collection, ChannelType, PermissionFlagsBits as P } from 'discord.js';
import { messageContent, profileImage, attachments, profilePatch, snowflake } from '../lib/validation.mjs';
import { createPanel } from '../server.mjs';

test('limites das mensagens e anexos vazios', () => {
  assert.equal(messageContent('oi'), 'oi');
  assert.equal(messageContent('x'.repeat(2000)).length, 2000);
  assert.throws(() => messageContent('x'.repeat(2001)));
  assert.throws(() => messageContent('   '));
  assert.throws(() => messageContent({}));
  assert.equal(messageContent('', true), '');
});
test('perfil não aceita URLs, SVG ou campos extras', () => {
  for (const url of ['https://example.com/avatar.png', 'http://localhost:3000/.env', '/etc/passwd', 'data:image/svg+xml;base64,PHN2Zz4='])
    assert.throws(() => profileImage(url));
  assert.equal(profileImage(null), null);
  assert.throws(() => profileImage('data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')));
  assert.deepEqual(profilePatch({ username: ' Dead ', token: 'must-not-forward', arbitrary: true }), { username: 'Dead' });
  assert.throws(() => profilePatch({ username: 'x' }));
});
test('anexos têm quantidade, tamanho e nomes limitados', () => {
  assert.throws(() => attachments(new Array(4).fill({ name: 'x', data: '' })));
  assert.throws(() => attachments([{ name: 'x', data: 'invalid!' }]));
  assert.throws(() => attachments([{ name: 'x', data: Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64') }]));
  assert.equal(attachments([{ name: '../x.txt', data: 'b2k=' }])[0].name, '.._x.txt');
  assert.equal(attachments([{ name: 'ok.txt', data: 'b2k=' }])[0].attachment.toString(), 'oi');
  assert.throws(() => snowflake('../secret'));
});

function fixture() {
  const client = new EventEmitter();
  const botId = '111111111111111111', channelId = '222222222222222222', messageId = '333333333333333333';
  let sendAllowed = true, edits = 0, deletions = 0, sends = 0;
  client.isReady = () => true;
  client.user = {
    id: botId, username: 'Test bot', displayName: 'Test bot', bot: true,
    displayAvatarURL: () => '', bannerURL: () => null,
    presence: { status: 'online', activities: [] }
  };
  client.guilds = { cache: new Collection() };
  const msg = { id: messageId, author: { id: '999999999999999999' }, attachments: new Collection(),
    edit: async () => { edits++; }, delete: async () => { deletions++; } };
  const channel = {
    id: channelId, type: ChannelType.GuildText, guild: {}, guildId: '444444444444444444',
    isThread: () => false, permissionsFor: () => ({ has: permission => permission === P.SendMessages ? sendAllowed : true }),
    messages: { fetch: async () => msg }, send: async () => { sends++; throw new Error('Unexpected send'); }
  };
  client.channels = { cache: new Collection(), fetch: async () => channel };
  return { client, channelId, messageId, counts: () => ({ edits, deletions, sends }), lockSend: () => { sendAllowed = false; } };
}
test('API exige senha, controla origem, invalida logout e impede editar mensagens alheias', async t => {
  const f = fixture(), password = 'local-test-password-'.repeat(3);
  const panel = createPanel(f.client, { password, origins: ['https://allowed.example'] });
  panel.listen(0, '127.0.0.1'); await once(panel, 'listening');
  t.after(() => panel.closePanel());
  const base = 'http://127.0.0.1:' + panel.address().port;
  const request = (path, method='GET', body, token, origin='https://allowed.example') => fetch(base + path, {
    method, headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  assert.equal((await request('/api/state')).status, 401);
  assert.equal((await request('/api/login', 'POST', { password }, undefined, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/login', 'POST', { password: 'wrong' })).status, 401);
  const login = await request('/api/login', 'POST', { password });
  assert.equal(login.status, 200);
  const { token } = await login.json(); assert.match(token, /^[a-f0-9]{64}$/);
  const state = await request('/api/state', 'GET', undefined, token);
  assert.equal(state.status, 200); const data = await state.json();
  assert.equal(data.me.id, f.client.user.id); assert.equal(JSON.stringify(data).includes(password), false);
  for (const method of ['PATCH', 'DELETE']) {
    const response = await request('/api/channels/' + f.channelId + '/messages/' + f.messageId, method, method === 'PATCH' ? { content: 'blocked' } : undefined, token);
    assert.equal(response.status, 403);
  }
  f.lockSend();
  assert.equal((await request('/api/channels/' + f.channelId + '/messages', 'POST', { content: 'blocked' }, token)).status, 403);
  assert.deepEqual(f.counts(), { edits: 0, deletions: 0, sends: 0 });
  assert.equal((await request('/.env')).status, 404);
  assert.equal((await request('/server.mjs')).status, 404);
  assert.equal((await request('/api/logout', 'POST', {}, token)).status, 200);
  assert.equal((await request('/api/state', 'GET', undefined, token)).status, 401);
});
