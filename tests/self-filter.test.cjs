'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');

const messages = [];
Object.defineProperty(process, 'connected', { value: true, configurable: true });
process.send = m => messages.push(m);

const worker = require(path.join(__dirname, '../public/bot-worker.cjs'));

const username = 'SelfBot';
const state = worker.getState(username);
const sentChats = [];
const fakeBot = { chat: msg => sentChats.push(msg) };

state.plugins = {
  autoChat: {
    enabled: true,
    cooldownSeconds: 0,
    joinMessage: '',
    rules: [
      { id: 'r1', trigger: 'selam', response: 'selam', scope: 'all' },
    ],
  },
};

// 1. Trigger first reply -> records "selam" in recentSentMessages
worker.handleAutoChat(username, fakeBot, 'Oyuncu1: selam', null);
assert.deepEqual(sentChats, ['selam']);

// 2. Immediate echo of exact "selam" within 5s must be ignored
state.lastAutoReplyAt = 0;
worker.handleAutoChat(username, fakeBot, 'selam', null);
assert.equal(sentChats.length, 1, 'exact recent sent message within 5s must be ignored');

// 3. Message containing "selam" as substring (not ending with "selam") must NOT be permanently blocked
state.lastAutoReplyAt = 0;
worker.handleAutoChat(username, fakeBot, 'Oyuncu2: selam arkadaşlar nasılsınız', null);
assert.equal(sentChats.length, 2, 'partial substring match must not block unrelated server messages');

// 4. After 5s, "selam" is no longer blocked by recentSentMessages
state.lastAutoReplyAt = 0;
state.recentSentMessages = state.recentSentMessages.map(item => ({ ...item, at: Date.now() - 6000 }));
worker.handleAutoChat(username, fakeBot, 'selam', null);
assert.equal(sentChats.length, 3, 'expired recentSentMessages (>5s) must allow processing again');

// 5. Word-boundary sender prefix ("SelfBot » selam") must be ignored as self-message
state.lastAutoReplyAt = 0;
worker.handleAutoChat(username, fakeBot, '[VIP] SelfBot » selam', null);
assert.equal(sentChats.length, 3, 'word-boundary rank+username » message must be ignored as self');

console.log('PASS: short-lived self-filter and word-boundary sender detection work as expected');
