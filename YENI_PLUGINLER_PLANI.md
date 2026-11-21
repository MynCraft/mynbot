# MynBot — Kapsamlı Yeni Yerleşik Eklentiler (Plugins) Planı

Bu belge; mevcut `autoEat`, `autoArmor`, `autoFishing`, `autoReconnect`, `antiAfk`, `autoChat`, `autoLogin` ve `chatCalibrator` modüllerine ek olarak MynBot'a eklenecek **7 yeni yerleşik otomasyon eklentisinin** veri sözleşmesini, worker çalışma kurallarını, UI tasarımını ve test kriterlerini tanımlar.

---

## 1. Eklenecek Modüller ve Veri Sözleşmeleri (`src/types/bot.ts`)

### 1.1. Otomatik Totem & Kalkan (`autoTotem`)
Sol elde (`off-hand`, envanter slot `45`) sürekli *Totem of Undying* veya *Kalkan (Shield)* tutar; totem patladığında veya can kritik eşiğe indiğinde anında yenisini kuşanır.
```ts
export interface AutoTotemSettings {
  enabled: boolean;
  priorityItem: 'totem' | 'shield'; // Normal durumda sol elde hangisi tutulsun
  healthThreshold: number;          // Can bu değere (1-20) veya altına inerse kalkan yerine zorunlu toteme geç
  intervalSeconds: number;          // Kontrol aralığı (1-30 sn, varsayılan: 1)
}
```
- **Varsayılan:** `{ enabled: false, priorityItem: 'totem', healthThreshold: 12, intervalSeconds: 1 }`

---

### 1.2. Acil Çıkış / Panik Koruması (`autoPanic`)
AFK bırakılan botun ölmesini ve eşya kaybetmesini önlemek için kritik durumda sunucudan çıkar veya güvenli bölge komutu gönderir.
```ts
export interface AutoPanicSettings {
  enabled: boolean;
  healthThreshold: number;          // Can ≤ bu değer olduğunda tetikle (1-19, varsayılan: 6)
  disconnectOnPlayer: boolean;      // Yakına yabancı oyuncu gelirse tetikle
  playerRadius: number;             // Yabancı oyuncu algılama yarıçapı (3-32 blok, varsayılan: 12)
  whitelist: string[];              // Güvenilen oyuncu adları (maks. 30 oyuncu)
  action: 'disconnect' | 'command'; // Bağlantıyı kes veya kaçış komutu gönder
  panicCommand: string;             // action === 'command' ise gönderilecek komut (örn: "/spawn" veya "/is go")
  disableReconnect: boolean;        // Panik tetiklendiğinde autoReconnect'i otomatik durdur
}
```
- **Varsayılan:** `{ enabled: false, healthThreshold: 6, disconnectOnPlayer: false, playerRadius: 12, whitelist: [], action: 'disconnect', panicCommand: '/spawn', disableReconnect: true }`

---

### 1.3. Otomatik Savunma / Mob Kesen (`autoDefend`)
Spawner farmlarında veya gece AFK kalırken botun yakınına gelen düşman yaratıklara (hostile mobs) otomatik kılıç/balta kuşanıp saldırır.
```ts
export interface AutoDefendSettings {
  enabled: boolean;
  radius: number;                   // Saldırı menzili (2-6 blok, varsayılan: 4)
  attackIntervalMs: number;         // Vuruş aralığı (300-2000 ms, varsayılan: 650)
  autoEquipWeapon: boolean;         // Envanterdeki en güçlü kılıç/baltayı otomatik eline al
  attackCreepers: boolean;          // Creeper'lara saldırılsın mı (varsayılan: false - patlamayı önlemek için)
  restoreHeldItem: boolean;         // Tehlike geçince önceki eşyayı geri al
}
```
- **Varsayılan:** `{ enabled: false, radius: 4, attackIntervalMs: 650, autoEquipWeapon: true, attackCreepers: false, restoreHeldItem: true }`

---

### 1.4. Otomatik Lobi / Pusula & Menü Seçici (`autoLobby`)
Sunucuya giriş yaptıktan (`spawn` veya `autoLogin` sonrası) botu lobiden kurtarıp hedef oyun moduna (Skyblock, Survival vb.) ve adaya/warp'a sokar.
```ts
export interface AutoLobbySettings {
  enabled: boolean;
  delaySeconds: number;             // Bağlanma / login sonrası bekleme süresi (1-30 sn, varsayılan: 4)
  hotbarSlot: number;               // Sağ tıklanacak hotbar slotu (0 = kapalı, 1-9 = slot 1..9)
  clickSlot: number;                // Açılan menüde tıklanacak slot (-1 = kapalı, 0-53 = slot indeksi)
  itemKeyword: string;              // Slot yerine eşya adına göre tıklama (örn: "Skyblock", maks. 64 karakter)
  postCommand: string;              // Menü seçimi sonrası gönderilecek komut (örn: "/is go", maks. 128 karakter)
}
```
- **Varsayılan:** `{ enabled: false, delaySeconds: 4, hotbarSlot: 0, clickSlot: -1, itemKeyword: '', postCommand: '' }`

