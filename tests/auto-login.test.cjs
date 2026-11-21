'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mynbot-autologin-'));
  try {
    buildSync({
      entryPoints: [path.join(__dirname, '../src/utils/chatPatternBuilder.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(dir, 'chatPatternBuilder.cjs'),
    });

    const { buildLoginPattern, testLoginPattern } = require(path.join(dir, 'chatPatternBuilder.cjs'));

    // 1. Single-line pattern with countdown number flexing
    const singleBuilt = buildLoginPattern({
      lines: ['Lütfen 30 saniye içinde /login <şifre> yazarak giriş yapın.'],
      action: 'login',
      name: 'Tek Satır Giriş',
    });
    assert.ok(singleBuilt.rule, 'single-line rule should be built');
    assert.equal(singleBuilt.rule.lineCount, 1);
    assert.equal(singleBuilt.rule.action, 'login');
    assert.equal(
      testLoginPattern(singleBuilt.rule, ['Lütfen 12 saniye içinde /login <şifre> yazarak giriş yapın.']).matched,
      true,
      'countdown number should flex cleanly'
    );
    assert.equal(
      testLoginPattern(singleBuilt.rule, ['Rastgele bir sohbet mesajı']).matched,
      false
    );

    // 2. Multi-line pattern with decorative lines and triggerText
    const multiLines = [
      '====================',
      'Sunucuya hoş geldin! Kayıt olmak için /register <şifre> <şifre> kullan.',
      '====================',
    ];
    const multiBuilt = buildLoginPattern({
      lines: multiLines,
      triggerText: '/register',
      action: 'register',
      name: 'Çok Satırlı Kayıt',
    });
    assert.ok(multiBuilt.rule, 'multi-line rule should be built');
    assert.equal(multiBuilt.rule.lineCount, 3);
    assert.equal(multiBuilt.rule.action, 'register');
    assert.equal(
      testLoginPattern(multiBuilt.rule, [
        '====================',
        'Farklı ön ek /register <şifre> <şifre> ile kayıt ol.',
        '====================',
      ]).matched,
      true,
      'multi-line decorative + triggerText should match'
    );

    // 3. Error when triggerText not present
    const missingTrigger = buildLoginPattern({
      lines: ['Merhaba sunucuya hoş geldiniz'],
      triggerText: '/login',
      action: 'login',
    });
    assert.ok(missingTrigger.error && !missingTrigger.rule);

    // 4. Worker handleAutoLogin tests (single-line, multi-line, cooldown, password masking)
    const sentMessages = [];
    const origConnected = Object.getOwnPropertyDescriptor(process, 'connected');
    const origSend = process.send;
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    process.send = msg => { sentMessages.push(msg); };

    const worker = require('../public/bot-worker.cjs');
    const username = 'LoginBot';
    const state = worker.getState(username);
    const chats = [];
    const fakeBot = { chat: msg => chats.push(msg) };

    state.plugins = {
      autoLogin: {
        enabled: true,
        password: 'Super$ecretPassword99',
        loginCommand: '/login {password}',
        registerCommand: '/register {password} {password}',
        cooldownSeconds: 5,
        patterns: [singleBuilt.rule, multiBuilt.rule],
      },
    };

    // Single-line login match
    worker.handleAutoLogin(username, fakeBot, 'Lütfen 29 saniye içinde /login <şifre> yazarak giriş yapın.');
    assert.deepEqual(chats, ['/login Super$ecretPassword99']);

    // Cooldown prevents immediate re-trigger
    worker.handleAutoLogin(username, fakeBot, 'Lütfen 28 saniye içinde /login <şifre> yazarak giriş yapın.');
    assert.equal(chats.length, 1, 'cooldown should block immediate resend');

    // Reset cooldown & test multi-line register match
    state.lastAutoLoginAt = 0;
    state.recentLoginLines = [];
    worker.handleAutoLogin(username, fakeBot, '====================');
    worker.handleAutoLogin(username, fakeBot, 'Kayıt için /register <şifre> <şifre> yaz.');
    worker.handleAutoLogin(username, fakeBot, '====================');
    assert.deepEqual(chats, [
      '/login Super$ecretPassword99',
      '/register Super$ecretPassword99 Super$ecretPassword99',
    ]);

    // Verify password is NEVER leaked in any log/IPC message
    const logs = sentMessages.filter(m => m.type === 'log').map(m => m.message);
    assert.ok(logs.length >= 2, 'should emit log messages');
    for (const log of logs) {
      assert.equal(log.includes('Super$ecretPassword99'), false, 'password must never appear in logs');
      assert.equal(log.includes('***'), true, 'masked placeholder should appear in logs');
    }

    // Cleanup resets state
    worker.cleanupPlugins(username, fakeBot);
    assert.deepEqual(state.recentLoginLines, []);
    assert.equal(state.lastAutoLoginAt, 0);

    // Restore process properties
    if (origConnected) Object.defineProperty(process, 'connected', origConnected);
    else delete process.connected;
    process.send = origSend;

    console.log('PASS: autoLogin pattern builder, worker matching, cooldown and password masking');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
