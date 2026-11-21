# MynBot — Hata Raporu ve Düzeltme Planı

İnceleme tarihi: 16 Kasım 2026. Bu doküman yalnızca analizdir; kodda değişiklik yapılmadı.
Hedef: "Bazı sunucularda bağlantı, sohbete mesaj yazma ve eklentiler çalışmıyor" şikâyetinin kök nedenlerini düzeltmek.

> **Uygulayacak AI için not:** `ONARIM_PLANI.md` eski bir dosya kaybı planıdır, büyük kısmı zaten uygulanmış. Bu dosyayı esas al. Kod tabanı: Electron ana süreç (`electron/`), bot işlemi ayrı Node 22 sürecinde (`public/bot-worker.cjs` + `public/builtin-automation.cjs`), arayüz Vue 3 (`src/`). Bağımlılıklar: mineflayer 4.33.0, minecraft-protocol 1.62.0, minecraft-data 3.102.3.

## 0. Mevcut durum (doğrulandı)

- `vue-tsc --noEmit --incremental false`: hatasız.
- `tests/*.cjs` (4 test): hepsi geçiyor. Ancak testler yalnızca yerel 1.16.5 protokol sunucusunu ve ideal senaryoyu kapsıyor; aşağıdaki hataların hiçbirini yakalamıyor.
- Mineflayer 4.33'ün desteklediği **en yüksek sürüm 1.21.8**. minecraft-data da 1.21.8'de bitiyor.

---

## 1. Hata raporu

Önem: 🔴 Kritik (birçok sunucuda işlevi tamamen bozar) · 🟠 Yüksek · 🟡 Orta · ⚪ Düşük

### 🔴 H1 — Ölümcül olmayan protokol hataları botu "hata" durumuna sokuyor; sohbet ve tüm kontroller kilitleniyor
**Dosyalar:** `public/bot-worker.cjs` 1357–1362, `electron/services/botManager.ts` 129–156, 237–241

minecraft-protocol, paket ayrıştırma/serileştirme hatalarında (`Parse error for ...`, `Serialization error for ...`) bağlantıyı **kapatmadan** `error` olayı yayıyor (`node_modules/minecraft-protocol/src/client.js` 57–81: hata yayınlanır, pipe yeniden bağlanır, bağlantı sürer). Özel paket gönderen eklentili sunucularda, ViaVersion arkasındaki sunucularda bu çok sık olur.

Worker her `error` olayında `status(username, 'error')` gönderiyor. BotManager bunu alınca:
- envanter/poz/dünya verisini siliyor ve sonraki `inventory`/`pose`/`world` mesajlarını yok sayıyor (yalnızca `connected` durumda kabul ediliyor),
- `chat()`, `selectSlot()` vb. tüm komutlar `"Bot bağlı değil."` hatası veriyor,
- otomatik yeniden bağlanmayı planlıyor (bkz. H2).

Sonuç: Bot sunucuda hâlâ bağlıyken arayüz onu kopmuş sayıyor, **mesaj gönderilemiyor**. Belirti: "Bağlandı, ama mesaj yazınca 'Bot bağlı değil' diyor".

### 🔴 H2 — Yeniden bağlanma yarış durumu: bot sonsuza kadar "Bağlanıyor" durumunda kalıyor
**Dosyalar:** `public/bot-worker.cjs` 1136–1138, `botManager.ts` 38–64, 199–210

Worker'daki `connect` işleyicisi `if (bots.has(username)) return;` ile **hiçbir yanıt vermeden** dönüyor. H1'deki durumda (veya `kicked`→`end` arasında) bot worker haritasında hâlâ varken BotManager yeniden bağlanmayı çalıştırıp durumu `connecting` yapıyor; worker sessizce yok sayıyor. Durum asla güncellenmiyor, `connect()` artık `"Bot zaten bağlanıyor veya bağlı."` hatası veriyor. Kullanıcı ancak manuel "Bağlantıyı kes" ile kurtulabiliyor.

### 🔴 H3 — Resource pack işleme bozuk paket gönderiyor (1.20.3+ sunucularda H1'i tetikliyor)
**Dosya:** `public/bot-worker.cjs` 1164–1205, 1349–1355