---

### 1.5. Beyaz Listeli Otomatik TPA / İstek Kabul Edici (`autoAccept`)
Güvenilen oyuncuların gönderdiği ışınlanma (`/tpa`, `/tpahere`) veya takas isteklerini otomatik kabul eder.
```ts
export interface AutoAcceptSettings {
  enabled: boolean;
  onlyWhitelist: boolean;           // Sadece beyaz listedeki oyuncuları kabul et (varsayılan: true)
  whitelist: string[];              // Güvenilen oyuncu isimleri (maks. 30 oyuncu)
  triggers: string[];               // Sohbette aranacak ifadeler (örn: ["ışınlanma isteği", "tpa", "teleport"])
  acceptCommand: string;            // Gönderilecek komut (varsayılan: "/tpaccept")
  cooldownSeconds: number;          // İki kabul arası bekleme (1-60 sn, varsayılan: 3)
}
```
- **Varsayılan:** `{ enabled: false, onlyWhitelist: true, whitelist: [], triggers: ['ışınlanma isteği', 'sana ışınlanmak', 'teleport request', '/tpaccept'], acceptCommand: '/tpaccept', cooldownSeconds: 3 }`

---

### 1.6. Zamanlayıcı / Periyodik Komut & Satış (`commandScheduler`)
Belirlenen süre aralıklarıyla `/sell all`, `/repair all`, `/kit` gibi komutları sırayla çalıştırır.
```ts
export interface ScheduledCommandTask {
  id: string;
  command: string;                  // Gönderilecek komut veya mesaj (maks. 256 karakter)
  intervalSeconds: number;          // Çalışma periyodu (5-86400 sn, varsayılan: 300)
  enabled: boolean;
}

export interface CommandSchedulerSettings {
  enabled: boolean;
  tasks: ScheduledCommandTask[];    // Maks. 20 görev
}
```
- **Varsayılan:** `{ enabled: false, tasks: [] }`

---

### 1.7. Otomatik Sandığa Boşaltma (`autoChestDump`)
Balıkçılık veya farm sırasında envanter dolduğunda yakındaki sandığı açıp korunan eşyalar dışındakileri sandığa aktarır.
```ts
export interface AutoChestDumpSettings {
  enabled: boolean;
  freeSlotsThreshold: number;       // Boş slot sayısı ≤ bu değer olduğunda boşalt (1-18, varsayılan: 3)
  searchRadius: number;             // Sandık arama yarıçapı (2-5 blok, varsayılan: 4)
  intervalSeconds: number;          // Kontrol sıklığı (5-120 sn, varsayılan: 15)
  keepFoods: boolean;               // Yiyecekleri envanterde tut (varsayılan: true)
  keepToolsAndArmor: boolean;       // Silah, olta, totem ve zırhları envanterde tut (varsayılan: true)
  keepKeywords: string[];           // Ekstra korunacak eşya adları (maks. 20 kelime)
}
```
- **Varsayılan:** `{ enabled: false, freeSlotsThreshold: 3, searchRadius: 4, intervalSeconds: 15, keepFoods: true, keepToolsAndArmor: true, keepKeywords: [] }`

---

## 2. Backend & Worker Uygulama Kuralları

1. **Ayar Doğrulama (`electron/services/pluginConfig.ts`)**:
   - `validatePluginSettings` içinde 7 yeni modülün tüm sayısal alanları `clampInt` ile sınırlandırılmalı, dizi alanları (`whitelist`, `triggers`, `tasks`, `keepKeywords`) uzunluk ve tip kontrolünden geçirilmelidir.
   - Eski `bots.json` dosyaları yeni alanlar olmasa bile `defaultPluginSettings()` ile eksiksiz yüklenmelidir.
