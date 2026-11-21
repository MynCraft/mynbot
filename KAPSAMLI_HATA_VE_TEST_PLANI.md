# MynBot — Kapsamlı Hata Denetimi, Onarım ve Test Planı (v2)

**İnceleme tarihi:** 21 Kasım 2026  
**Durum:** Plan hazır + `1.21.1` sürüm seçici kısıtı kodlandı (`STATUS.md` güncellendi); B1–B22 onarımları Hydrogen tarafından uygulanmayı bekliyor.  
**Hedef:** `HATA_DUZELTME_PLANI.md` (Aşama 1–9) uygulandıktan **sonra** hâlâ devam eden *"bazı sunucularda sistem çalışmıyor, bağlanıyor/bağlanmıyor, login mesajlarını yakalayamıyor"* şikâyetlerinin tüm kök nedenlerini, yüksek riskli noktaları ve kapsamlı test planını çıkarmak.

> **Uygulayacak AI (Hydrogen) için kurallar:**
> 0. **ÖNEMLİ SÜRÜM KISITI (Kullanıcı Kararı):** Kullanıcı özel `1.21.1` fizik motoru entegrasyonu nedeniyle UI sürüm seçimini (`src/utils/supportedVersions.ts`, `BotView.vue`, `botRepository.ts`) **bilinçli olarak yalnızca `1.21.1` `<select>` listesiyle** sınırlandırdı. Aşama 1'deki **B2** düzeltmesini uygularken UI `<select>` listesine başka sürümler ekleme (`SUPPORTED_VERSIONS = ['1.21.1']` kalsın); yalnızca `bot-worker.cjs` içindeki `resolveAutoVersion` / test uyumluluğunu sağlam tut ve kullanıcı açıkça istemedikçe `1.21.1` kısıtını bozma.
> 1. `node_modules/` içini **asla değiştirme** (tüm Mineflayer / minecraft-protocol / prismarine-chat eksikleri `public/bot-worker.cjs`, `electron/` ve `src/` tarafında çözülmelidir).
> 2. Strict TypeScript kurallarını gevşetme (`any` / `@ts-ignore` ile gizleme yok).
> 3. Her aşama sonunda `./node_modules/.bin/vue-tsc --noEmit --incremental false`, `./node_modules/.bin/tsc --noEmit -p tsconfig.node.json` ve `npm test` komutlarını çalıştır; hepsi 0 hatayla geçmeli.
> 4. İş bitiminde `npx vite build` ve `node --check public/bot-worker.cjs` / `node --check public/builtin-automation.cjs` doğrula; değişiklikleri `STATUS.md` sonuna tarihli kayıt olarak ekle.

---

## 0. Mevcut Durum ve Kontrol Bulgusu Özeti

Bu denetim sırasında mevcut 13 test (`npm test`), `vue-tsc` ve `tsc -p tsconfig.node.json` temiz geçti. Ancak yapılan canlı protokol sondajları (`1.16.5`, `1.20.4`, `1.21.4`, `1.21.8`) ve tam kod taraması sonucunda, mevcut testlerin yakalayamadığı **22 somut hata / yüksek riskli nokta** tespit edildi.

### Belirti → Kök Neden Haritası