- Aynı paket için hem ham `_client` dinleyicisi (`resource_pack_send`/`add_resource_pack`) hem mineflayer `resourcePack` olayı `registerResourcePack` çağırıyor → her pakette 2× `acceptResourcePack()` + 2× elle yazma = 6–8 `resource_pack_receive` paketi.
- 1.20.3+ sürümlerde mineflayer `resourcePack` olayına UUID'yi **nesne** (`uuid-1345`) olarak veriyor; worker sadece string arıyor → `uuid` undefined → `{ result: 3 }` uuid'siz yazılıyor. **Doğrulandı:** 1.20.4 ve 1.21.4 serileştiricisi bu pakette `Write error ... Cannot read properties of undefined (reading 'length')` hatası üretiyor → client `error` → H1 → sohbet kilitleniyor.
- Fazladan "SUCCESSFULLY_LOADED" paketleri, kaynak paketi zorunlu tutan bazı sunucu eklentilerinde atılmaya yol açabilir.

Belirti: Resource pack zorunlu (çoğu modern ağ/lobi) sunucularda bağlandıktan hemen sonra "hata" durumu.

### 🔴 H4 — Yüklenmemiş chunk'larda sahte "hava" bloğu: bot düşüyor, anti-cheat atıyor
**Dosya:** `public/bot-worker.cjs` 421–460 (`ensurePhysicsAndFallbackAir`), ayrıca 533, 1209, 1254, 1595, 1637, 1732

Mineflayer fizik motoru, chunk yüklenmemişken `bot.blockAt(pos) == null` kontrolüyle fiziği **bilerek durdurur** (`node_modules/mineflayer/lib/plugins/physics.js` 79). Worker `blockAt`'i yamalayıp `null` yerine sahte hava döndürüyor; böylece bot yüklenmemiş dünyada serbest düşüyor ve sunucuya gerçek dışı konum paketleri gönderiyor. Ayrıca fizik "her zaman açık" olarak zorlanıyor (`set-physics` false'u yok sayıyor).

Sonuç: Chunk'ları geç gönderen sunucularda (büyük ağlar, proxy sunucu geçişleri, limbo/anti-bot doğrulaması — Sonar, BotFilter, Grim vb.) bot "Flying is not enabled", "Invalid move", "Bot doğrulaması başarısız" ile atılıyor ya da boşluğa düşüp ölüyor. **Belirti: "Bazı sunuculara bağlanıyor ama birkaç saniyede atılıyor."**

### 🔴 H5 — Desteklenmeyen sürümdeki sunucu tüm bot işlemini çökertiyor
**Dosyalar:** `public/bot-worker.cjs` (genel; `uncaughtException` işleyicisi yok), `node_modules/minecraft-protocol/src/client/autoVersion.js` 31–34

Sürüm "Otomatik" iken sunucu protokolü minecraft-data'da yoksa (örn. 1.21.9/1.21.10/1.21.11 — 1.21.8 sonrası her şey) `autoVersion` önce `error` yayıyor, sonra `versions[0].minecraftVersion` satırında **TypeError fırlatıyor**. Bu, ping soketi geri çağrısında olduğu için yakalanamıyor ve worker süreci ölüyor. Worker tüm botları barındırdığından **diğer bağlı botlar da kopuyor.** Hata mesajı da kullanıcıya anlamlı ulaşmıyor (stderr kırpıntısı).

Ek olarak: Proxy sunucular (Velocity/Bungee) ping'de "Velocity 1.7.2-1.21.10" gibi adlar döndürebiliyor; isimden tahmin yanlış sürüm seçebiliyor. Kullanıcı sürüm alanına serbest metin girebiliyor (`BotView.vue` 508), desteklenmeyen sürüm girişi doğrulanmıyor.

### 🟠 H6 — Kimlik doğrulama `offline` sabit: online-mode (premium) sunuculara bağlanılamıyor
**Dosya:** `public/bot-worker.cjs` 1148 (`auth: 'offline'`), `src/types/bot.ts` `BotConfig`

Online-mode sunucular "Failed to verify username" ile reddediyor. Arayüzde Microsoft hesabı seçeneği yok. (Bu bir tasarım eksikliği; en azından kullanıcıya açık hata mesajı verilmeli.)