2. **Otomasyon Koordinasyonu (`public/builtin-automation.cjs` & `public/bot-worker.cjs`)**:
   - **Öncelik Sırası (Priority):**
     1. `autoPanic` (Acil çıkış / can veya yabancı oyuncu kontrolü — en yüksek öncelik, anında çalışır)
     2. `autoTotem` (Off-hand slot `45` kontrolü — `bot.equip(item, 'off-hand')`)
     3. `autoEat` (Can/açlık düştüğünde yemek yeme)
     4. `autoDefend` (Yakında düşman mob varsa silah kuşanıp `bot.attack(target)` yapma; balıkçılığı keser)
     5. `autoArmor` (Daha iyi zırh kuşanma)
     6. `autoChestDump` (Envanter dolduğunda yakındaki sandığa eşya aktarma)
     7. `autoFishing` (Boşta olta atma)
   - **Lobi, Zamanlayıcı ve TPA (`public/bot-worker.cjs`):**
     - `autoLobby`: `spawn` sonrasında (veya `autoLogin` başarılı komutu gönderildikten sonra) `delaySeconds` bekler; `hotbarSlot > 0` ise `bot.setQuickBarSlot(hotbarSlot - 1)` + `bot.activateItem()` yapar; `windowOpen` olduğunda `clickSlot >= 0` veya `itemKeyword` eşleşen slotu bulup `bot.clickWindow(slot, 0, 0)` uygular; ardından `postCommand` varsa gönderir. Her bağlantıda 1 kez çalışır.
     - `autoAccept`: `instance.on('message')` içinde gelen mesajda `triggers` listesinden biri geçiyorsa ve (`!onlyWhitelist` veya `whitelist` içindeki bir oyuncu adı mesajda yer alıyorsa) `cooldownSeconds` kontrolüyle `bot.chat(acceptCommand)` gönderir.
     - `commandScheduler`: Aktif görevler (`tasks`) için son çalışma zamanlarını (`lastRunAt`) takip eder ve süresi gelen komutu `bot.chat(task.command)` ile gönderir.
     - `autoPanic`: `disableReconnect: true` ise panik nedeniyle çıkış yapıldığında worker ana sürece `{ type: 'panic-disconnect', username, reason }` gönderir; `BotManager` bu bot için `manualDisconnects.add(username)` yaparak `autoReconnect` döngüsünü durdurur ve loga panik sebebini yazar.
   - **Durum Raporlama (`BotData.automation`)**:
     - Tüm yeni modüller (`autoTotem`, `autoPanic`, `autoDefend`, `autoLobby`, `autoAccept`, `commandScheduler`, `autoChestDump`) `report(key, state, message, finished)` üzerinden gerçek çalışma durumlarını UI kartlarına bildirir.

---

## 3. Arayüz (UI) ve Çoklu Dil (`PluginsPanel.vue`, `PluginSettingsModal.vue`, `src/i18n/index.ts`, `AppIcon.vue`)

1. **`src/components/ui/AppIcon.vue`**:
   - Yeni modüller için gerekli Lucide ikonlarının (`ShieldAlert`, `AlertTriangle`, `Compass`, `UserCheck`, `Clock`, `PackageOpen` veya mevcut `Shield`, `Swords`, `Compass`, `Check`, `Box`, `Zap`) tanımlı olduğundan emin olunur.
2. **`src/components/Plugins/PluginsPanel.vue`**:
   - `cloneSettings` fonksiyonuna 7 yeni modülün derin kopyalaması (`whitelist`, `triggers`, `tasks`, `keepKeywords` dizileri dahil) eklenir.
   - `activeModulesCount` ve `toggleModule` fonksiyonlarına 7 yeni modül eklenir.
   - `builtinCards` listesine 7 yeni modül kartı (başlık, açıklama, dinamik özet `summary` ve canlı `status: automationHint(...)`) eklenir.
   - `commandScheduler` için görev ekleme/silme (`addScheduledTask`, `removeScheduledTask`) yardımcı fonksiyonları bağlanır.
3. **`src/components/Plugins/PluginSettingsModal.vue`**:
   - Her yeni `moduleId` (`autoTotem`, `autoPanic`, `autoDefend`, `autoLobby`, `autoAccept`, `commandScheduler`, `autoChestDump`) için temiz, cam tasarımlı form alanları eklenir.
   - Dizi tabanlı alanlar (`whitelist`, `triggers`, `keepKeywords`) kullanıcı dostu virgülle ayrılmış metin kutusu veya satır listesi olarak düzenlenir.
4. **`src/i18n/index.ts`**:
   - Tüm yeni modüllerin TR ve EN başlık/açıklama/alan çevirileri eklenir.

---

## 4. Test ve Doğrulama Kriterleri

- `tests/plugin-config.test.cjs`: 7 yeni modülün varsayılan değerleri, sınırlandırmaları (`clampInt`), dizi sanitizasyonu ve `bots.json` kalıcılığı test edilir.
- `tests/automation.test.cjs`:
  - `autoTotem`: Sol ele totem/kalkan kuşanma ve düşük canda kalkandan toteme geçiş.
  - `autoPanic`: Düşük canda veya yabancı oyuncu yaklaştığında panik tetikleme, beyaz listedeki oyuncuda tetiklememe.
  - `autoDefend`: Menzildeki düşman moba kılıç kuşanıp saldırma, Creeper filtresi.
  - `autoChestDump`: Envanter dolduğunda yiyecek/silahları koruyup diğer eşyaları sandığa aktarma.
  - `autoAccept` & `commandScheduler` & `autoLobby`: Tetikleme ve zamanlama kontrolleri.
- Derleme kontrolü:
  ```sh
  node tests/plugin-config.test.cjs
  node tests/automation.test.cjs
  npx vue-tsc --noEmit
  npx vite build
  ```
