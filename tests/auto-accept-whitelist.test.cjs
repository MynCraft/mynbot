'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

const messages = [];
Object.defineProperty(process, 'connected', { value: true, configurable: true });
process.send = m => messages.push(m);

const worker = require(path.join(__dirname, '../public/bot-worker.cjs'));

const username = 'AcceptBot';
const state = worker.getState(username);
const sentChats = [];
const fakeBot = { chat: msg => sentChats.push(msg) };

state.plugins = {
  autoAccept: {
    enabled: true,
    onlyWhitelist: true,
    whitelist: ['ali', 'mert.1'],
    triggers: ['TPA isteği'],
    acceptCommand: '/tpaccept',
    cooldownSeconds: 0,
  },
};

// 1. Parsed sender "alice" must NOT match whitelist "ali"
state.lastAutoAcceptAt = 0;
worker.handleAutoAccept(username, fakeBot, 'alice TPA isteği gönderdi', { sender: 'alice', message: 'TPA isteği gönderdi' });
assert.equal(sentChats.length, 0, 'parsed sender "alice" must not match "ali"');

// 2. Unparsed "alice" or "kalin" must NOT match whitelist "ali"
state.lastAutoAcceptAt = 0;
worker.handleAutoAccept(username, fakeBot, 'alice TPA isteği gönderdi', null);
worker.handleAutoAccept(username, fakeBot, 'kalin TPA isteği gönderdi', null);
assert.equal(sentChats.length, 0, 'substring "alice" / "kalin" must not match "ali"');

// 3. Escaped regex special char: "mertx1" must NOT match "mert.1"
state.lastAutoAcceptAt = 0;
worker.handleAutoAccept(username, fakeBot, 'mertx1 TPA isteği gönderdi', null);
assert.equal(sentChats.length, 0, 'mertx1 must not match escaped mert.1');

// 4. Exact unparsed word-boundary "ali" MUST match
state.lastAutoAcceptAt = 0;
worker.handleAutoAccept(username, fakeBot, '[VIP] ali TPA isteği gönderdi', null);
assert.deepEqual(sentChats, ['/tpaccept']);

// 5. Exact parsed sender "ali" MUST match
state.lastAutoAcceptAt = 0;
worker.handleAutoAccept(username, fakeBot, 'TPA isteği gönderdi', { sender: 'ali', message: 'TPA isteği gönderdi' });
assert.equal(sentChats.length, 2);

console.log('PASS: autoAccept whitelist enforces exact/word-boundary matching and rejects partial matches');