### 🟠 H7 — Actionbar/oyun bilgisi mesajları sohbete ve desen eşleştiricisine karışıyor
**Dosya:** `public/bot-worker.cjs` 1329–1348

`instance.on('message', jsonMsg => ...)` ikinci parametre olan `position`'ı yok sayıyor. Mineflayer actionbar (`game_info`) mesajlarını da `message` olayıyla yayıyor. Modern sunucularda actionbar saniyede birkaç kez güncellenir:
- Sohbet paneli actionbar spamıyla doluyor (200 satır sınırı gerçek sohbeti itiyor).
- `recentLines` / `recentLoginLines` (20 satır, 3 sn pencere) actionbar satırlarıyla bölünüyor → **çok satırlı sohbet desenleri ve otomatik giriş desenleri asla eşleşmiyor**.
- Otomatik sohbet/kabul kuralları actionbar metnine tepki verebiliyor.

Ayrıca auth eklentilerinin çoğu "/login" talimatını **title/subtitle** veya actionbar ile gönderiyor; bu kanallar otomatik girişe hiç bağlı değil.

### 🟠 H8 — Harici eklentiler (scripts) yanlış zamanda ve yanlış modül yoluyla yükleniyor
**Dosya:** `public/bot-worker.cjs` 1066–1102, 1158–1163, 1213, 1385–1400; `electron/services/pluginDirectory.ts` (örnek eklenti)

