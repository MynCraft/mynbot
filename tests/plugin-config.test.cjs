'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mynbot-plugin-config-'));
  try {
    for (const name of ['pluginConfig', 'botRepository']) buildSync({ entryPoints: [path.join(__dirname, '../electron/services', name + '.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(dir, name + '.cjs') });
    const { validatePluginSettings } = require(path.join(dir, 'pluginConfig.cjs'));
    const { BotRepository } = require(path.join(dir, 'botRepository.cjs'));
    const legacy = validatePluginSettings({ autoReconnect: { enabled: true }, enabledScripts: ['sample.cjs'] });
    for (const key of ['autoEat', 'autoArmor', 'autoFishing', 'autoLogin', 'autoTotem', 'autoPanic', 'autoDefend', 'autoLobby', 'autoAccept', 'commandScheduler', 'autoChestDump']) assert.equal(legacy[key].enabled, false);
    assert.equal(legacy.autoTotem.priorityItem, 'totem');
    assert.equal(legacy.autoTotem.healthThreshold, 12);
    assert.equal(legacy.autoPanic.action, 'disconnect');
    assert.equal(legacy.autoPanic.disableReconnect, true);
    assert.equal(legacy.autoDefend.attackIntervalMs, 650);
    assert.equal(legacy.autoLobby.clickSlot, -1);
    assert.equal(legacy.autoAccept.onlyWhitelist, true);
    assert.deepEqual(legacy.commandScheduler.tasks, []);
    assert.equal(legacy.autoChestDump.keepFoods, true);
    assert.equal(legacy.autoLogin.password, '');
    assert.equal(legacy.autoLogin.loginCommand, '/login {password}');
    assert.equal(legacy.autoLogin.registerCommand, '/register {password} {password}');
    assert.equal(legacy.autoLogin.cooldownSeconds, 5);
    assert.deepEqual(legacy.autoLogin.patterns, []);
    assert.equal(legacy.autoReconnect.enabled, true);
    assert.deepEqual(legacy.enabledScripts, ['sample.cjs']);
    const bounded = validatePluginSettings({
      autoEat: { hungerThreshold: Infinity, healthThreshold: -5, selection: 'bad' },
      autoArmor: { intervalSeconds: 999 },
      autoFishing: { recastDelaySeconds: NaN, timeoutSeconds: 0 },
      autoLogin: {
        enabled: true,
        password: 'secret',
        loginCommand: '   ',
        registerCommand: '/reg {password}',
        cooldownSeconds: 999,
        patterns: [
          { id: 'bad', action: 'login', regexLines: ['[unclosed'] },
          { id: 'ok', name: 'Giriş', action: 'register', regexLines: ['^===+$', '^.*\\/register.*$'], triggerText: '/register', sampleLines: ['===', '/register <sifre>'] },
        ],
      },
    });
    assert.equal(bounded.autoEat.hungerThreshold, 16); assert.equal(bounded.autoEat.healthThreshold, 1);
    assert.equal(bounded.autoEat.selection, 'saturation'); assert.equal(bounded.autoEat.restoreHeldItem, true);
    assert.equal(bounded.autoArmor.intervalSeconds, 120); assert.equal(bounded.autoFishing.recastDelaySeconds, 2); assert.equal(bounded.autoFishing.timeoutSeconds, 10);
    assert.equal(bounded.autoLogin.enabled, true);
    assert.equal(bounded.autoLogin.password, 'secret');
    assert.equal(bounded.autoLogin.loginCommand, '/login {password}');
    assert.equal(bounded.autoLogin.registerCommand, '/reg {password}');
    assert.equal(bounded.autoLogin.cooldownSeconds, 60);
    assert.equal(bounded.autoLogin.patterns.length, 1);
    assert.equal(bounded.autoLogin.patterns[0].id, 'ok');
    assert.equal(bounded.autoLogin.patterns[0].action, 'register');
    assert.equal(bounded.autoLogin.patterns[0].lineCount, 2);
    assert.equal(validatePluginSettings({ autoLogin: { cooldownSeconds: -5 } }).autoLogin.cooldownSeconds, 1);

    const boundedNew = validatePluginSettings({
      autoTotem: { enabled: true, priorityItem: 'shield', healthThreshold: 99, intervalSeconds: 0 },
      autoPanic: { enabled: true, healthThreshold: 99, disconnectOnPlayer: true, playerRadius: 1, whitelist: ['  Alice ', 'Alice', 'Bob', 123], action: 'command', panicCommand: '  /is go  ', disableReconnect: false },
      autoDefend: { enabled: true, radius: 99, attackIntervalMs: 50, autoEquipWeapon: false, attackCreepers: true, restoreHeldItem: false },
      autoLobby: { enabled: true, delaySeconds: 99, hotbarSlot: 99, clickSlot: 99, itemKeyword: '  Skyblock  ', postCommand: ' /warp a ' },
      autoAccept: { enabled: true, onlyWhitelist: false, whitelist: ['  Friend  '], triggers: [' tpa ', ''], acceptCommand: '  ', cooldownSeconds: 999 },
      commandScheduler: { enabled: true, tasks: [{ id: '', command: '/sell all', intervalSeconds: 1, enabled: true }, null] },
      autoChestDump: { enabled: true, freeSlotsThreshold: 99, searchRadius: 1, intervalSeconds: 999, keepFoods: false, keepToolsAndArmor: false, keepKeywords: [' diamond ', ''] },
    });
    assert.equal(boundedNew.autoTotem.priorityItem, 'shield');
    assert.equal(boundedNew.autoTotem.healthThreshold, 20);
    assert.equal(boundedNew.autoTotem.intervalSeconds, 1);
    assert.equal(boundedNew.autoPanic.healthThreshold, 19);
    assert.equal(boundedNew.autoPanic.playerRadius, 3);
    assert.deepEqual(boundedNew.autoPanic.whitelist, ['Alice', 'Bob']);
    assert.equal(boundedNew.autoPanic.panicCommand, '/is go');
    assert.equal(boundedNew.autoPanic.disableReconnect, false);
    assert.equal(boundedNew.autoDefend.radius, 6);
    assert.equal(boundedNew.autoDefend.attackIntervalMs, 300);
    assert.equal(boundedNew.autoLobby.delaySeconds, 30);
    assert.equal(boundedNew.autoLobby.hotbarSlot, 9);
    assert.equal(boundedNew.autoLobby.clickSlot, 53);
    assert.equal(boundedNew.autoLobby.itemKeyword, 'Skyblock');
    assert.equal(boundedNew.autoLobby.postCommand, '/warp a');
    assert.deepEqual(boundedNew.autoAccept.whitelist, ['Friend']);
    assert.deepEqual(boundedNew.autoAccept.triggers, ['tpa']);
    assert.equal(boundedNew.autoAccept.acceptCommand, '/tpaccept');
    assert.equal(boundedNew.autoAccept.cooldownSeconds, 60);
    assert.equal(boundedNew.commandScheduler.tasks.length, 1);
    assert.equal(boundedNew.commandScheduler.tasks[0].intervalSeconds, 5);
    assert.equal(boundedNew.autoChestDump.freeSlotsThreshold, 18);
    assert.equal(boundedNew.autoChestDump.searchRadius, 2);
    assert.equal(boundedNew.autoChestDump.intervalSeconds, 120);
    assert.deepEqual(boundedNew.autoChestDump.keepKeywords, ['diamond']);
    const file = path.join(dir, 'bots.json');
    await fs.writeFile(file, JSON.stringify([
      { username: 'ConfigTest', host: 'localhost', port: 25565, plugins: { autoChat: { enabled: true, joinMessage: 'hi' } } },
      { username: 'LegacyVer', host: 'localhost', port: 25565, version: '1.16.5' },
    ]));
    const repo = new BotRepository(file); await repo.load();
    assert.equal(repo.find('ConfigTest').version, '1.21.1');
    assert.equal(repo.find('LegacyVer').version, '1.21.1');
    assert.throws(() => repo.add({ username: 'OtherVer', host: 'localhost', port: 25565, version: '1.16.5' }), /1\.21\.1/);
    await repo.add({ username: 'OkVer', host: 'localhost', port: 25565, version: '1.21.1' });
    assert.equal(repo.find('OkVer').version, '1.21.1');
    const config = repo.find('ConfigTest').plugins;
    config.autoEat.enabled = true; config.autoEat.hungerThreshold = 12;
    config.autoArmor.enabled = true; config.autoFishing.timeoutSeconds = 85;
    config.autoLogin.enabled = true; config.autoLogin.password = 'p@ss123'; config.autoLogin.cooldownSeconds = 10;
    config.autoLogin.patterns.push({ id: 'lp1', name: 'Login', action: 'login', lineCount: 1, regexLines: ['^.*/login.*$'], triggerText: '/login' });
    await repo.updatePlugins('ConfigTest', config);
    const reloaded = new BotRepository(file); await reloaded.load();
    assert.deepEqual(reloaded.find('ConfigTest').plugins, config);
    assert.equal(reloaded.find('ConfigTest').plugins.autoChat.joinMessage, 'hi');
    assert.equal(reloaded.find('ConfigTest').plugins.autoLogin.password, 'p@ss123');
    assert.equal(reloaded.find('ConfigTest').plugins.autoLogin.patterns.length, 1);
    console.log('PASS: legacy settings, numeric bounds and disk persistence (isolated profile)');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