| Kullanıcının Gördüğü Belirti | Kök Nedenler |
| --- | --- |
| **Bazı sunucularda hiç bağlanmıyor / ping hatası** | **B1** (5sn `resolveAutoVersion` vs 5sn `noPongTimeout` yarışı), **B2** (`1.18.1`, `1.17`, `1.16.1`, `1.12` vb. 20 sürümün `TESTED_VERSION_SET` dışında kalıp `1.21.8`'e yönlendirilmesi), **B9** (`cookie_request`, `host:port`, `runtime()` Node yolu) |
| **Bağlanıyor-kopuyor / "Bağlanıyor"da 30 sn sonra atılıyor** | **B3** (Limbo/Auth/Anti-Bot sunucularda `update_health` gelmediği için `spawn` tetiklenmemesi → 30 sn timeout + sonsuz reconnect döngüsü), **B4** (`1.20.2+` `configuration` fazında `loggedIn=false` iken non-fatal `Parse/Serialization error`'ın bağlantıyı hata durumuna sokması), **B5** (`1.20.3+` Resource Pack yanıtında UUID'nin `00000000-...` gitmesi), **B6** (Velocity/Bungee `start_configuration` geçişinde `physics`/chat paket çakışması) |
| **Bağlanmayı kesince veya hızlı aç-kapa yapınca takılıyor** | **B7** (erken `disconnect` anında `instance.quit` undefined → `TypeError` ve zombie socket), **B8** (30 sn timeout'ta `reconnectAttempts`'in çift artması + stale `disconnected` IPC yarışı) |
| **Login / Register mesajlarını yakalayamıyor** | **B10** (`1.17–1.21.8` `action_bar` ve `1.11–1.16.5` `title` `action=2` paketlerinin Mineflayer tarafından hiç iletilmemesi), **B11** (Mineflayer `title.js`'nin JSON `extra` kısmını silmesi), **B12** (Title/Subtitle/Actionbar mesajlarının `BotManager` ve `LoginCalibrator`'a hiç gitmemesi), **B13** (`isSelfMessage` yanlış pozitifiyle `BotAdi: /login...` mesajlarının engellenmesi), **B14** (1.20.3+ `{"": "..."}` NBT ve `msg.unsigned` eksikliği), **B15** (kalibratör indeks kayması, Unicode süsleme çizgileri, araya giren satırlar) |
| **Envanter / Menü / Otomasyon / Arayüz bozulmaları** | **B17** (`1.20.5+` `{ itemCount: 0 }` yüzünden imleç silinmesi/takılması ve `1.21.2+` `set_cursor_item`), **B18** (Fırın/Smoker'ın 3 slot yüzünden Örs sanılması), **B19** (`autoChestDump` açılmayan sandıkta sonsuz deadlock), **B21** (`PluginsPanel` canlı refresh'in modalda yazılan şifre/kuralı silmesi) |

---

## 1. Ayrıntılı Hata Raporu

Önem dereceleri: 🔴 Kritik · 🟠 Yüksek · 🟡 Orta · ⚪ Düşük

### Bağlantı, Protokol ve Yaşam Döngüsü

#### 🔴 B1 — `resolveAutoVersion` 5 sn zaman aşımı ile `mc.ping` 5 sn `noPongTimeout` yarışı (ve soket sızıntısı)
- **Dosyalar:** `public/bot-worker.cjs:1261-1279, 1558-1566`, `node_modules/minecraft-protocol/src/ping.js:30-55`
- **Detay:** `mc.ping({ host, port })` içindeki `options.noPongTimeout` varsayılan **5000 ms**'dir ve TCP bağlantısı + `server_info` paketinden **sonra** başlar; `options.closeTimeout` ise **120.000 ms**'dir. `resolveAutoVersion` ise `t=0`'da **5000 ms** `Promise.race` başlatır. Status `ping`/`pong` paketini yanıtlamayan veya düşüren sunucu/proxy'lerde (TCPShield, bazı Bungee/Velocity/MOTD eklentileri) `server_info` gelmiş olsa bile `mc.ping` `t ≈ 5100 ms`'de çözülür; `resolveAutoVersion` yarışı kaybedip `"Sunucuya erişilemedi: Ping zaman aşımı (5 sn)"` hatasıyla bağlantıyı iptal eder ve alttaki TCP soketi 120 sn açık kalır.
- **Ek Risk:** `enable-status=false` olan, ping rate-limit uygulayan veya bozuk MOTD JSON'u döndüren (`ping.js:41` `JSON.parse`) sunucularda da `resolveAutoVersion` tamamen vazgeçer.

#### 🔴 B2 — Worker `resolveAutoVersion` mekanizmasının 20 geçerli release sürümü (`1.18.1`, `1.17`, `1.16.1`, `1.12` vb.) dışlaması *(UI Kısıtı Notu: Kural #0 gereği UI/DB yalnızca `1.21.1` kalır)*
- **Dosyalar:** `public/bot-worker.cjs:21, 1273-1278` *(Tarihsel not: UI tarafında `src/utils/supportedVersions.ts` ve `electron/services/botRepository.ts` kullanıcı kararıyla şimdilik yalnızca `1.21.1` olarak sabitlenmiştir)*
- **Detay:** `resolveAutoVersion` yalnızca `TESTED_VERSION_SET.has(v.minecraftVersion)` (`mineflayer.testedVersions`, 25 sürüm) arıyor. `minecraft-data` ve `mineflayer` (`loader.js:120-125`: `1.8.8`..`1.21.8`) tarafından desteklendiği doğrulanan **`1.9`, `1.9.1`, `1.9.2`, `1.11`, `1.12`, `1.12.1`, `1.13`, `1.13.1`, `1.14`, `1.14.1`, `1.14.2`, `1.14.3`, `1.15`, `1.15.1`, `1.16`, `1.16.1`, `1.16.2`, `1.16.3`, `1.17`, `1.18.1`** sürümleri `TESTED_VERSION_SET`'te yok!
- **Sonuç:** Worker doğrudan `version: 'auto'` (veya test/API üzerinden boş sürüm) ile çağrıldığında örneğin bir `1.18.1` (protokol `757`) veya `1.16.1` (`736`) veya `1.12` (`335`) sunucuda `matched` `undefined` dönüyor, worker `1.21.8` ile bağlanmaya çalışıyor ve ViaVersion yoksa sunucu bağlantıyı anında reddediyor. UI tarafı yeni fizik motoru entegrasyonu bitene kadar bilerek yalnızca `1.21.1` `<select>` listesi sunsa da worker katmanının ve protokol testlerinin bozulmaması için `resolveAutoVersion` düzeltmesi korunmalıdır.

#### 🔴 B3 — Limbo / Anti-Bot / Auth sunucularında `update_health` gelmeyince `spawn` tetiklenmemesi ve 30 sn timeout döngüsü
- **Dosyalar:** `public/bot-worker.cjs:1346-1350, 1386-1396`, `electron/services/botManager.ts:165-177, 228-240`, `node_modules/mineflayer/lib/plugins/health.js:11-15`
- **Detay:** Mineflayer `spawn` olayını yalnızca `update_health` (`health > 0`) paketi geldiğinde tetikler. NanoLimbo, LimboAuth, Sonar, BotFilter ve birçok Bungee/Velocity auth lobisi `login` + `position` + `chat`/`title` veya captcha `open_window` gönderip doğrulama bitene kadar `update_health` göndermez.
- **Sonuç:**
  1. `status('connected')` yalnızca `spawn`'da gönderildiği için bot `connecting` durumunda asılı kalır.
  2. 30 sn sonra `BotManager` `"Bağlantı zaman aşımı (30 sn)"` hatasıyla bağlantıyı keser ve `autoReconnect` varsa sonsuz bağlan-kop döngüsü oluşur.
  3. Bu sırada kullanıcı sohbetten `/login` veya `/captcha` yazamaz (`BotManager.chat` → `"Bot bağlı değil."`) ve `BotManager:167` `inventory` / `openWindow` mesajlarını `state !== 'connected'` olduğu için çöpe atar (captcha GUI'si hiç görünmez).

#### 🔴 B4 — `1.20.2+` `configuration` fazında ölümcül olmayan protokol hatalarının bağlantıyı bozması
- **Dosyalar:** `public/bot-worker.cjs:1518-1529, 1545`
- **Detay:** `instance.on('error')` içinde `if (!loggedIn)` kontrolü var. `1.20.2+` sunucularda `configuration` fazı `login` paketinden **önce** gerçekleştiği için `loggedIn` henüz `false`'tur. Bu fazda gelen özel/Bungee/ViaVersion paketinde oluşan bir `Parse error` veya `Serialization error` bağlantıyı kesmediği hâlde `failureReported = true` + `status('error')` gönderilir; `BotManager` bağlantıyı düşmüş sayıp yeniden bağlanma planlarken gerçek `end` olayında da `failureReported` yüzünden `disconnected` durumu bastırılır.

#### 🔴 B5 — `1.20.3–1.21.8` Resource Pack yanıtında UUID'nin `00000000-0000-0000-0000-000000000000` gönderilmesi ve `seenResourcePacks` kilidi
- **Dosyalar:** `public/bot-worker.cjs:1327-1344, 1510-1516`, `node_modules/mineflayer/lib/plugins/resource_pack.js:17-78`, `tests/resource-pack.test.cjs:65`
- **Detay (Canlı 1.21.4 testi ile kanıtlandı):** Mineflayer `resource_pack.js`, `new UUID(data.uuid)` nesnesini doğrudan `bot._client.write('resource_pack_receive', { uuid: latestUUID, ... })` içine veriyor. ProtoDef bu `uuid-1345` nesnesini dizeye çeviremediği için sunucuya **`00000000-0000-0000-0000-000000000000`** yazıyor! Mevcut `tests/resource-pack.test.cjs` yalnızca regex kontrolü yaptığı için bu hatayı gizlemiş. Zorunlu resource pack kullanan `1.20.3+` sunucular UUID uyuşmazlığından botu atıyor.
- **Ek Hata:** `seenResourcePacks` yalnızca `end`'de temizleniyor; `remove_resource_pack` veya `login` (proxy alt-sunucu geçişi) sırasında temizlenmediği için aynı paket tekrar gönderildiğinde `acceptResourcePack` çağrılmıyor ve sunucu botu atıyor.

#### 🟠 B6 — `1.20.2+` `start_configuration` (Velocity/Bungee sunucu geçişi) sırasında serializer çakışması
- **Dosyalar:** `public/bot-worker.cjs:685, 987, 1081, 1434-1454`, `node_modules/mineflayer/lib/plugins/physics.js:443-451`
- **Detay:** `1.20.2+` proxy sunucu geçişinde `start_configuration` gelince `client.state` `'configuration'` olur; ancak Mineflayer `physics.js` `start_configuration` olayında `shouldUsePhysics = false` yapmaz. Sonuç olarak 50ms'lik `doPhysics` döngüsü `configuration` serializer'ına `position`/`flying` yazmaya çalışır. Benzer şekilde `antiAfk`, `commandScheduler`, `autoLobby`, `autoChat` `instance._client.state !== 'play'` iken `bot.chat` / `look` / `setControlState` çağırırsa `Serialization error` üretir.

#### 🟠 B7 — Erken `disconnect` / `connect` temizliğinde `instance.quit` `undefined` çökmesi ve soket sızıntısı
- **Dosyalar:** `public/bot-worker.cjs:1298, 1415, 1572, 1959`, `node_modules/mineflayer/lib/loader.js:76, 132`
- **Detay:** Mineflayer `bot.quit`'i `setTimeout(..., 0)` (`inject_allowed` → `kick.js`) içinde tanımlar; öncesinde yalnızca `bot.end` mevcuttur. Bağlantı `connecting` iken erken aşamada `disconnect`, `connect` (eski örneği temizleme) veya `onPanicDisconnect` çalışırsa `instance.quit()` `TypeError: instance.quit is not a function` fırlatır; `status('disconnected')` mesajı gönderilmez ve TCP soketi açık kalır.

#### 🟠 B8 — `BotManager` 30 sn timeout çift `reconnectAttempts` artışı, stale IPC yarışı, kalıcı `operation-error` banner'ı ve `resourcePacks` karışması
- **Dosyalar:** `electron/services/botManager.ts:47-85, 152-164, 188-193, 228-240`, `electron/main.ts:208-216`
- **Detay:**
  1. 30 sn bağlantı zaman aşımı (`botManager.ts:228-239`) `scheduleReconnect()` çağırdıktan sonra worker'a `disconnect` gönderir; worker'ın döndüğü `status('disconnected')` `botManager.ts:163` içinde `scheduleReconnect()`'i **ikinci kez** tetikler ve `reconnectAttempts` 1 yerine 2 artar (`maxAttempts: 1` ilk denemede durur).
  2. Hızlı Disconnect → Connect arasında worker'dan gecikmeli gelen eski `status('disconnected')` yeni `connecting` durumunu ezer (bot/oturum tokenı yok).
  3. `operation-error` (`botManager.ts:192`) `statuses[username].message`'a yazılıyor ve başarılı sonraki komutlarda temizlenmediği için üst banttaki uyarı (`BotView.vue:480`) kalıcı kalıyor.
  4. `clearBotData` `data.resourcePacks`'i sıfırlamıyor; `main.ts:208` `resolve-resource-pack-texture` tüm botların (eski/başka sunucudakiler dahil) paketlerini karıştırıyor.

#### 🟡 B9 — `1.20.5+` `cookie_request` / `transfer`, `runtime()` Node 22 keşfi, `host:port` girişi ve `uncaughtException` durumu
- **Dosyalar:** `public/bot-worker.cjs:1245-1259, 1305`, `electron/services/botManager.ts:104-114`, `electron/services/botRepository.ts:9`
- **Detay:**
  1. `1.20.5+` bazı Velocity/Paper sunucularının login/config aşamasında gönderdiği `cookie_request` yanıtlanmadığında sunucu bağlantıyı kesebilir (en azından boş payload `cookie_response` veya log/uyarı ele alınmalı; `transfer` paketi algılanırsa kullanıcıya net bilgi veya yeniden yönlendirme sağlanabilir).
  2. `BotManager.runtime()` yalnızca `MYNBOT_NODE`, `node` ve `~/.local/share/nvm` dizinine bakıyor; standart `~/.nvm/versions/node`, `/usr/local/bin/node`, `/opt/homebrew/bin/node`, Windows `C:\Program Files\nodejs\node.exe` yolları kontrol edilmiyor.
  3. `broadcastWorkerError` (`bot-worker.cjs:1245`) yalnızca `logLine` atıyor; `inject_allowed` / socket içi `uncaughtException` olursa ilgili botun `connecting` durumu `'error'`'a çevrilmiyor ve `bots` boşsa hata tamamen kayboluyor.
  4. `host` alanına `play.sunucu.com:25565` yapıştırıldığında kullanıcıya anlamlı ayrıştırma veya hata mesajı verilmiyor.

---

### Login ve Sohbet Mesajı Yakalama

#### 🔴 B10 — Dedicated `action_bar` (`1.17–1.21.8`) ve `title` `action=2` (`1.11–1.16.5`) paketlerinin tamamen kaybolması
- **Dosyalar:** `public/bot-worker.cjs:1470-1485`, `node_modules/mineflayer/lib/plugins/title.js:12-20`, `node_modules/mineflayer/lib/plugins/chat.js:134-143`
- **Detay (Canlı `1.16.5`, `1.21.4` ve `1.21.8` testleriyle kanıtlandı):**
  - `1.17–1.21.8` sunucularının (Paper, Velocity, Adventure API, AuthMe, nLogin) çoğunun kullandığı `packet_action_bar` Mineflayer içinde **hiç dinlenmiyor**.
  - `1.11–1.16.5` sürümlerinde `packet_title` `action === 2` actionbar taşırken Mineflayer `title.js:16` bunu `title_times` sanıp `packet.text`'i yok sayıyor.

#### 🔴 B11 — Mineflayer `title.js` `parseTitle()` fonksiyonunun JSON `extra` / `with` içeriğini kesmesi
- **Dosyalar:** `public/bot-worker.cjs:1470-1474`, `node_modules/mineflayer/lib/plugins/title.js:3-10`
- **Detay (Canlı `1.16.5` testi ile kanıtlandı):** Sunucu `{"text":"Giriş ","extra":[{"text":"/login sifre"}]}` veya `{"text":" ","extra":[...]}` gönderdiğinde `title.js:6` (`parsed.text || text`) `parsed.text` truthy olduğu için **`extra` dizisini çöpe atıp yalnızca `"Giriş "` veya `" "` yayınlıyor**. `bot-worker.cjs` ham `_client` üzerinden `title` (`action 0/1/2`), `set_title_text`, `set_title_subtitle` ve `action_bar` paketlerini doğrudan dinlemelidir.

#### 🔴 B12 — Title / Subtitle / Actionbar mesajlarının `BotManager` ve `LoginCalibrator.vue` arayüzüne hiç ulaşmaması
- **Dosyalar:** `public/bot-worker.cjs:1470-1484`, `electron/services/botManager.ts:152-193`, `src/components/Plugins/LoginCalibrator.vue:14-15`, `src/types/bot.ts:277-290`
- **Detay:** Worker `{ type: 'actionbar', ... }` gönderse de `BotManager` içinde `actionbar` veya `title` dalı yok; bu mesajlar sessizce atılıyor. Worker `title` ve `subtitle`'ı zaten IPC ile hiç göndermiyor. `LoginCalibrator.vue` ise yalnızca `store.data[username].chat` okuyor.
- **Sonuç:** Sunucu giriş uyarısını Title, Subtitle veya Actionbar ile veriyorsa kullanıcı bunu UI'da göremiyor ve kalibre edemiyor.

#### 🔴 B13 — `handleAutoLogin` içindeki `isSelfMessage` yanlış pozitifi ve title/actionbar çoklu satır kilidi
- **Dosyalar:** `public/bot-worker.cjs:722-740, 862-936`
- **Detay:**
  1. `handleAutoLogin` satır 876 `isSelfMessage(username, raw, null)` çağırır. `isSelfMessage` satır 729 `/(?:^|\b)<username>\s*[»:\]>]/i` ile eşleşen **tüm** sunucu mesajlarını botun kendi mesajı sanıp reddeder (ör. `"Merhaba, MyBot: Lütfen /login <şifre> yazın"`, `"[Auth] MyBot » /login <şifre>"`). `handleAutoLogin` yalnızca son 5 sn içinde botun bizzat gönderdiği komutun birebir yankısını (veya hiç `senderPrefixRe` kullanmadan) elemelidir.
  2. `handleAutoLogin:892` `if (count !== 1) continue;` nedeniyle 2 satırlık (Title + Subtitle) kalıplar `title`/`actionbar` kaynağında hiç çalışmıyor. Ayrıca Title + Subtitle birleşik veya ardışık tamponda eşleştirilemiyor.

#### 🟠 B14 — `extractReasonText` / `parseChatToSegments` `1.20.3+` boş anahtar (`{ "": "..." }`) ve `msg.unsigned` / `fromNetwork` eksikleri
- **Dosyalar:** `public/bot-worker.cjs:44-71, 132-184, 1475-1490`, `node_modules/mineflayer/lib/plugins/chat.js:115-132`, `node_modules/prismarine-chat/index.js:490-496`
- **Detay:**
  1. `1.20.3+` NBT bileşenlerinde çok sık kullanılan `{"": "Lütfen ", "extra": [{"text": "/login"}]}` yapısında `node['']` okunmadığı için ana metin kayboluyor.
  2. `1.19+` `player_chat` paketlerinde Paper/EssentialsChat/Velocity `unsignedChatContent` gönderdiğinde Mineflayer bunu `jsonMsg.unsigned` içine koyar, `jsonMsg.toString()` ise `unsigned` içeriğini yoksayar.
  3. `prismarine-chat` `fromNetwork` `1.21+` inline `chat_type` (`0`) veya henüz `chat_type` registry'si gelmeden paket alırsa `uncaughtException` fırlatabilir.

#### 🟠 B15 — `buildLoginPattern` katılığı, `LoginCalibrator` / `ChatCalibrator` indeks kayması, boş/araya giren satırlar ve `listenTitleActionbar` kaybı
- **Dosyalar:** `src/utils/chatPatternBuilder.ts:25-32, 150-201`, `src/components/Plugins/LoginCalibrator.vue:14-33`, `src/components/Plugins/ChatCalibrator.vue:14-59`, `public/bot-worker.cjs:786-825, 862-906`, `electron/services/pluginConfig.ts:219-226`, `src/types/bot.ts:53-60`
- **Detay:**
  1. `LoginCalibrator` ve `ChatCalibrator` canlı `.slice(-25)` dizisinde `selectedIndices` tutuyor; yeni mesaj geldikçe seçili checkbox indeksleri başka satırlara kayıyor.
  2. `buildDecorativeLine` Unicode çizgileri (`━`, `═`, `─`, `▬`, `✦`) esnetmiyor; `triggerText` boşsa tüm satırı birebir (`^\s*...\s*$`) sabitliyor (satırda değişken saat, oyuncu sayısı veya kullanıcı adı varsa patlıyor).
  3. `handleAutoLogin:889` ve `tryParseChat:799` yalnızca en sondaki `count` ardışık satıra (`slice(-count)`) bakıyor; çok satırlı kalıbın arasına boşluk (`" "`) veya sunucu duyurusu girerse eşleşme başarısız oluyor.
  4. `pluginConfig.ts:219-226` `listenTitleActionbar` alanını kaydetmiyor/siliyor; `types/bot.ts` içinde de yok.

#### 🟡 B16 — `autoLobby` ve `joinMessage` zamanlamasının AuthMe/proxy geçişiyle çakışması
- **Dosyalar:** `public/bot-worker.cjs:760-784, 923-929, 1081-1121, 1428-1430`
- **Detay:** `autoLogin` açıkken `autoLobby` `spawn`'da başlatıldığı için login tamamlanmadan tetiklenebiliyor veya proxy alt-sunucu geçişi (`login` #2) sırasında `lobbyCompleted = true` kalıp Hub menüsünü açamıyor. `joinMessage` da `/login` sonrası 800 ms içinde Auth sunucusuna gidebiliyor.

---

### Envanter, Otomasyon, Dünya ve Arayüz

#### 🔴 B17 — `1.20.5–1.21.8` `itemCount: 0` boş slot hatası, `1.21.2+` `set_cursor_item` / `set_player_inventory` ve son eşya imleç silinmesi
- **Dosyalar:** `public/bot-worker.cjs:469-471, 1351-1380`
- **Detay (Canlı 1.21.4 doğrulaması):** `1.20.5+` protokolünde boş eşya `{ itemCount: 0 }` olarak gelir (`present: false` yok). `bot-worker.cjs:1356, 1364-1366, 1375` `itemCount === 0` kontrolü yapmadığı için slottan eşya alınca gelen boş `set_slot` paketini iptal sanıp **imleci (`clearCursor`) siliyor**, boş `carriedItem` gelince de temizlemiyor. Ayrıca satır 469 envanterde hiç eşya kalmadığında (son eşyayı imlece aldığınızda) imleci siliyor. `1.21.2+` `set_cursor_item` ve `set_player_inventory` paketleri de dinlenmiyor.

#### 🟠 B18 — 3 slotlu Fırın / Tütsüleyici / Maden Fırını pencerelerinin Örs (Anvil) olarak açılması
- **Dosya:** `src/components/Inventory/ContainerModal.vue:60`
- **Detay:** `win.containerSlotCount === 3` koşulu yüzünden `furnace`, `smoker` ve `blast_furnace` pencereleri `ÖRS / ANVIL` olarak render ediliyor. Yalnızca `win.type` (veya açıkça örs tipi/başlığı) kontrol edilmeli.

#### 🟠 B19 — `autoChestDump` ve `open-block` içinde `windowOpen` deadlock'u, `fish()` `unhandledRejection` ve `1.20.5+` `snapshotHeld`
- **Dosyalar:** `public/builtin-automation.cjs:3, 183-189, 324-352, 355-382`, `public/bot-worker.cjs:1656-1670`
- **Detay:**
  1. `chestDump()` içindeki `openFn(chestBlock)` zaman aşımı olmadığı için açılmayan/korumalı sandıkta sonsuza kadar asılı kalır (`busy = true` ve tüm `queues` kuyruğu kilitlenir).
  2. `open-block` 4 sn timeout sonrası Mineflayer `once(bot, 'windowOpen')` dinleyicisini temizlemiyor ve tekrar `activateBlock` çağırıyor.
  3. `fish()` içindeki `Promise.race` iptal/timeout sonrası `bot.fish()` reddederse `.catch()` olmadığı için `unhandledRejection` üretir; `1.8–1.12` için `flowing_water` da kabul edilmelidir.
  4. `snapshotHeld()` / `restore()` `1.20.5+` `item.components` karşılaştırmıyor (`nbt` her zaman `null`).

#### 🟡 B20 — `interact-entity` içinde `bot.useOn` 1.9+ paket serileştirme hatası
- **Dosyalar:** `public/bot-worker.cjs:1911-1920`, `node_modules/mineflayer/lib/plugins/entities.js:901-918`
- **Detay:** `bot.useOn(entity)` `use_entity` paketinde `hand` alanını göndermediği için `1.9+` sunucularda serileştirme hatası verir; `activateEntity` (`hand: 0` gönderir) öncelikli kullanılmalıdır.

#### 🟠 B21 — `PluginsPanel` canlı yenileme ile modal verilerinin silinmesi ve `PluginIcon` eksik ikonları
- **Dosyalar:** `src/components/Plugins/PluginsPanel.vue:81-85`, `src/components/Plugins/PluginIcon.vue:14`, `src/components/Plugins/PluginSettingsModal.vue:635`, `src/views/BotView.vue:132`, `src/components/World/IsoWorldView.vue:204, 318-323`
- **Detay:**
  1. `PluginsPanel.vue:81-85` `bot.value?.plugins` derin izleyicisi, `store.refresh()` her yeni `snapshot()` nesnesi döndürdüğünde (her `pose`/`chat`/`log` olayında!) tetiklenip `draft.value`'yu sıfırlıyor; kullanıcı modalda şifre/kural yazarken girilenler siliniyor.
  2. `PluginIcon.vue:14` `LUCIDE_NAMES` kümesinde `KeyRound`, `Compass`, `Check`, `Box`, `Lock` eksik olduğu için ilgili modül kartlarında SVG ikon yerine `"KeyRound"`, `"Compass"`, `"Check"`, `"Box"` yazısı görünüyor.
  3. `BotView.vue:132` bağlantı kopukken modal kapanınca `closeContainer` çağırıyor (`"Bot bağlı değil."` hatası).
  4. `PluginSettingsModal.vue:635` hâlâ harici scriptlerin yeniden bağlantı gerektirdiğini söylüyor (canlı yenileme zaten mevcut).
  5. `IsoWorldView.vue` `headingMode === 'bot'` ızgarayı döndürmüyor ve entity isim etiketlerinde `textAlign` eksik.

#### 🟡 B22 — `ResourcePackService` indirme zaman aşımı / boyut sınırı eksikliği
- **Dosya:** `electron/services/resourcePackService.ts:269`
- **Detay:** `fetch(url)` çağrısında `AbortSignal.timeout` ve maksimum dosya boyutu sınırı yok; yanıt vermeyen veya çok büyük `.zip` gönderen sunucular ana süreci bekletebilir/belleği doldurabilir.

---

## 2. Sıralı Onarım Planı

### Aşama 1 — Bağlantı, Ping, Sürüm ve Yaşam Döngüsü Kararlılığı (B1, B2, B3, B4, B7, B8, B9)

1. **Sürüm çözümleme (`public/bot-worker.cjs` — UI `1.21.1` kısıtını koruyarak):**
   - `src/utils/supportedVersions.ts` (`['1.21.1']`), `src/views/BotView.vue` (`<select>` yalnızca `1.21.1`) ve `electron/services/botRepository.ts` (`1.21.1` doğrulaması/göçü) **olduğu gibi bırakılır**.
   - `public/bot-worker.cjs` içindeki `resolveAutoVersion` (gelecekte çoklu sürüm açıldığında ve worker seviyesi otomatik testlerde doğru çalışması için): `mc.ping` çağrısına `{ host, port, noPongTimeout: 1500, closeTimeout: 5500 }` geçir; `Promise.race` zaman aşımını `6500` ms yap ve timeout durumunda istemci soketini kapat.
   - `TESTED_VERSION_SET` eşleşmesi bulunamazsa `candidates` içinden `prismarine-registry` ile `[oldestSupportedVersion, latestSupportedVersion]` (`1.8.8`..`1.21.8`) aralığında kalan ilk kararlı release sürümünü seç (`1.18.1`, `1.17`, `1.16.1`, `1.12` vb.).
   - `mc.ping` başarısız olursa (ör. `enable-status=false`, malformed JSON, status kapalı/rate-limit) kullanıcıya net ping uyarısı yaz ve gerçek ağ erişim hatası (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) yoksa `latestSupportedVersion` (veya `1.21.1`) ile bağlanmayı dene; `host:port` yapıştırılırsa `validateBot` ve formda ayrıştır veya açıklayıcı hata ver.
2. **Limbo / Anti-Bot `connected` geçişi ve `configuration` hata koruması (`public/bot-worker.cjs`, `electron/services/botManager.ts`):**
   - `spawn` geldiğinde `status('connected')` gönderme davranışını koru; **ancak** `login` olduktan sonra `forcedMove` (ilk `position` paketi) veya `login`'den **1500 ms** sonra hâlâ `spawn` gelmediyse (ve bağlantı hâlâ aktifse) bağlantıyı `connected` durumuna geçir (log: `"Sunucu sağlık paketi göndermedi (Limbo/Auth), bağlantı etkinleştirildi."`). Gerçek `spawn` sonradan gelirse `spawnedOnce` kontrolü tekrar `connected` basılmasını engeller; `triggerJoinChat`/`initPluginsOnce` yalnızca ilk `connected` geçişinde çalışır (`bot.entity?.position` kontrolüyle).
   - `BotManager` (`electron/services/botManager.ts:165-177`) `inventory` (özellikle captcha GUI `openWindow`), `pose` ve `world` mesajlarını bot `connecting` aşamasındayken (yani `login` sonrası, henüz `spawn` öncesi) de kabul etsin.
   - `bot-worker.cjs:1518` (`instance.on('error')`): Hata mesajı `/Parse error|Serialization error|PartialReadError/i` ise `loggedIn` `false` olsa bile (`1.20.2+` `configuration` fazı!) **asla** `failureReported = true` veya `status('error')` gönderme; yalnızca log / `operation-error` bildir.
3. **Erken çıkış, timeout çift sayım ve stale IPC koruması (`public/bot-worker.cjs`, `electron/services/botManager.ts`):**
   - `bot-worker.cjs` içindeki tüm `instance.quit()` çağrılarını (`1298, 1415, 1572, 1959`) güvenli yardımcıya (`safeQuit(instance)` → `typeof quit === 'function' ? quit() : end?.()`; ayrıca `_client?.end?.()`) taşı.
   - `BotManager` ve worker arasında her `connect` için artan bir `connectId` / `sessionId` ilet (veya `BotManager` 30 sn timeout'ta `disconnect` göndermeden önce `timedOutUsers` ya da `sessionId` kontrolü yap) ki:
     - 30 sn timeout sonrası worker'dan dönen `status('disconnected')` `reconnectAttempts`'i **ikinci kez artırmasın**;
     - Hızlı Disconnect → Connect sonrası gecikmiş eski `disconnected` eventi yeni `connecting` oturumunu ezmesin.
   - `operation-error` geldiğinde `statuses[username].message`'ı kalıcı olarak kirletme (sohbet hatası zaten `data.lastError` ile gösteriliyor; geçici uyarı veya `lastError` kullan).
   - `broadcastWorkerError` bir `uncaughtException` / `unhandledRejection` yakaladığında worker içindeki `connecting` durumundaki botları sonsuza kadar bekletmemek için ilgili hatayı logla (mümkünse hata kaynağındaki ya da takılan botlara `operation-error` bildir).
   - `BotManager.runtime()` içine `~/.nvm/versions/node`, `/usr/local/bin/node`, `/opt/homebrew/bin/node` ve Windows standart Node yollarını ekle.

**Kabul:** `1.18.1` sunucu otomatik sürümle `1.18.1` olarak bağlanmalı; status `pong` yanıtı vermeyen sunucu ping'de takılmamalı; `update_health` göndermeyen Limbo sunucusu `connected` olup chat/menü çalıştırmalı; `configuration` fazında `Parse error` botu düşürmemeli; erken `disconnect` soketi kapatıp `disconnected` dönmeli; 30 sn timeout'ta `maxAttempts: 1` doğru çalışmalı.

---

### Aşama 2 — Resource Pack ve `1.20.2+` Configuration Geçişi Düzeltmeleri (B5, B6, B22)

1. **`1.20.3–1.21.8` `resource_pack_receive` gerçek UUID gönderimi (`public/bot-worker.cjs`):**
   - `bot-worker.cjs` içinde `instance.supportFeature('resourcePackUsesUUID')` doğru olduğunda, `instance.acceptResourcePack()`'in `UUID` nesnesi yüzünden `00000000-...` yazma hatasını aşmak için doğrudan `instance._client.write('resource_pack_receive', { uuid: uuidString, result: 3 })` ve `{ uuid: uuidString, result: 0 }` gönder (eğer `uuidString` elde edilemediyse mevcut `acceptResourcePack()` yedeğine düş). Hash kullanan eski sürümlerde (`< 1.20.3`) `instance.acceptResourcePack()` korunsun.
   - `instance._client.on('remove_resource_pack', ...)` ile kaldırılan UUID'yi (veya `uuid === undefined` ise tümünü) `seenResourcePacks`'ten sil; `login` olayında da alt-sunucu geçişi için `seenResourcePacks.clear()` yap.
   - `BotManager.clearBotData` içinde `data.resourcePacks = undefined` sıfırla; `main.ts:208` `resolve-resource-pack-texture` aktif botları önceliklendirsin ve `ResourcePackService` cache anahtarına URL setini veya aktif pack kimliğini dahil etsin.
   - `ResourcePackService.ensurePackLoaded` içine `AbortSignal.timeout(15000)` ve boyut sınırı (ör. 50 MB) ekle.
2. **`1.20.2+` `start_configuration` ve `cookie_request` (`public/bot-worker.cjs`):**
   - `instance._client.on('start_configuration', ...)` dinleyicisi ekleyerek `state` `'configuration'` iken `bot.chat`, `antiAfk`, `commandScheduler`, `autoLobby` gönderimlerini `instance._client.state === 'play'` koşuluyla koru ve hareket kontrollerini (`clearControlStates`) durdur (ayrıca `instance.emit('respawn')` veya `physicsEnabled` geçici durdurup sonraki `position`'da geri açma yoluyla `doPhysics`'in `configuration` state'e `position` paketi yazmasını önle).
   - `1.20.5+` sunucularda `cookie_request` geldiğinde boş `cookie_response` (`{ key: packet.key, payload: undefined }`) yanıtı opsiyonunu güvenli biçimde (yalnızca `packet.key` varsa, try/catch ile) destekle.

**Kabul:** `1.20.4` ve `1.21.4` / `1.21.8` test sunucusunda sunucuya giden `resource_pack_receive` UUID'si sunucunun gönderdiği `packUuid` ile **birebir eşit** olmalı (`00000000-...` yasak); `remove_resource_pack` sonrası aynı UUID tekrar gelirse yeniden kabul edilmeli; `start_configuration` sırasında `Serialization error` oluşmamalı.

---

### Aşama 3 — Login, Title, Subtitle, Actionbar ve Sohbet Algılama Düzeltmeleri (B10, B11, B12, B13, B14, B15, B16)

1. **Ham Paketlerden Tam Title / Subtitle / Actionbar Çıkarımı (`public/bot-worker.cjs`):**
   - Mineflayer'ın `title.js` (`parseTitle` `extra` kesmesi ve `action: 2` hatası) ve `chat.js` (`action_bar` dinlememesi) açıklarını kapatmak için `instance._client` üzerinde:
     - `1.8–1.16.5`: `title` paketinde `action === 0` (`title`), `action === 1` (`subtitle`), `action === 2` (`actionbar`) metinlerini çıkar.
     - `1.17–1.21.8`: `set_title_text` (`title`), `set_title_subtitle` (`subtitle`), `action_bar` (`actionbar`) paketlerini dinle.
     - `system_chat` / `chat` (`position === 'game_info'` / `isActionBar: true`) ile birlikte tüm actionbar kaynaklarını tekelleştir (aynı metin 50ms içinde iki kez gelirse tekilleştir) ve hem `handleAutoLogin`'e hem de UI'a ilet!
   - `extractReasonText` ve `parseChatToSegments` içine `node['']` (`1.20.3+` NBT boş anahtar) ve `%s` `translate` + `with` (tercihen `ChatMessage.fromNotch` ile) tam desteği ekle.
   - `instance.on('message')` içinde `jsonMsg.unsigned` varsa formatlı metin/segment çıkarımında öncelikle onu değerlendir; `playerChat` / `fromNetwork` kaynaklı paket hatalarını yakala.
2. **Title / Subtitle / Actionbar'ın `BotManager` ve `LoginCalibrator.vue` İçine Taşınması (`public/bot-worker.cjs`, `electron/services/botManager.ts`, `src/types/bot.ts`, `src/components/Plugins/LoginCalibrator.vue`):**
   - Worker `title`, `subtitle` ve `actionbar` mesajlarını IPC ile `BotManager`'a göndersin (ör. `BotData.loginPrompts` veya `chat` akışından ayrı son 20 giriş/sistem mesajı listesi `{ text, source: 'chat' | 'title' | 'subtitle' | 'actionbar', at }` + son `actionbar`).
   - `LoginCalibrator.vue` kullanıcıya **hem sohbet satırlarını hem de Title / Subtitle / Actionbar satırlarını** (kaynak etiketiyle: `[Chat]`, `[Title]`, `[Subtitle]`, `[Actionbar]`) göstersin ki sunucu `/login`'i nereden isterse istesin kalibre edilebilsin!
3. **`handleAutoLogin` Yanlış Pozitif ve Çoklu Satır / Title+Subtitle Düzeltmesi (`public/bot-worker.cjs`, `src/utils/chatPatternBuilder.ts`, `electron/services/pluginConfig.ts`):**
   - `handleAutoLogin` içinden `isSelfMessage(username, raw, null)` çağrısındaki `senderPrefixRe` kontrolünü kaldır (yalnızca botun az önce gönderdiği komutun birebir yankısını yok say).
   - `handleAutoLogin` içinde `title` + `subtitle` satırlarını da kısa bir tamponda (`recentTitleLines`, ör. 3 sn pencere) tutarak çok satırlı (`count > 1`) Title+Subtitle kurallarının eşleşmesini sağla!
   - `recentLoginLines` / `recentLines` tamponlarına tamamen boş (`""` / yalnızca boşluk) satırları ekleme.
   - `buildLoginPattern` (`src/utils/chatPatternBuilder.ts`):
     - Unicode süsleme çizgilerini (`━`, `═`, `─`, `▬`, `┄`, `┈`, `✦`, `»` vb.) dekoratif satır olarak tanı ve esnek regex üret.
     - `triggerText` boş bırakıldığında, satırda `/login` veya `/register` geçiyorsa veya genel kalıpta gereksiz katılığı azalt (ya da kullanıcıya canlı önizlemede seçili metinden otomatik anahtar ibare öner).
   - `LoginCalibrator.vue` ve `ChatCalibrator.vue`: Canlı chat güncellendiğinde `selectedIndices`'in kaymaması için seçimi indeks yerine satır kimliği/nesnesi üzerinden tut veya yeni mesaj geldikçe indeksleri kaydır (ve "Listeyi dondur" seçeneği ekle).
   - `BotPluginSettings.autoLogin` içine `listenTitleActionbar: boolean` (varsayılan `true`) alanını `src/types/bot.ts`, `electron/services/pluginConfig.ts` ve `PluginSettingsModal.vue`'ya resmi olarak ekle.
4. **`autoLobby` ve `joinMessage` zamanlaması (`public/bot-worker.cjs`):**
   - `autoLogin` etkinse `scheduleAutoLobby` ve `triggerJoinChat` zamanlayıcılarını `loginCommandSent` sonrası veya en geç makul bir bekleme ile başlat; alt-sunucu geçişinde (`login` #2) `autoLobby` henüz hedefine ulaşmadıysa yeniden değerlendirebilmesini sağla (en azından `autoLogin` öncesi `lobbyCompleted` kilitlenmesini önle).

**Kabul:** `1.16.5` `title` (`action=0/1/2` ve `extra` parçalı JSON) ve `1.21.4` / `1.21.8` `set_title_text`, `set_title_subtitle`, `action_bar`, `{"": "..."}` NBT mesajları eksiksiz yakalanmalı; `"MyBot: /login <şifre>"` biçimli mesajlar `isSelfMessage` tarafından engellenmemeli; `LoginCalibrator` Title/Actionbar satırlarını göstermeli ve canlı sohbet akarken seçimler kaymamalı.

---

### Aşama 4 — Envanter, Konteyner ve Otomasyon Hataları (B17, B18, B19, B20)

1. **`1.20.5+` ve `1.21.2+` Envanter Senkronizasyonu (`public/bot-worker.cjs`):**
   - `isEmptyPacketItem(item)` yardımcısı yaz (`!item || item.present === false || item.itemCount === 0 || item.itemCount <= 0 || item.itemId === 0 || item.blockId === -1`). `set_slot` ve `window_items` dinleyicilerinde bunu kullan.
   - `bot-worker.cjs:469` içindeki `(bot.inventory?.slots || []).every(s => !s)` imleç temizleme koşulunu yalnızca `openWindow` yokken ve gerçek bir click işlemi sürmüyorken (ya da tamamen kaldırıp sunucu `set_slot`/`window_items` sinyaline bırakarak) düzelt ki son eşya imlece alınabilsin.
   - `1.21.2+` `set_cursor_item` ve `set_player_inventory` paketlerini `_client` üzerinde dinleyip imleci / slotu güncelle ve `scheduleInventory` tetikle.
2. **Fırın / Örs Ayrımı (`src/components/Inventory/ContainerModal.vue`):**
   - `isAnvil` içinden `|| win.containerSlotCount === 3` koşulunu kaldır; yalnızca `win.type` (`anvil` içeriyorsa) veya `win.type` boşsa başlık kontrolüyle belirle.
3. **`open-block`, `autoChestDump`, `autoFishing`, `interact-entity` (`public/bot-worker.cjs`, `public/builtin-automation.cjs`):**
   - `open-block` ve `chestDump()` içinde Mineflayer `openBlock`/`openContainer` yerine `activateBlock` + temizlenebilir (`removeListener`) `windowOpen` beklemesi (4 sn timeout) kullan; böylece kilitli/kapalı sandıkta `busy = true` ve `queues` sonsuza dek kilitlenmez ve dinleyici sızmaz.
   - `fish()` içinde `fishing.catch(() => {})` ekleyerek iptal/timeout sonrası `unhandledRejection`'ı engelle; `1.8–1.12` için `water` veya `flowing_water` kabul et.
   - `snapshotHeld()` / `restore()` içinde `item.components` karşılaştırması ekle (`1.20.5+`).
   - `interact-entity` içinde `activateEntity` (`hand: 0` uyumlu) kullanılmasını önceliklendir veya `1.9+` için `hand: 0` ile `use_entity` gönder.

**Kabul:** `1.21.4` test sunucusunda slottan eşya alındığında `{ itemCount: 0 }` imleci silmemeli; `furnace` penceresi Örs olarak görünmemeli; açılmayan sandıkta `autoChestDump` 4 sn içinde timeout'a düşüp `autoEat`/`autoTotem`'i kilitlememeli.

---

### Aşama 5 — Arayüz Kararlılığı ve İkonlar (B21)

1. **`PluginsPanel.vue`:** `watch(() => bot.value?.plugins, ...)` içinde `activeModuleId.value` açıkken veya gelen ayar JSON'u son senkronize edilenle aynıyken `draft.value`'yu ezme (yalnızca gerçekten dışarıdan/başlangıçta değiştiğinde veya modal kapalıyken güncelle).
2. **`PluginIcon.vue`:** `LUCIDE_NAMES` setine `'KeyRound'`, `'Compass'`, `'Check'`, `'Box'`, `'Lock'` (ve `AppIcon.vue`'da olup burada eksik kalan diğer kart ikonlarını) ekle.
3. **`PluginSettingsModal.vue`:** Satır 635'teki eski metni canlı yüklemeyi yansıtacak şekilde güncelle.
4. **`BotView.vue`:** `closeInventoryModal` içinde `status.value.state === 'connected'` kontrolü ekle.
5. **`IsoWorldView.vue`:** Entity isim etiketinden önce `ctx.textAlign = 'center'` ayarla; `headingMode === 'bot'` seçiliyse koordinat dönüşümünü uygula (veya yön modunun davranışını tutarlı kıl).

---

## 3. Detaylı Test Planı (Yüksek Hata İhtimalli Alanlar Dahil)

Mevcut 13 test neredeyse tamamen `1.16.5` mutlu senaryosuna odaklanmış durumda. Aşağıdaki testler **hem** bulunan hataları doğrulamalı **hem de** gelecekte kırılma ihtimali en yüksek protokol/yaşam döngüsü alanlarını kilitlemelidir.

### 3.1. Mevcut Testte Düzeltilecek Kör Nokta
- `tests/resource-pack.test.cjs`: Yalnızca UUID format regex'i yerine, sunucuya dönen `resource_pack_receive` paketindeki `uuid`'nin sunucunun gönderdiği `packUuid` ile **birebir eşit olduğunu** doğrula (`assert.equal(p.uuid, packUuid)`). Ayrıca `1.21.4` ve `1.21.8` senaryosunu + `remove_resource_pack` sonrası tekrar eklemeyi kapsa.

### 3.2. Eklenecek Yeni Otomatik Protokol ve Birim Testleri (`tests/*.test.cjs`)

| Test Dosyası | Doğruladığı Senaryo ve Yüksek Riskli Alan |
| --- | --- |
| `tests/auto-login-channels.test.cjs` | **B10, B11, B12, B13, B14:** `1.16.5` (`title` action 0/1/2 ve `extra`'lı JSON) + `1.21.4` (`set_title_text`, `set_title_subtitle`, `action_bar`, `{"": "..."}` NBT) üzerinden gelen login mesajlarının yakalanması; `"BotAdi: /login <şifre>"` mesajının `isSelfMessage` tarafından engellenmemesi; Title/Actionbar IPC mesajlarının yayılması. |
| `tests/version-resolution.test.cjs` | **B1, B2:** Mock ping sunucusunun Status `ping`'e (`pong`) hiç yanıt vermemesi hâlinde bile `resolveAutoVersion`'ın 5sn yarışında patlamaması; `1.18.1` (`757`), `1.17` (`755`), `1.16.1` (`736`) sunucularının `1.21.8`'e düşmeden kendi sürümüyle bağlanması; `enable-status`/ping kapalı durumda fallback davranışı. |
| `tests/limbo-auth.test.cjs` | **B3:** `update_health` göndermeyen (yalnızca `login` + `position` + `chat`/`open_window` gönderen) bir Limbo/Captcha sunucusunda botun 30 sn timeout'a düşmeden `connected` olması, `/login` gönderebilmesi ve `open_window` verisinin iletilmesi. |
| `tests/config-phase-errors.test.cjs` | **B4, B6:** `1.20.4`/`1.21.4` `configuration` fazında gelen non-fatal `Parse error`'ın botu `error` durumuna düşürmemesi; oyundayken gelen `start_configuration` sonrası `physics`/`antiAfk`/`commandScheduler` yüzünden `Serialization error` oluşmaması. |
| `tests/lifecycle-races.test.cjs` | **B7, B8:** Bağlantının ilk milisaniyelerinde (`inject_allowed` öncesi) `disconnect` gönderilince `TypeError` çıkmaması ve soketin kapanması; `BotManager` 30 sn bağlantı zaman aşımı sonrası `maxAttempts: 1` iken reconnect denemesinin çift sayılmaması; hızlı `disconnect` → `connect` arasında eski `disconnected` mesajının yeni oturumu bozmaması. |
| `tests/inventory-modern.test.cjs` | **B17, B19:** `1.21.4` sunucuda slottan eşya alınca `{ itemCount: 0 }` `set_slot` paketinin imleci silmemesi, `set_cursor_item` paketinin imleci güncellemesi ve son eşya imlece alındığında korunması; açılmayan/yanıtsız sandıkta `autoChestDump` timeout'unun 4–5 sn içinde çözülüp `autoEat` otomasyonunu kilitlememesi. |
| `tests/pattern-builder.test.cjs` | **B15:** Unicode çizgili (`━━━`, `═══`, `───`) çok satırlı login banner'ları, boş satır/duyuru atlama dayanıklılığı ve `listenTitleActionbar` alanının `pluginConfig.ts` üzerinden kalıcı kaydedilmesi. |

### 3.3. Canlı / Gerçek Sunucu & Manuel UI Doğrulama Listesi (Yüksek Hata İhtimalli Ortamlar)

Otomatik testler yerel `minecraft-protocol` sunucularını kullanır. Gerçek sunucu yazılımı ve proxy'lerin davranış farkları için Hydrogen sonrası aşağıdaki canlı kontroller planlanmalıdır:

1. **Sürüm & Proxy Matrisi:**
   - UI şu an `1.21.1`'e sabitli olduğu için canlı uygulama testlerinde **Paper / Vanilla `1.21.1`** ve **ViaVersion/ViaBackwards kurulu `1.21.4+` / `1.21.10+`** sunucularına `1.21.1` istemciyle bağlanma. (Worker seviyesindeki `1.8.8`, `1.16.5`, `1.18.1`, `1.21.4`, `1.21.8` desteği otomatik `tests/*.test.cjs` ile doğrulanır.)
   - Velocity veya BungeeCord proxy arkasında AuthLobby → Hub → Skyblock/Survival sunucu geçişi (`start_configuration`, çift `login`, `autoLobby`).
2. **Auth / Login Mesajı Kanalları:**
   - AuthMe / nLogin ile Chat banner (çok satırlı Unicode çizgili + renkli).
   - Title + Subtitle ile `/login` isteyen sunucu (`LoginCalibrator` içinde göründüğünü ve tek/çift satır yakalandığını doğrula).
   - Actionbar ile `/login` uyarısı basan `1.20+` Paper sunucu.
   - `update_health` göndermeyen Limbo / Sonar / BotFilter sunucusu.
3. **Resource Pack & Özel Menü:**
   - `1.20.4+` / `1.21.4+` zorunlu Resource Pack sunucusu (UUID doğrulaması + sunucu değişimi).
   - DeluxeMenus / ChestCommands `1.21.4` menüsü (eşyaya tıklayınca imleçte kalma yok, Furnace penceresi Örs olarak açılmıyor).
4. **UI Kararlılığı:**
   - Bot sunucudan aktif `pose`/`chat` alırken `Plugins` → `AutoLogin` modalını açıp şifre/kural yazarken metnin silinmediğini doğrula.
   - `AutoLogin`, `AutoLobby`, `AutoAccept`, `AutoChestDump` kart ikonlarının yazı değil SVG ikon gösterdiğini doğrula.