1. `loadExternalPlugins` **`login` anında** (spawn'dan önce) çağrılıyor; `bot.entity`, `bot.inventory` içeriği, dünya henüz yok → `setup` içinde bunlara erişen eklentiler hata veriyor.
2. Eklentiler `userData/plugins` klasöründen `require` ediliyor; orada `node_modules` olmadığından `require('mineflayer-pathfinder')`, `require('vec3')` gibi çağrılar **"Cannot find module"** ile başarısız oluyor.
3. `update-plugins` (bağlıyken eklenti aç/kapat) harici scriptleri yeniden yüklemiyor/kaldırmıyor; değişiklik ancak yeniden bağlanınca etkili oluyor ama arayüz bunu söylemiyor.
4. Örnek eklenti `bot.on('chat', ...)` kullanıyor. Mineflayer `chat` olayı yalnızca vanilla `<isim> mesaj` biçiminde tetiklenir; özel sohbet formatlı (EssentialsChat, LuckPerms prefix'li vb.) sunucularda **hiç tetiklenmez**. Örnek, `ctx.onParsedChat` kullanmalı.

### 🟠 H9 — `lastSentText` öz-mesaj filtresi fazla geniş; otomatik eklentileri susturuyor
**Dosya:** `public/bot-worker.cjs` 795, 834, 889 (ve `lastSentText` atanan tüm yerler: 738, 814, 866, 911, 959, 983)

Tüm özellikler tek bir `lastSentText` paylaşıyor ve hiç temizlenmiyor. `raw.includes(state.lastSentText)` kontrolü, botun en son gönderdiği metni **içeren her sunucu mesajını** sonsuza kadar yok sayıyor. Örn. otomatik yanıt "selam" gönderildiyse, içinde "selam" geçen sonraki tüm mesajlar otomatik giriş/kabul/sohbet için görünmez olur. Zamanlayıcı "/spawn" gönderdiyse "Teleporting to /spawn" benzeri satırlar yok sayılır.

Öz-mesaj filtresi yalnızca `<isim>` ve `[isim]` öneklerini tanıyor; `[Rütbe] isim » mesaj` gibi formatlarda bot kendi mesajına yanıt verebiliyor (cooldown dışında koruma yok).

### 🟡 H10 — Giriş mesajı (joinMessage) giriş yapılmadan gönderiliyor
**Dosya:** `public/bot-worker.cjs` 728–746, 1158–1163

Otomatik sohbetin giriş mesajı `login` anından 800 ms sonra gönderiliyor; auth eklentili sunucularda bot henüz `/login` yapmamış oluyor → mesaj engelleniyor veya "önce giriş yapın" uyarısı/atılma. Spawn'dan sonra ve (otomatik giriş açıksa) giriş komutu gönderildikten sonra gönderilmeli.

### 🟡 H11 — `connected` durumu spawn'dan önce ve her respawn'da yeniden yayınlanıyor
**Dosya:** `public/bot-worker.cjs` 1211, 1255

`login` olayında `connected` gönderiliyor; 1.20.2+ configuration aşaması/proxy sunucularda dünya henüz hazır değil. Her `spawn` (ölüm, boyut değişimi, proxy sunucu geçişi) yeniden `connected` gönderip log'a "Bağlantı kuruldu" yazıyor ve yeniden bağlanma sayaçlarını sıfırlıyor. Kullanıcıya yanıltıcı.

### 🟡 H12 — Otomasyon "Manuel işlem bekleniyor" durumunda kilitlenebiliyor
**Dosyalar:** `public/builtin-automation.cjs` 150 (`blocked()`), `public/bot-worker.cjs` 1537–1538

`blocked()` açık pencere (`currentWindow`), imleçte eşya veya `manualControls` boş değilse otomasyonu durduruyor. Klavye bırakma olayı kaybolursa (`set-control` true gönderilip false gelmezse, pencere kapanırsa) `manualControls` dolu kalıyor; sunucu menüsü açık kalırsa `currentWindow` dolu kalıyor → otomatik yemek/zırh/totem/savunma/balık **hiç çalışmıyor**. Zaman aşımı yok. Bot penceresi kapatılırken kontrollerin bırakıldığı garanti değil.

### 🟡 H13 — Otomatik kabul beyaz listesi kısmi eşleşmeye açık
**Dosya:** `public/bot-worker.cjs` 902

`lowerRaw.includes(name)`: beyaz listede "ali" varsa "alice", "kalin" vb. herkesin isteği kabul ediliyor. Güvenlik açığı.

### 🟡 H14 — Worker'da genel hata yakalama yok
**Dosya:** `public/bot-worker.cjs` 1135–1748, 1750–1756

`process.on('uncaughtException' | 'unhandledRejection')` yok. Mineflayer iç eklentileri, harici scriptler veya H5 gibi kütüphane hataları tek bir sunucu yüzünden tüm botları düşürüyor. Mesaj işleyicideki `bot.username` gibi erişimler de korumasız.

### ⚪ H15 — Diğer
- Sohbet gönderim hataları worker'da asenkron `operation-error` olarak geliyor; arayüz bunu sadece log'a yazıyor, sohbet kutusunda kullanıcıya göstermiyor (`BotView.vue` 300, `botManager.ts` 168–170).
- `main.ts` 108: bot penceresini kapatmak botun bağlantısını kesiyor. Tasarım tercihi olabilir; arayüzde belirtilmeli.
- Node 22 gereksinimi (`botManager.ts` 83–93): sistemde Node 22+ yoksa hiçbir bağlantı çalışmaz. Hata mesajı var ama kullanıcı kurulumu belgelenmeli.
- `autoTotem` 1.8 sunucularda (off-hand yok) her 2 sn'de hata döngüsüne giriyor.

---

## 2. Belirti → kök neden eşlemesi

| Kullanıcının gördüğü | Muhtemel nedenler |
| --- | --- |
| Bağlanıyor ama mesaj gönderilemiyor ("Bot bağlı değil") | H1, H3 |
| Durum "Bağlanıyor"da takılı kalıyor | H2 (H1/H3 sonrası) |
| Birkaç saniyede atılıyor / boşluğa düşüyor | H4, H3, H10 |
| Hiç bağlanmıyor, diğer botlar da kopuyor | H5, H14 |
| Premium sunucuya bağlanmıyor | H6 |
| Otomatik giriş / sohbet desenleri çalışmıyor | H7, H9 |
| Harici eklentiler hata veriyor veya tepki vermiyor | H8 |
| Otomatik yemek/zırh/savunma çalışmıyor | H12, H1 (durum hatası) |

---

## 3. Düzeltme planı (sırayla uygula)

Genel kurallar:
- Her aşamadan sonra `./node_modules/.bin/vue-tsc --noEmit --incremental false` ve `for t in tests/*.cjs; do node $t; done` çalıştır; ikisi de geçmeli.
- Strict TypeScript ayarlarını gevşetme, hataları `any`/`@ts-ignore` ile gizleme.
- `node_modules` içini **değiştirme**; kütüphane hatalarına uygulama tarafında çözüm üret.
- Her anlamlı değişiklikten sonra `STATUS.md` sonuna tarihli kayıt ekle (dosyanın kendi kuralı).

### Aşama 1 — Bağlantı durumu doğruluğu (H1, H2, H11, H14)

1. `bot-worker.cjs` `instance.on('error')`:
   - Hatayı her zaman `logLine` ile log'a yaz.
   - Bağlantı henüz kurulmadıysa (`login` olmadı) mevcut davranışı koru: `failure` sakla, `status('error')`.
   - Bağlantı kurulduktan sonra `status('error')` **gönderme**; sadece log/`operation-error` gönder. Bağlantının gerçek sonu her zaman `end` olayıdır; durum orada belirlenmeli.
   - `kicked` için de `status` göndermeyi `end`'e bırak (nedeni `failure` değişkeninde sakla). Böylece `error`/`disconnected` durumu yalnızca bot worker haritasından silindikten sonra gelir.
2. Worker `connect` işleyicisi: `bots.has(username)` ise sessizce dönme. Eski örnek gerçekten açıksa ya `status(username, 'connected')` gönder ya da eski örneği temizleyip (`cleanupPlugins` + `quit` + `bots.delete`) yenisini başlat. Her iki durumda da BotManager'a mutlaka bir durum mesajı dönmeli.
3. `connected` durumunu yalnızca ilk `spawn`'da gönder (bağlantı başına bir kez); `login`'de en fazla `connecting` mesajı güncelle ("Dünya yükleniyor"). Sonraki spawn'larda durum mesajı gönderme, gerekirse sadece log.
4. BotManager `scheduleReconnect`: bağlanma denemesi bir süre (örn. 30 sn) içinde `connected`/`error`/`disconnected` almazsa durumu `error` yap ("Bağlantı zaman aşımı") ve worker'a `disconnect` gönder. Bu, gelecekteki benzer takılmalara karşı güvenlik ağıdır.
5. Worker'a `process.on('uncaughtException')` ve `process.on('unhandledRejection')` ekle: hatayı ilgili bota (bilinmiyorsa tüm botlara) `log` olarak gönder, süreci **kapatma**. Mesaj işleyicinin gövdesini try/catch ile sar; `bot?.username` doğrulaması yap.

**Kabul:** Bağlı bir bota ham `instance._client.emit('error', new Error('test'))` tetiklendiğinde durum `connected` kalmalı ve sohbet çalışmalı. `kicked` sonrası otomatik yeniden bağlanma takılmadan başarılı olmalı.

### Aşama 2 — Sürüm uyumluluğu (H5)

1. Bağlanmadan önce worker'da sunucuyu `require('minecraft-protocol').ping({ host, port })` ile pingle (zaman aşımlı, örn. 5 sn).
   - Kullanıcı sürüm girmemişse: `response.version.protocol` değeri `minecraft-data` `postNettyVersionsByProtocolVersion.pc` içinde **ve** `mineflayer.testedVersions` içinde varsa o sürümü kullan.
   - Yoksa (daha yeni sunucu): log'a "Sunucu sürümü X desteklenmiyor, 1.21.8 ile deneniyor (ViaVersion gerektirir)" yaz ve `version: mineflayer.latestSupportedVersion` ile bağlan. `createBot`'a **her zaman açık bir sürüm** geçir; böylece kütüphanedeki çökme yolu (`autoVersion`) hiç çalışmaz.
   - Ping başarısız olursa anlamlı hata ile `status('error')` gönder.
2. `electron/services/botRepository.ts` `validateBot`: `version` verilmişse `mineflayer.testedVersions` (veya minecraft-data destek listesi) içinde olduğunu doğrula; değilse açıklayıcı hata ("Desteklenen sürümler: 1.8.8 – 1.21.8"). Electron ana sürecinde mineflayer'ı yüklemek istemiyorsan listeyi worker'dan bir kez sorgulayıp sakla ya da sabit bir liste dosyası oluştur.
3. `BotView.vue` sürüm alanını serbest metin yerine "Otomatik" + desteklenen sürümler listesi içeren `<select>`/datalist yap.

**Kabul:** Protokolü desteklenmeyen sahte bir ping yanıtı veren yerel sunucuya bağlanma denemesi worker'ı çökertmemeli; diğer bağlı botlar etkilenmemeli.

### Aşama 3 — Resource pack (H3)

1. Kaynak paketi işlemesini **tek yere** indir: yalnızca mineflayer'ın `resourcePack` olayını dinle (ham `_client` `resource_pack_send`/`add_resource_pack` dinleyicilerini ve `attachClientPackListeners`'ı kaldır).
2. Olay parametrelerinden URL'yi bul (string ve `http(s)://` ile başlayan); UUID nesne olabileceği için `String(arg)` ile normalize et.
3. Kabul için **sadece** `instance.acceptResourcePack()` çağır; elle `resource_pack_receive` yazma bloğunu tamamen kaldır. Mineflayer doğru sürüme göre (hash/UUID) iki paketi zaten gönderiyor.
4. Aynı UUID/URL için ikinci kez kabul gönderme (bağlantı başına bir `Set` tut, `end`'de temizle).
5. Configuration aşamasında (1.20.2+) gelen paketlerin de işlendiğini yerel testle doğrula; mineflayer işlemiyorsa bunu yalnızca o durum için, `instance._client.state === 'configuration'` kontrolüyle ve doğru `uuid` ile ele al.

**Kabul:** 1.20.4 ve 1.21.4 yerel test sunucusunda `add_resource_pack` gönderildiğinde istemci tarafında `Serialization error` oluşmamalı; sunucu tam olarak bir ACCEPTED + bir SUCCESSFULLY_LOADED almalı.

### Aşama 4 — Fizik ve hareket (H4)

1. `ensurePhysicsAndFallbackAir` içindeki `blockAt` yamasını **tamamen kaldır**. `bot.blockAt` orijinal davranışına (yüklenmemiş chunk → `null`) dönmeli.
2. `_isFallbackAir`, `_origBlockAt` kullanımlarını temizle; `sendPose` içindeki `chunkLoaded` hesabını doğrudan `bot.blockAt(pos) !== null` ile yap.
3. Fiziği zorla açan satırları kaldır (`instance.physicsEnabled = true` her yerde). `set-physics` gerçekten `enabled` değerini uygulasın (varsayılan açık kalsın).
4. `step-control` ve `move-to` işleyicileri chunk yüklü değilse (`blockAt` null) hareketi başlatmasın, kullanıcıya "Dünya henüz yüklenmedi" hatası dönsün. `sendWorld` zaten `null`'ları atlıyor; davranışı koru.
5. Bu yamanın neden eklendiğini `STATUS.md`'de kontrol et (muhtemelen arayüzde hareketin "donması"). Gerçek neden chunk yüklenmemesiyse, arayüzde "chunk yükleniyor" göstergesi yeterli olmalı.

**Kabul:** Chunk göndermeyen yerel sunucuda bot Y ekseninde düşmemeli ve sunucuya konum değişimi göndermemeli.

### Aşama 5 — Sohbet akışı ve desen eşleştirme (H7, H9, H10)

1. `instance.on('message', (jsonMsg, position) => ...)`:
   - `position === 'game_info'` ise sohbet listesine ekleme, `tryParseChat`/`handleAutoLogin`/`handleAutoChat`/`handleAutoAccept`'e **gönderme**. İstenirse ayrı bir `actionbar` alanı olarak arayüze gönder (son değer, liste değil).
2. Otomatik giriş için ek kaynak: mineflayer `title` olayı (ve varsa actionbar) metnini `handleAutoLogin`'e ayrı bir yoldan ilet; bu kaynaklar sohbet desen tamponuna karışmamalı. Ayarlarda "title/actionbar mesajlarını da dinle" seçeneği ekleyebilirsin (varsayılan açık).
3. `lastSentText` yerine kısa ömürlü bir "gönderilenler" listesi tut: `{ text, at }`, en fazla 10 kayıt, 5 sn sonra geçersiz. Öz-mesaj kontrolü: satır **tam olarak** gönderilen metinle bitiyor/eşleşiyorsa *ve* son 5 sn içindeyse yok say. `includes` ile kalıcı kısmi eşleşmeyi kaldır.
4. Öz-mesaj tespiti için ayrıca: `parsed.sender` varsa onu kullan (zaten var); `parsed` yoksa satırda kullanıcı adının kelime sınırıyla geçip geçmediğine ve ardından `»`, `:`, `>` gibi ayraçlara bak.
5. `triggerJoinChat`'i `login`'den çıkarıp ilk `spawn` sonrasına taşı. Otomatik giriş açık ve deseni varsa, giriş komutu gönderildikten sonra (veya en geç 10 sn sonra) gönder.

**Kabul:** Saniyede 5 actionbar güncellemesi yapan yerel sunucuda 2 satırlı özel mesaj deseni ve otomatik giriş deseni eşleşmeli; sohbet paneli actionbar ile dolmamalı. Bot "selam" gönderdikten 10 sn sonra gelen "selam" içerikli sunucu mesajı otomatik kurallarca işlenmeli.

### Aşama 6 — Harici eklentiler (H8)

1. `loadExternalPlugins`'i `login` yerine ilk `spawn`'a taşı (bağlantı başına bir kez, `initPluginsOnce` mantığı korunarak).
2. Modül çözümleme: eklenti `require` edilmeden önce uygulamanın `node_modules` yolunu çözümleme yollarına ekle. Seçenekler:
   - Worker'ı başlatırken `botManager.ts` `fork` env'ine `NODE_PATH=<uygulama kökü>/node_modules` ekle ve worker başında `require('module').Module._initPaths()` çağır; **veya**
   - `ctx.require = createRequire(path.join(appRoot, 'package.json'))` sağla ve örnek eklentide/belgelerde bunu kullan.
   Her iki durumda da paketlenmiş uygulamada (`asar: false`, `resources/app/node_modules`) yolun doğru olduğunu doğrula.
3. `ctx`'e `ctx.bot` ve `ctx.onSpawn(fn)` gibi yardımcılar ekle; eklentinin hazır olmayan duruma erişmesini engelle.
4. `update-plugins` geldiğinde `enabledScripts` değiştiyse: mevcut harici eklentilerin cleanup'larını çalıştır (yalnızca harici script cleanup'larını; yerleşik otomasyonları bozmadan — cleanup listesini script adına göre ayrı tut) ve yeni listeyi yükle. Bunu yapmak istemiyorsan arayüzde "Değişiklik yeniden bağlanınca uygulanır" uyarısı göster.
5. `pluginDirectory.ts` örnek eklentisini `bot.on('chat')` yerine `ctx.onParsedChat(parsed => ...)` (ve gerekirse `bot.on('messagestr')`) kullanacak şekilde güncelle; desen tanımlanmamışsa ne olacağını yorumla açıkla.
6. Eklenti hatalarını eklenti adıyla birlikte arayüzdeki eklenti panelinde göster (şu an sadece log).

**Kabul:** `require('vec3')` kullanan bir test eklentisi `userData/plugins` içinden yüklenebilmeli; `setup` içinde `bot.entity.position` okunabilmeli.

### Aşama 7 — Otomasyon ve güvenlik (H12, H13)

1. `manualControls` için zaman aşımı: her `set-control true` kaydı zaman damgası tutsun; 10 sn içinde yenilenmeyen kontrol otomatik bırakılsın (`setControlState(false)` + setten sil). `step-control` işleyicisindeki anlamsız `state` kontrolünü kaldır (bu mesajda `state` alanı yok).
2. Bot penceresi kapanırken ve `blur`'da arayüz tüm kontrolleri bırakıyor (`IsoWorldView.vue` 685); worker tarafında da `disconnect`/`end`'de `manualControls` temizleniyor — doğrula.
3. `blocked()`: `currentWindow` uzun süre (örn. 15 sn) açık kalıyorsa ve kullanıcı etkileşimi yoksa otomasyon kritik işler (totem, yemek, panik) için engeli aşabilsin veya pencereyi kapatsın. En azından durum mesajı "Açık pencere nedeniyle bekleniyor" olarak ayrıştırılsın.
4. `handleAutoAccept` beyaz liste: `includes` yerine `parsed.sender` ile tam eşleşme; `parsed` yoksa kelime sınırlı regex (`\bisim\b`, regex özel karakterleri kaçırılmış). Kısmi eşleşmeyi kaldır.
5. `autoTotem`: `bot.supportFeature('doesntHaveOffHandSlot')` (veya sürüm < 1.9) ise "Bu sürümde desteklenmiyor" durumu ver, döngüye girme.

### Aşama 8 — Kimlik doğrulama (H6) — isteğe bağlı/ayrı iş

1. `BotConfig`'e `auth?: 'offline' | 'microsoft'` ekle (varsayılan `offline`; mevcut kayıtlarla geriye uyumlu). `botRepository.validateBot` ve `BotView` formunu güncelle.
2. Worker `createBot`'a `auth` değerini geçir. Microsoft için `profilesFolder` olarak `app.getPath('userData')/auth` kullan; cihaz kodu (`onMsaCode`) mesajını arayüze ilet. Belirteçleri `bots.json`'a yazma.
3. Bu yapılmayacaksa en azından: atılma nedeni "Failed to verify username" / "multiplayer.disconnect.unverified_username" içeriyorsa kullanıcıya "Bu sunucu premium hesap istiyor; MynBot şu an yalnızca offline hesapları destekliyor" mesajı göster.

### Aşama 9 — Arayüz geri bildirimi (H15)

1. Sohbet gönderiminde worker'dan gelen `operation-error` mesajlarını ilgili bot için son hata olarak sakla ve sohbet kutusunun altında göster.
2. Bot penceresini kapatmanın bağlantıyı keseceğini kapatma butonunun ipucu metninde belirt (veya onay iste).

---

## 4. Eklenecek testler

`tests/automation-protocol.test.cjs`'deki yerel minecraft-protocol sunucusu kalıbını kullanarak yeni test dosyaları ekle (gerçek dış sunucu kullanma):

| Test | Doğruladığı |
| --- | --- |
| `tests/nonfatal-error.test.cjs` | Bağlıyken client `error` olayı → durum `connected` kalır, `chat` çalışır (H1) |
| `tests/reconnect-race.test.cjs` | `kicked` + otomatik yeniden bağlanma → `connecting`'de takılmaz (H2) |
| `tests/resource-pack.test.cjs` | 1.20.4/1.21.4'te `add_resource_pack` → tam 2 yanıt paketi, serileştirme hatası yok (H3) |
| `tests/unloaded-chunk.test.cjs` | Chunk gönderilmeyen sunucuda bot düşmez (H4) |
| `tests/unsupported-version.test.cjs` | Desteklenmeyen protokol ping'i → worker çökmez, anlamlı hata (H5) |
| `tests/actionbar-patterns.test.cjs` | Actionbar spamı altında çok satırlı desen ve otomatik giriş eşleşir (H7) |
| `tests/self-filter.test.cjs` | `lastSentText` sonrası gelen benzer mesaj 5 sn sonra işlenir (H9) |
| `tests/external-plugin.test.cjs` | Eklenti `require('vec3')` yapabilir, spawn sonrası yüklenir (H8) |
| `tests/auto-accept-whitelist.test.cjs` | "ali" beyaz listesi "alice"i kabul etmez (H13) |

`package.json`'a `"test": "for t in tests/*.test.cjs; do node $t || exit 1; done"` betiği ekle.

## 5. Son kabul kontrolü

1. `vue-tsc --noEmit --incremental false` → 0 hata.
2. `npm test` → tüm testler geçer.
3. `./node_modules/.bin/vite build` başarılı.
4. Gerçek sunucu testleri (izinli sunucularda, kullanıcı yapacaksa listele): offline-mode vanilla 1.21.8, ViaVersion'lı 1.21.10+ sunucu, resource pack zorunlu bir sunucu, auth eklentili (AuthMe/nLogin) bir sunucu. Denenemeyenleri raporda "doğrulanmadı" olarak açıkça belirt.
5. Yapılan değişiklikleri, test sonuçlarını ve doğrulanamayan davranışları `STATUS.md`'ye tarihli kayıt olarak ekle.
