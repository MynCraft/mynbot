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
    for (const key of ['autoEat', 'autoArmor', 'autoFishing']) assert.equal(legacy[key].enabled, false);
    assert.equal(legacy.autoReconnect.enabled, true);
    assert.deepEqual(legacy.enabledScripts, ['sample.cjs']);
    const bounded = validatePluginSettings({ autoEat: { hungerThreshold: Infinity, healthThreshold: -5, selection: 'bad' }, autoArmor: { intervalSeconds: 999 }, autoFishing: { recastDelaySeconds: NaN, timeoutSeconds: 0 } });
    assert.equal(bounded.autoEat.hungerThreshold, 16); assert.equal(bounded.autoEat.healthThreshold, 1);
    assert.equal(bounded.autoEat.selection, 'saturation'); assert.equal(bounded.autoEat.restoreHeldItem, true);
    assert.equal(bounded.autoArmor.intervalSeconds, 120); assert.equal(bounded.autoFishing.recastDelaySeconds, 2); assert.equal(bounded.autoFishing.timeoutSeconds, 10);
    const file = path.join(dir, 'bots.json');
    await fs.writeFile(file, JSON.stringify([{ username: 'ConfigTest', host: 'localhost', port: 25565, plugins: { autoChat: { enabled: true, joinMessage: 'hi' } } }]));
    const repo = new BotRepository(file); await repo.load();
    const config = repo.find('ConfigTest').plugins;
    config.autoEat.enabled = true; config.autoEat.hungerThreshold = 12;
    config.autoArmor.enabled = true; config.autoFishing.timeoutSeconds = 85;
    await repo.updatePlugins('ConfigTest', config);
    const reloaded = new BotRepository(file); await reloaded.load();
    assert.deepEqual(reloaded.find('ConfigTest').plugins, config);
    assert.equal(reloaded.find('ConfigTest').plugins.autoChat.joinMessage, 'hi');
    console.log('PASS: legacy settings, numeric bounds and disk persistence (isolated profile)');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
