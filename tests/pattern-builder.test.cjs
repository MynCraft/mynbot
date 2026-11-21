'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mynbot-patbuilder-'));
  try {
    buildSync({
      entryPoints: [path.join(__dirname, '../src/utils/chatPatternBuilder.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(dir, 'chatPatternBuilder.cjs'),
    });
    buildSync({
      entryPoints: [path.join(__dirname, '../electron/services/pluginConfig.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(dir, 'pluginConfig.cjs'),
    });
    buildSync({
      entryPoints: [path.join(__dirname, '../electron/services/botRepository.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(dir, 'botRepository.cjs'),
    });

    const { buildLoginPattern, testLoginPattern } = require(path.join(dir, 'chatPatternBuilder.cjs'));
    const { validatePluginSettings } = require(path.join(dir, 'pluginConfig.cjs'));
    const { BotRepository } = require(path.join(dir, 'botRepository.cjs'));

    // 1. Unicode decorative lines (━━━, ═══, ───) flex cleanly even with different lengths
    const unicodeBuilt = buildLoginPattern({
      lines: [
        '━━━━━━━━━━━━━━━━━━━━',
        'Sunucuya giriş yapmak için /login <şifre> yaz.',
        '════════════════════',
      ],
      action: 'login',
      name: 'Unicode Banner',
    });
    assert.ok(unicodeBuilt.rule, 'unicode banner rule should be built');
    assert.equal(
      testLoginPattern(unicodeBuilt.rule, [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[Auth] Merhaba Steve! /login <şifre>',
        '══════════════',
      ]).matched,
      true,
      'unicode decorative lines and /login line without triggerText should match flexibly'
    );

    const boxBannerBuilt = buildLoginPattern({
      lines: [
        '┌──────────────┐',
        'Lütfen /login <şifre> yazın',
        '└──────────────┘',
      ],
      action: 'login',
      name: 'Box Banner',
    });
    assert.ok(boxBannerBuilt.rule, 'box banner rule should be built');
    assert.equal(
      testLoginPattern(boxBannerBuilt.rule, [
        '┌────────────────────────┐',
        'Lütfen /login <şifre> yazın',
        '└────────────────────────┘',
      ]).matched,
      true,
      'box-drawing decorative lines (┌─┐/└─┘) must match flexibly'
    );

    // 2. Worker tolerates blank lines and intervening server announcements in multi-line login rules
    const origConnected = Object.getOwnPropertyDescriptor(process, 'connected');
    const origSend = process.send;
    Object.defineProperty(process, 'connected', { value: true, configurable: true });
    process.send = () => {};

    const worker = require('../public/bot-worker.cjs');
    const username = 'BannerBot';
    const state = worker.getState(username);
    const chats = [];
    const fakeBot = { chat: msg => chats.push(msg) };

    state.plugins = {
      autoLogin: {
        enabled: true,
        password: 'MyPassword123',
        loginCommand: '/login {password}',
        registerCommand: '/register {password} {password}',
        cooldownSeconds: 5,
        listenTitleActionbar: true,
        patterns: [unicodeBuilt.rule],
      },
    };

    worker.handleAutoLogin(username, fakeBot, '━━━━━━━━━━━━━━━━━━━━');
    worker.handleAutoLogin(username, fakeBot, '   '); // blank spacer line must be ignored
    worker.handleAutoLogin(username, fakeBot, '[Duyuru] Sunucu bakımı saat 03:00'); // intervening announcement
    worker.handleAutoLogin(username, fakeBot, 'Lütfen /login <şifre> yazın');
    worker.handleAutoLogin(username, fakeBot, '   ');
    worker.handleAutoLogin(username, fakeBot, '════════════════════');

    assert.deepEqual(chats, ['/login MyPassword123'], 'multi-line pattern must survive blank lines and intervening announcement');

    // 3. listenTitleActionbar persistence through pluginConfig & BotRepository
    const validatedDefault = validatePluginSettings({});
    assert.equal(validatedDefault.autoLogin.listenTitleActionbar, true, 'listenTitleActionbar defaults to true');
    const validatedFalse = validatePluginSettings({ autoLogin: { listenTitleActionbar: false } });
    assert.equal(validatedFalse.autoLogin.listenTitleActionbar, false, 'listenTitleActionbar=false must be preserved');

    const repoFile = path.join(dir, 'bots.json');
    const repo = new BotRepository(repoFile);
    await repo.load();
    await repo.add({
      username: 'BannerBot',
      host: '127.0.0.1',
      port: 25565,
      version: '1.21.1',
      plugins: validatedFalse,
    });
    const repo2 = new BotRepository(repoFile);
    await repo2.load();
    assert.equal(repo2.find('BannerBot')?.plugins?.autoLogin.listenTitleActionbar, false, 'listenTitleActionbar must persist to bots.json');

    worker.cleanupPlugins(username, fakeBot);
    if (origConnected) Object.defineProperty(process, 'connected', origConnected);
    else delete process.connected;
    process.send = origSend;

    console.log('PASS: unicode decorative banners, blank/intervening line tolerance, and listenTitleActionbar persistence');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
