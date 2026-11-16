# MynBot / MynCraft — Çalışma durumu

Bu dosya sohbetler arasında devamlılık içindir. **Her anlamlı değişiklikten sonra alta yeni tarihli kayıt ekle; eski kayıtları silme.** Yapılanları kısa maddelerle belirt. Planlananı veya denenmeyeni tamamlandı gibi yazma. Kod uygulaması kullanıcı tarafından onaylandı; uygulamayı Terra alt ajanına yaptırma tercihi var.

## Güncel durum

- Vue 3 / TypeScript / Pinia / Electron uygulaması çalışır ve derlenir durumda.
- Modern dikey bot listesi, geniş bot paneli, Minecraftia fontu, ayrı sohbet/envanter sekmeleri ve rastgele arka planlar uygulandı.
- Canva referansına göre tam envanter ve fare/klavye etkileşimleri uygulandı; ilk dikey bot listesi penceresi sabit boyutlu yapılandırıldı. Ortama bağlı doğrulama sınırları aşağıda kaydedildi.
- `Plugins` sekmesi: Auto-Reconnect, Anti-AFK, Auto-Chat, AutoEat, AutoArmor, AutoFishing ve yerel `.js`/`.cjs` yükleyici mevcut. Yeni otomasyonların planı `PLUGIN_PLAN.md`; test kapsamı son kayıtta. İzole Electron renderer önizlemesi çalıştırıldı; gerçek sunucuda balık yakalama denenmedi.
- 15 Kasım tasarım yenilemesi uygulandı: sistem emojileri Lucide SVG ikonlarıyla değiştirildi; üst araç grupları, saydam cam yüzeyler ve 8/12/16 px köşe ölçeği düzenlendi. İzole renderer önizlemeleri aşağıdaki son kayıtta.

## 14 Kasım 2026 — Hasarlı projenin incelenmesi

- Eksik router ve bot store modülleri, eksik Electron API'si, devre dışı bot listesi ve ikon referansları bulundu.
- Bu çalışma ortamında `.git` boş görünüyor; kullanılabilir Git geçmişi/uzak depo yok. Eski dosyaların tamamının adları ve içerikleri kesin çıkarılamadı.
- İlk inceleme ve onarım önerileri `ONARIM_PLANI.md` içine yazıldı.
- İlk onarım yaklaşımı eski menüleri korumak yerine yeni arayüz üretti; kullanıcı bunu istemediğini belirtti. Bundan sonraki görünüm kararları kullanıcının açıklamaları ve Figma tasarımı üzerinden ilerledi.

## 14 Kasım 2026 — Kullanıcının açıklamaları ve Figma tasarımı

- İlk pencere dikey dikdörtgen bot başlatıcısı: bot adı alanı, yanında Ekle, altında liste ve silme.
- Bot satırının en sağındaki yeşil/gri nokta panelin açık/kapalı durumunu gösterir. Minecraft sunucusuna bağlantı durumu ayrıca panelde gösterilir.
- Bot satırına basınca o bot için ayrı yönetim penceresi açılır.
- `public/Splash.png` arka plan değildir: uygulama açılışında gösterilip fade ile kaybolan görseldir.
- Figma dosyası: https://www.figma.com/design/7snyh8zGEkcAoOBhxsgTc6/MynCraft
- Yeni tasarım alanı: https://www.figma.com/design/7snyh8zGEkcAoOBhxsgTc6/MynCraft?node-id=2006-44
- Dört düzenlenebilir Figma ekranı oluşturuldu: splash, boş bot listesi, dolu bot listesi, geniş bot yönetim paneli. Eski Figma ekranları korundu.
- Figma Starter araç çağrı limiti doldu. Son küçük hizalama düzeltmeleri ve tıklanabilir prototip Figma'da tamamlanmadı. Bu engel uygulama geliştirmesini durdurmuyor.
- Kullanıcı tasarımı beğendi; sol menüye Envanter, ayrı Canlı sohbet ve en altta Plugins istedi. Ardından tasarımın koda uygulanmasını açıkça onayladı.
- Minecraft fontu `public/fonts/Minecraftia-Regular.ttf`; font ailesi **Minecraftia / Regular**. Kısa başlık/markada kullanılıyor, uzun metin ve formlar okunaklı sans fontla kalıyor.
- Görsel referans proje içinde saklandı: [Figma tasarım görüntüsü](docs/screenshots/figma-design-reference.png).

## 14 Kasım 2026 — Terra tarafından tamamlanan uygulama

- Router/store/Electron köprüsü üzerinden bot ekleme, silme, ayar kaydı ve ayrı bot pencereleri çalışıyor.
- Ana pencere dikey; bot yönetim paneli geniş. Sol menü: Genel bakış, Sunucu ayarları, Envanter, Canlı sohbet; altta Plugins.
- Sunucu ayarları bot paneline taşındı. Bot oluştururken yalnızca isim isteniyor; başlangıç adresi `localhost:25565`.
- Splash yalnızca ana pencerenin ilk açılışında gösteriliyor; 1,3 saniye sonra 0,65 saniyelik fade ile kalkıyor.
- Teknik konsol ile oyuncu sohbeti ayrıldı; mesaj gönderme gerçek Mineflayer `chat` çağrısına bağlı. Sohbet geçmişi sınırlı; kullanıcı alttaysa yeni mesajlar takip ediliyor.
- Envanter şu an **27 ana yuva + 9 hotbar** gösteriyor. Gerçek eşya adı/adedi ve hotbar seçimi mevcut. Henüz tam vanilla envanter/taşıma/drop arayüzü değil.
- Worker'ın spawn, envanter, chat ve bağlantı kesme olayları IPC ile arayüze aktarılıyor. Eski bot örneğinin olaylarının yeni bağlantıyı kirletmesine karşı kontrol eklendi.
- Gerçek testte bulunan `instance.inventory` henüz hazır değilken dinleyici kurma hatası düzeltildi; envanter dinleyicileri spawn sırasında kuruluyor.
- Plugins için çalışan bir eklenti motoru varmış gibi davranılmıyor; özellik sonraya bırakıldı.

## 14 Kasım 2026 — Rastgele duvar kâğıtları

- Bot kontrol panelinin arka planı her yeni pencere açılışında rastgele seçiliyor.
- Köşedeki yenileme düğmesi yeni görseli önceden yüklüyor, ardından crossfade yapıyor. Aynı görsel art arda seçilmiyor.
- Yükleme/geçiş boyunca yenileme kilitli; hızlı tıklama, başarısız görsel, unmount ve azaltılmış hareket tercihi ele alındı.
- Görseller yerel `public/wallpapers` klasöründen kullanılıyor; uygulama internetten görsel çekmiyor.
- İki yeni **3840 × 2160** Minecraft görseli eklendi: `gothic-temple-4k.jpg`, `sunset-coast-4k.jpg`.
- Kaynaklar ve ayrı görsel lisansı `public/wallpapers/CREDITS.md` içinde. MinePix görselleri **CC BY-NC-SA 3.0**; uygulamanın MIT lisansına dahil değiller. Mevcut beş görselin eski kaynakları bu kopyada kayıtlı değildi.

## 14 Kasım 2026 — Tamamlanan doğrulamalar

- `vue-tsc --noEmit --incremental false`: başarılı.
- `vite build`: başarılı; iki yeni 4K görsel çıktıya dahil. Wallpaper listesi yalnızca görsel dosyalarını alıyor, `CREDITS.md` almıyor.
- İzole Electron profiliyle bot ekleme/silme, panel açma, çevrimdışı chat reddi, envanter sekmesi, arka plan yükleme ve yenileme kilidi test edildi.
- Node 22 altında **gerçek localhost Minecraft 1.16.5 protokol sunucusuyla** spawn, slot 36'da 4 diamond, gelen/giden sohbet, hotbar seçimi ve disconnect doğrulandı. Bu bir yerel protokol testi; harici üretim sunucusu testi yapılmadı.
- Worker için ayrıca izole mock lifecycle testi geçti.
- Panelin son görüntüsü: [4K arka planlı panel](docs/screenshots/panel-4k.png).
- [Başlatıcı önizlemesi](docs/screenshots/launcher-preview.png) 380 × 680 kırpılmış görüntüdür. Test ortamının pencere yöneticisi gerçek pencereyi farklı boyuta zorladığı için bu görüntü tek başına gerçek 380 px yeniden yerleşim doğrulaması sayılmaz.

## 14 Kasım 2026 — Son istekler / henüz tamamlanmadı

- Kullanıcının yeni envanter referansı: https://canva.link/zi7269rcmvjzqtr
- Bu Canva bağlantısı henüz incelenmedi. Önce referansı açıp mevcut envanterle karşılaştır.
- Kullanıcı tüm itemleri gerçek Minecraft envanteri gibi görmek istiyor: gerekli diğer yuvalar, sol/sağ tık etkileşimleri, drop ve Q basılı tutulup yuvaların üzerinde gezinirken drop.
- Sağ tık davranışının vanilla yarım stack alma mı yoksa doğrudan drop mu olacağı ifadede belirsiz; uygulama öncesinde netleştirmek yararlı. Kullanıcı özellikle “sağ tık drop” dedi.
- İlk dikey bot listesi penceresi **sabit boyutlu** isteniyor. En doğal yorum ana başlatıcı penceresi; geniş bot panelinin bundan ayrı olduğunu koru.
- Bu son envanter etkileşimleri ve sabit pencere isteği henüz uygulanmadı; önceki test sonuçları bunları kapsamıyor.

## Devam edecek ajan için kısa teknik notlar

- Arayüz: `src/views/BotManagementView.vue`, `src/views/BotView.vue`, `src/style.css`, `src/App.vue`.
- IPC/veri: `src/types/bot.ts`, `src/store/botStore.ts`, `electron/preload.ts`, `electron/main.ts`.
- Bot süreçleri: `electron/services/botManager.ts`, `public/bot-worker.cjs`.
- Kalıcı ayarlar: `electron/services/botRepository.ts`; Electron userData içindeki `bots.json`. Gerçek kullanıcı kayıtlarını testte değiştirme.
- Mineflayer ayrı **Node 22+** süreçte çalışıyor. `MYNBOT_NODE`, PATH ve Linux `~/.local/share/nvm` kontrol ediliyor. Bu makinede Node 22 yolu: `/home/senesatka/.local/share/nvm/v22.23.1/bin/node`.
- Yalnızca çevrimdışı hesap bağlantısı var. Bot paneli kapanınca bağlantı kesiliyor; paneli açık bot silinemiyor.
- İzole test betikleri çalışma sırasında `/tmp/mynbot-real-protocol-test.cjs`, `/tmp/mynbot-worker-test.cjs`, `/tmp/mynbot-ui-review/` altında oluşturuldu. `/tmp` kalıcı kabul edilmemeli; gerekirse testleri yeniden oluştur.
- Uygulamadan önce alınan kaynak yedekleri: `/tmp/mynbot-before-approved-implementation.tar.gz`, `/tmp/mynbot-before-ui-redesign.tar.gz`; eski proje kopyası komşu `MynBot-backup-20261114` klasöründe. Bunları orijinal eksiksiz kaynak olarak varsayma.
- Yeni kayıtları aşağıya tarih ve kısa yapılan/bekleyen maddeleriyle ekle.

## 14 Kasım 2026 — Envanter davranışının netleştirilmesi

- Kullanıcı sağ tık sorusuna **“Her şey gerçek Minecraft'taki gibi olsun”** yanıtını verdi.
- Önceki sağ tık belirsizliği giderildi: vanilla sol tık alma/yerleştirme, sağ tık yarım stack alma/tek tek yerleştirme; Q tek eşya ve Ctrl+Q stack drop temel davranış olacak.
- Kullanıcının Q basılı tutup yuvalar üzerinde gezinirken drop isteği de korunuyor.
- Bu genişletme ve sabit boyutlu launcher isteği Terra alt ajanına uygulama/test görevi olarak devredildi. Henüz tamamlandı sayılmamalı.

## 14 Kasım 2026 — Tam envanter çalışması başladı

- Canva kısa bağlantısı web aracında erişilemedi; bilgisayar kullanımında kullanılabilir tarayıcı bulunamadı. Klasik Minecraft oyuncu envanteri düzeni esas alınıyor.
- Sağ tık vanilla yarım yığın/tek eşya yerleştirme olarak netleşti. Eşya işlemleri gerçek sunucu üzerinden yapılacak.

## 14 Kasım 2026 — Envanter veri ve işlem katmanı

- Oyuncu envanterinin tüm sunucu yuvaları ve imleçte tutulan eşya serileştiriliyor; pencere tıklamaları worker üzerinden sırayla yürütülüyor.
- Ana başlatıcı penceresi sabit boyutlu olacak şekilde ayarlandı; geniş bot paneli yeniden boyutlandırılabilir kaldı. İşlevler ve görünüm doğrulaması sürüyor.

## 14 Kasım 2026 — Envanter arayüzü ve ilk protokol denemesi

- Parent'ın erişebildiği Canva referansı görüldü: klasik gri oyuncu envanterindeki zırh, siluet, üretim, diğer el, ana envanter ve hotbar DOM yuvaları uygulanıyor.
- Yerel 1.16.5 protokol sunucusunda sağ tıkla yığın bölme/tek yerleştirme, hızlı taşıma, Q ve pencere dışına bırakma paketleri ve transaction yanıtları çalıştırıldı. Görsel ve nihai davranış doğrulamaları sürüyor.

## 14 Kasım 2026 — Tam envanter uygulaması ve doğrulama

- Canva referansındaki klasik gri panel, zırh, oyuncu silueti, 2×2 üretim ve sonuç, desteklenen sürümlerde diğer el, 27 ana ve 9 hızlı erişim yuvası eklendi. 1.21.1 Minecraft istemcisinden çıkarılan item/block PNG'leri kullanılıyor; eksik dokuda metin yedeği var. Kaynak bilgisi `public/textures/SOURCE.json` dosyasında.
- Sol/sağ tık, Shift+tık, Q/Ctrl+Q ve imleçteki yığını dışarı bırakma gerçek `clickWindow` işlemlerine bağlı. İşlemler worker'da sıraya alınıyor; hata ve transaction reddi kullanıcıya iletiliyor. Q tekrarı 175 ms aralıklı ve tuş bırakma/odak kaybı/sekme değişimiyle duruyor.
- `vue-tsc --noEmit --incremental false` ve `vite build` başarılı. İzole yerel Minecraft 1.16.5 sunucusunda sağ tıkla 4 elması bölme, tek yerleştirme, shift tıklama, drop paketleri, pencere dışı tıklama ve transaction reddi doğrulandı. Bu test gerçek harici sunucu doğrulaması değildir; Q basılı fare gezinmesi ve gerçek crafting/armor işlemlerinin uçtan uca UI etkileşimi henüz ayrıca doğrulanmadı.
- İzole Electron testi 46 devre dışı yuvayı ve başlatıcı için yeniden boyutlandırma/fullscreen kapalı durumunu gördü. Bu Linux pencere yöneticisi `isMaximizable()` için true raporladı ve pencere ölçülerini zorladı; sabit 380×680 davranışı bu ortamda kesin doğrulanamadı. Son görüntü `/tmp/mynbot-ui-review/inventory-final.png`.

## 14 Kasım 2026 — Envanter yerleşimi düzeltmesi

- Dokuz sütunlu envanter ve hızlı erişim ızgaraları panel genişliğine sığacak biçimde düzeltildi; son Electron görüntüsü `docs/screenshots/inventory-final.png` ile doğrulandı.
- Son `vue-tsc --noEmit --incremental false` ve `vite build` başarılı.

## 14 Kasım 2026 — Envanter iyileştirmeleri ve devam hazırlığı

- `electron/main.ts` içinde varsayılan Electron uygulama menüsü kapatıldı (`Menu.setApplicationMenu(null)`); böylece `Ctrl+Q` yığın bırakma kısayolunun uygulamayı kapatması önlendi. Başlatıcı penceresi için `minWidth`/`maxWidth: 380` ve `minHeight`/`maxHeight: 680` sınırları eklendi.
- `src/components/Inventory/ItemIcon.vue` bileşeni çıkarılarak hem yuva hem de imleçteki eşya hayaletinin (`.cursor-ghost`) aynı doku/yedek mantığını kullanması sağlandı.
- Boş zırh (5–8) ve diğer el (45) yuvalarına `public/textures/item/empty_armor_slot_*.png` siluetleri eklendi.
- `src/views/BotView.vue` içinde `Ctrl` durumu dinamik izleniyor ve `Q` basılıyken yeni yuva üzerine gelindiğinde (`enterSlot`) gecikmesiz bırakma tetikleniyor.
- `vue-tsc --noEmit --incremental false` ve `vite build` başarılı. Yerel 1.16.5 protokol sunucusu ve `public/bot-worker.cjs` ile zırh kuşanma (yuva 5), diğer el (yuva 45), 2×2 üretim (yuva 1 → 0) ve `Q` / `Ctrl+Q` bırakma işlemleri doğrulandı. Bu sandbox ortamında Electron GUI başlatılamadığı için (`SIGTRAP`) canlı pencere etkileşimi ve sabit pencere boyutu tekrar görüntülenemedi.
- Sıradaki iş: `Plugins` sekmesi için eklenti sistemi kod planının kullanıcıyla netleştirilip uygulanması.

## 14 Kasım 2026 — Eklenti sistemi (Plugins) uygulandı

- Kullanıcının seçimi doğrultusunda hibrit eklenti sistemi kuruldu: yerleşik modüller (`Auto-Reconnect`, `Anti-AFK`, `Auto-Chat`) + yerel `.js`/`.cjs` Mineflayer eklenti dosyaları.
- Veri/doğrulama ve kalıcılık: `src/types/bot.ts`, `electron/services/pluginConfig.ts`, `electron/services/pluginDirectory.ts` ve `electron/services/botRepository.ts` eklendi/güncellendi. Bot başına eklenti ayarları `bots.json` içinde saklanıyor ve sunucu ayarları kaydedildiğinde korunuyor. Harici eklentiler `userData/plugins/` altında tutuluyor; yalnızca güvenli `.js`/`.cjs` dosya adlarına izin veriliyor.
- Çalışma zamanı: `electron/services/botManager.ts` içinde `Auto-Reconnect` (manuel bağlantı kesmede tetiklenmez, deneme sınırı ve bekleme süresi destekli) ve `update-plugins` canlı iletimi eklendi. `public/bot-worker.cjs` içinde `Anti-AFK` (zıplama/bakış döndürme), `Auto-Chat` (giriş mesajı, tetikleyici→yanıt kuralları, bekleme süresi ve kendi kendine tetikleme koruması) ve harici `.js`/`.cjs` eklenti yükleme/hata izolasyonu/cleanup desteği eklendi.
- Arayüz ve IPC: `electron/main.ts`, `electron/preload.ts`, `src/store/botStore.ts`, `src/components/Plugins/PluginsPanel.vue` ve `src/views/BotView.vue` ile `Plugins` sekmesi ve dosya içe aktarma / örnek şablon oluşturma / klasör açma / silme / modül aç-kapa arayüzü eklendi.
- Doğrulamalar: `vue-tsc --noEmit --incremental false` ve `vite build` başarılı. Yerel 1.16.5 protokol sunucusuyla envanter (zırh, diğer el, 2×2 üretim, Q / Ctrl+Q), eklenti worker akışı (giriş mesajı, Auto-Chat kuralı, Anti-AFK, harici eklenti yükleme/hata izolasyonu/cleanup) ve `BotRepository` + `PluginDirectory` + `BotManager` Auto-Reconnect testleri geçti. Bu sandbox ortamında Electron GUI başlatılamadığı için (`SIGTRAP`) canlı pencere/UI görsel doğrulaması yapılmadı.

## 14 Kasım 2026 — Sihirli kod ve çok satırlı sohbet/PM tanıma sistemi

- Teknik bilgisi olmayan kullanıcıların sunucu sohbet ve çok satırlı özel mesaj (PM) biçimlerini regex yazmadan öğretebilmesi için `src/utils/chatPatternBuilder.ts` ve `src/components/Plugins/ChatCalibrator.vue` eklendi.
- Sihirli kod üretme/dinleme (`MYNXXXX`), anlık sohbetten tekli veya toplu satır seçimi (8 satıra kadar, ör. 5 satırlık PM blokları), gönderen/mesaj işaretleme ve canlı önizleme desteklendi.
- `public/bot-worker.cjs` içine kayan pencere (3 sn içinde ardışık gelen satırlar) çok satırlı sohbet ayrıştırıcısı, `Auto-Chat` kuralları için `Tümü` / `Genel` / `Özel (PM)` kapsam seçimi, `{sender}` / `{message}` yer tutucuları ve harici eklentiler için `ctx.onParsedChat` / `mynbot:chat` olayı eklendi.
- `vue-tsc --noEmit --incremental false`, `vite build` ve yerel 1.16.5 protokol sunucusuyla tek satırlı rütbeli sohbet + 5 satırlı PM bloğu + `scope: 'pm'` + `{sender}` yanıt testi geçti. Electron GUI bu sandbox ortamında başlatılamadı (`SIGTRAP`).

## 14 Kasım 2026 — 2.5D Dünya Görünümü, Popup Envanter/Sandık/Örs ve Hareket Kontrolleri

- İki Hydrogen Medium alt ajanıyla backend ve frontend uygulaması tamamlandı:
  - Backend/IPC (`public/bot-worker.cjs`, `electron/services/botManager.ts`, `electron/main.ts`, `electron/preload.ts`, `src/types/bot.ts`): `9×6×9` çevre blok taraması (`world`), etkileşimli blok sınıflandırması (`chest`, `anvil`, `crafting`, `furnace`, `container`), konum/bakış/sağlık/açlık (`pose`), açık pencere (`openWindow` / `windowOpen` / `windowClose`), sandık/örs/blok açma (`open-block`), örs isim değiştirme (`rename-anvil`), pencere kapatma (`close-container`), hareket (`set-control`), bakış (`look`) ve eldeki eşyayı kullanma (`use-item`) eklendi.
  - Arayüz (`src/components/World/IsoWorldView.vue`, `src/components/Inventory/ContainerModal.vue`, `src/views/BotView.vue`, `src/style.css`): 2.5D izometrik `<canvas>` blok sahnesi (blok dokuları, kamera döndürme, Y-katman kesiti, menzildeki bloklara tıklayarak veya yan listeden tek tıkla açma), WASD + ekran üzeri hareket/bakış kontrolleri, sağ üstte **Envanter (E)** butonu ve hem oyuncu envanteri hem de açılan sandık/örs/sunucu menüleri için koyu-cam temalı popup modal (`ContainerModal.vue`) uygulandı.
- Doğrulamalar: `vue-tsc --noEmit --incremental false`, `vite build`, `node --check public/bot-worker.cjs` ve yerel protokol testleri başarılı.


## [2026-11-14] — Pencere Boyutu, Özel Sunucu Menüleri (Kafa & Lore), 2B Blok Radarı ve Fizik/Hareket İyileştirmesi
- **Kontrol Paneli Boyutu & Kaydırılabilir Düzen:** `electron/main.ts` içinde bot kontrol paneli boyutu `1280 × 840` (`resizable: true`, ekran `workAreaSize` duyarlı) olarak güncellendi; `src/style.css` içinde `.world-page` ve alt kartlara (`iso-bottom-bar`) kaydırma çubuğu (`overflow-y: auto`) eklenerek alt panellerin kesilmesi önlendi.
- **Özel Sunucu Menüleri (`player_head`, `customName`, `lore`) ve Pusula/Saat Dokuları:**
  - `public/bot-worker.cjs` içindeki `serialize(item)` fonksiyonuna NBT ve 1.20.5+ bileşenlerinden renkli özel isim (`customName`, `nameSegments`), çok satırlı renkli açıklamalar (`lore`), Base64 kafa cildi URL'si (`headTextureUrl`) ve büyü parıltısı (`enchanted`) ayrıştırması eklendi.
  - Sunucu seçici menülerde (`Sunucu Seç`) tıklama işlemlerinin takılmaması için `inventory-click` içine 900ms `Promise.race` koruması eklendi.
  - `src/components/Inventory/ItemIcon.vue` içine `compass` → `compass_16`, `clock` → `clock_00`, `recovery_compass` → `recovery_compass_16` eşleştirmesi, `headTextureUrl` üzerinden `<canvas>` ile 2B cilt kafası çizimi ve piksel-sanatı SVG kafa ikonları eklendi (`PL` ve `CO` harf yedekleri giderildi).
  - `src/components/Inventory/ContainerModal.vue` içine eşya üzerine gelindiğinde renkli özel isim ve tüm `lore` satırlarını gösteren Minecraft tarzı `#100010` mor çerçeveli Tooltip kutusu eklendi.
- **2B Üstten İnteraktif Blok Radarı, Tıkla-Yürü, NPC Etkileşimi ve Fizik Kontrolleri:**
  - `src/components/World/IsoWorldView.vue` bileşeni 15×15 kuşbakışı **2B İnteraktif Blok Radarı ve Katman Haritası** olarak yenilendi (gerçek blok dokuları, kot etiketleri, sandık/örs/fırın neon vurguları, yakındaki oyuncu/NPC işaretçileri, Kuzey/Bot yönü modu, üst barda hızlı 1–9 Hotbar şeridi ve Fizik aç/kapa anahtarı).
  - Harita üzerinde sandık/örslere tıklayarak doğrudan açma (`open-block`), NPC'lere tıklayarak sağ tık etkileşimi (`interact-entity`), zemine tıklayarak otomatik yürüme + 1 blok engel zıplama (`move-to`) ve D-Pad tek tık adım darbesi (`step-control`) eklendi.
- Doğrulamalar: `npx vue-tsc --noEmit`, `npx tsc --noEmit -p tsconfig.node.json`, `npx vite build`, `node --check public/bot-worker.cjs` ve yerel `minecraft-protocol` sunucu menüsü (`Sunucu Seç` + `player_head` + `lore`) testi başarılı.


## [2026-11-14] — JSON/NBT Başlık Biçimlendirme, İmleç Sıfırlama, Boşluk (Void) Fiziği, Cam Tasarım, Kod İçi Minecraft Müzikleri ve TR/EN Dil Desteği
- **Evrensel JSON/NBT Biçimlendirme (`public/bot-worker.cjs` & `ContainerModal.vue`):**
  - `extractReasonText` ve `formatReason` fonksiyonları JSON dizgilerini (`{"color":"black","text":"Ne Yapmalıyım"}`), NBT bileşik nesnelerini ve çeviri bileşenlerini özyinelemeli çözecek şekilde eklendi.
  - `OpenWindowInfo` içine renkli `titleSegments` eklendi ve koyu temada `#000000` (siyah) başlıkların okunabilir açık renkte gösterilmesi sağlandı.
- **İmleçte Takılı Kalan Eşya (`selectedItem` / Hayalet Pusula) Çözümü:**
  - `public/bot-worker.cjs` içinde `clearCursor` eklendi; iptal edilen/zaman aşımına uğrayan tıklamalarda, `set_slot` (`windowId: -1` / `slot: -1` ve iptal edilen slot geri yüklemelerinde), `window_items` (`carriedItem`), `windowOpen`, `windowClose`, `spawn` ve `close-container` işlemlerinde imleç otomatik sıfırlanıyor.
  - Envanter boşken hayalet imlecin gösterilmemesi için `ContainerModal.vue` ve `BotView.vue` içine ek koruma eklendi.
- **Boşluğa Düşme (Void / Limbo) ve Tam Fizik Aktivasyonu:**
  - `ensurePhysicsAndFallbackAir` ile Mineflayer'ın `blockAt` fonksiyonu sarmalanarak chunk yüklenmemiş boşluk (void/limbo) dünyalarında `_isFallbackAir: true` hava bloğu döndürüldü; böylece `tickPhysics` durmadan 20 TPS yerçekimi (boşluğa düşme) ve hareket simülasyonunu çalıştırıyor.
- **Saydam Sol Panel (Glassmorphism), Canlı Arka Plan ve Kod İçi Minecraft Müzik Motoru:**
  - `src/style.css` içinde arka plan doygunluğu artırıldı, karartma katmanı hafifletildi ve sol menü (`.sidebar`) ile kartlara buzlu cam (`backdrop-filter: blur(18px)`) görünümü kazandırıldı.
  - `src/utils/minecraftMusic.ts` içinde Web Audio API ile C418 (*Sweden*, *Wet Hands*, *Subwoofer Lullaby*, *Living Mice*) tarzı kod içi ambiyans müzik sentezleyicisi oluşturuldu ve arka plan değiştirme butonunun yanına müzik aç/kapa (`🎵`/`🔇`) butonu eklendi.
- **Türkçe (`TR`) ve İngilizce (`EN`) Dil Desteği:**
  - `src/i18n/index.ts` oluşturuldu ve tüm görünüm/bileşenler (`BotManagementView.vue`, `BotView.vue`, `IsoWorldView.vue`, `ContainerModal.vue`, `Slot.vue`, `PluginsPanel.vue`, `ChatCalibrator.vue`, `BotList/*`) çift dilli (`TR`/`EN`) hale getirildi.
- Doğrulamalar: `npx vue-tsc --noEmit`, `npx vite build`, `node --check public/bot-worker.cjs` ve yerel protokol testi (`test-stage3.cjs`) başarılı.


## 2026-11-14 (Müzik Susturma/Değiştirme, 3B İzometrik Kafalar, Resource Pack CustomModelData & Tam Açık Fizik)
- **Subagent (`gemini-4-hydrogen-medium` / `Model: 'flash'`)**: Özel `gemini-4-hydrogen-medium` subagent tipi tanımlanarak 3 paralel hafif (`flash`) subagent ile geliştirme tamamlandı.
- **Müzik Motoru (`src/utils/minecraftMusic.ts`, `src/views/BotView.vue`, `src/i18n/index.ts`)**:
  - `stopMusic()` içinde aktif tüm osilatörlerin (`activeNodes`) durdurulması, `masterGain` ve `delayFeedback` kazançlarının anında sıfırlanması ve `audioCtx.suspend()` ile sessiz modda müziğin çalmaya devam etmesi sorunu giderildi.
  - 4 farklı C418 tarzı ambiyans parçası (*Sweden (Calm)*, *Subwoofer Lullaby*, *Living Mice*, *Wet Hands*) ve sol alt kontrole **Müzik Değiştir (`⏭`)** butonu (`nextMusicTrack`) eklendi.
- **3B İzometrik Kafalar (`src/components/Inventory/ItemIcon.vue`, `public/bot-worker.cjs`)**:
  - `player_head` ve kafatasları 2B düz kare yerine `<canvas>` üzerinde Üst (`8,0` + `40,0`), Sol-Ön (`8,8` + `40,8`) ve Sağ-Yan (`0,8` + `32,8`) yüzleri 2D afin dönüşüm matrisleri ve gölgelendirme ile birleştiren **3B İzometrik Küp** olarak çizildi.
  - `public/bot-worker.cjs` içinde `1.20.5+` `item.componentMap` (`Map`) ve `item.components` dizi yapıları için `getItemComponent` ve `findTextureBase64` (`Map` desteği) eklendi.
- **Kozmetik Menüsü `{"` Hatası & Otomatik Resource Pack Doku Çıkarıcı (`electron/services/resourcePackService.ts`, `public/bot-worker.cjs`, `src/components/Inventory/ItemIcon.vue`)**:
  - `cleanChatText` içinde boşluk/özel ikon içeren JSON string'lerin (`{"text":" "}`) ham JSON olarak sızması engellendi; `*_stained_glass_pane` -> `*_stained_glass` ve `anvil` -> `anvil_top` doku eşleştirmeleri eklendi.
  - Harici bağımlılık gerektirmeyen ZIP okuyucu (`ResourcePackService`) ile sunucu Resource Pack `.zip` dosyalarının arka planda indirilip `CustomModelData` model/doku eşleşmelerinin `.png` (`data:image/png;base64,...`) olarak çözülmesi sağlandı.
- **Tam Zamanlı Açık Fizik & `mynphysics` Yol Haritası (`public/bot-worker.cjs`, `src/components/World/IsoWorldView.vue`)**:
  - Fizik kapatma butonu kaldırılarak fizik motoru her zaman açık (`physicsEnabled = true`) hale getirildi; gelecekteki `mynphysics` özel fizik paketi mimari plana eklendi.


## 2026-11-14 (Sıfır Kırık İkon / Ön-Yüklemeli Doku Manifesti & Mojang CDN Karışık Tüm Minecraft Müzikleri)
- **Subagent (`gemini-4-hydrogen-medium` / `Model: 'flash'`)**: 3 paralel medium alt ajan (`Music Downloader & Electron IPC Specialist`, `ItemIcon Manifest & Worker Pack Specialist`, `Shuffled Minecraft Audio & UI Specialist`) ile geliştirme yürütüldü ve ana ajan tarafından entegrasyon düzeltmeleri ile doğrulamalar tamamlandı.
- **Kozmetik Menüsü Kırık Görsel & Anlık Yanıp Sönme Giderimi (`src/components/Inventory/ItemIcon.vue`, `src/utils/textureManifest.ts`)**:
  - `public/textures/item/*.png` (605 doku) ve `public/textures/block/*.png` (1012 doku) dosyalarından statik `src/utils/textureManifest.ts` (`ITEM_TEXTURE_SET`, `BLOCK_TEXTURE_SET`) üretilerek var olmayan `/textures/item/<blok>.png` istekleri tamamen ortadan kaldırıldı (`black_stained_glass_pane`, `anvil`, `crafting_table`, halı/basamak/merdiven/duvar/yatak/bayrak/mumlu blok vb. dahil).
  - `resolveVanillaTextureUrl` doğrudan doğru `item/` veya `block/` yolunu döndürüyor; `displayedSrc` ve `decodedImageUrls` ile doku arka planda `new Image()` üzerinden ön-yüklendikten sonra `<img>` bağlanıyor ve `<img>` yalnızca kesin yüklendiğinde ekrana veriliyor.
  - `CustomModelData` / Resource Pack önbelleği (`packTextureCache`, ayrı `packSeq` ve `imgSeq` sayaçları) ile menü yenilenmelerinde eşya simgesi ve 3B kafa kanvası kırpışmadan korunuyor.
- **1.20.2+ `configuration` Aşaması Resource Pack Yakalama & Birleştirilmiş Envanter (`public/bot-worker.cjs`)**:
  - `_client` üzerindeki `resource_pack_send` ve `add_resource_pack` dinleyicileri `login` olayından önce (`createBot` / `inject_allowed` aşamasında) bağlanarak 1.20.2+ `configuration` fazı paketlerinin yakalanması sağlandı.
  - `scheduleInventory` (20ms debounce/coalescing) ile `updateSlot`, `set_slot` ve `window_items` seri güncellemeleri tek bir kararlı anlık görüntüye birleştirildi.
- **Resmi Tüm Minecraft Müzikleri (Mojang CDN İndirme & Shuffle Çalma)**:
  - `electron/services/musicService.ts` (`MusicService`), `electron/main.ts`, `electron/preload.ts` ve `src/types/bot.ts` eklendi: Mojang `version_manifest_v2.json` → son sürüm → `assetIndex` üzerinden resmi `minecraft/sounds/music/*.ogg` ve `minecraft/sounds/records/*.ogg` parçalarını keşfedip `userData/music/` altına atomik olarak indirip önbellekliyor (3 eşzamanlı worker + öncelikli parça indirme).
  - `src/utils/minecraftMusic.ts`, `src/views/BotView.vue`, `src/i18n/index.ts`: Fisher-Yates shuffle kuyruğu (`refillShuffleQueue`), indirilen `.ogg` dosyalarının Electron IPC (`music:get-track-bytes`) + `Blob URL` ile çalınması, ilk parça inerken kesintisiz Web Audio sentezleyici yedeklemesi, autoplay jest koruması ve arayüzde parça adı + indirme ilerlemesi `(indirilen/toplam)` göstergesi ile `🔀⏭` karıştırma/geçme butonu eklendi.
- **Doğrulamalar**:
  - `MusicService` uçtan uca entegrasyon testi (alt ajan tarafından Mojang CDN üzerinden 92 parça keşfi ve gerçek `.ogg` bayt doğrulaması gözlemlendi).
  - Son düzenlemeler sonrası `node --check public/bot-worker.cjs`, `npx vue-tsc --noEmit` ve `npx vite build` 0 hata ile geçti (`dist/` ve `dist-electron/` üretildi; `music:*` IPC kanalları ile `dist/textures/` dosyaları doğrulandı).

## 2026-11-14 (Eklentiler Sekmesi Modüler Kutu Izgarası, İkon Seçici & Ayar Modalı)
- **Modüler Kutu Düzeni (`src/components/Plugins/PluginsPanel.vue`)**: Tüm modül ayar formları varsayılan olarak gizlendi; yerleşik modüller (`autoReconnect`, `antiAfk`, `autoChat`, `chatCalibrator`) ve yerel `.js`/`.cjs` scriptler tek biçimli tıklanabilir kutu (`plugin-box`) ızgarasına taşındı. Sağ üstte hızlı aç/kapa anahtarı, üst barda arama ve kategori filtreleri (`Tümü`, `Aktifler`, `Yerleşik`, `Yerel Scriptler`) eklendi.
- **Tıklanınca Açılan Ayar Modalı & İkon Özelleştirme (`src/components/Plugins/PluginSettingsModal.vue`, `src/components/Plugins/PluginIcon.vue`)**: Herhangi bir kutuya tıklandığında ilgili modülün ayarları ve ikon seçicisi modal olarak açılıyor (`Esc` / dış tıkla kapatma destekli). Minecraft eşya dokuları (`ItemIcon`), emoji simgeleri, `https://` URL veya yerel görsel yükleme (`<= 120 KB`) ile özel ikon tanımlanabiliyor.
- **Kalıcılık & Çeviri (`src/types/bot.ts`, `electron/services/pluginConfig.ts`, `src/i18n/index.ts`)**: `BotPluginSettings.moduleIcons` alanı `validatePluginSettings` doğrulamasıyla kalıcı hale getirildi ve TR/EN arayüz metinleri eklendi.
- **Doğrulama**: `npx vue-tsc --noEmit` ve `npx vite build` 0 hata ile geçti (`dist/` ve `dist-electron/` üretildi).

## Yeni Sohbet İçin Devir Özeti (14 Kasım 2026 — Güncel Mimari & Yol Haritası)

### Tamamlanan Ana Özellikler
1. **Masaüstü Başlatıcı & Kontrol Paneli (`electron/main.ts`, `src/views/BotManagementView.vue`, `src/views/BotView.vue`, `src/style.css`)**:
   - Sabit boyutlu başlatıcı penceresi ve yeniden boyutlandırılabilir `1280 × 840` cam efektli (glassmorphism) bot kontrol paneli.
   - 4K rastgele arka plan değiştirici (`wallpapers/`) ve `TR / EN` çift dil desteği (`src/i18n/index.ts`).
2. **Resmi Minecraft Müzik Sistemi (`electron/services/musicService.ts`, `src/utils/minecraftMusic.ts`)**:
   - Mojang CDN (`version_manifest_v2.json` → `assetIndex`) üzerinden resmi `music/*.ogg` ve `records/*.ogg` parçalarını `userData/music/` altına atomik olarak indirir ve önbellekler.
   - Fisher-Yates shuffle kuyruğu ile `Blob URL` üzerinden gerçek `.ogg` çalar; ilk parça inerken veya çevrimdışıyken Web Audio sentezleyicisi devreye girer. Üst barda parça adı, indirme sayacı ve `🔀⏭` karıştırma butonu bulunur.
3. **Tam Envanter, Özel Sunucu Menüleri & Sıfır Kırık İkon (`src/components/Inventory/*`, `src/utils/textureManifest.ts`, `electron/services/resourcePackService.ts`, `public/bot-worker.cjs`)**:
   - Minecraft tarzı envanter ve sandık/örs/özel menü modalı (`ContainerModal.vue`), renkli JSON/NBT başlıklar, çok satırlı lore tooltip'leri ve 3B izometrik oyuncu kafaları (`ItemIcon.vue`).
   - 1.20.2+ `configuration` aşaması dahil sunucu Resource Pack `.zip` yakalama (`ResourcePackService`) ve `CustomModelData` doku çözümleme.
   - `textureManifest.ts` (`605` item + `1012` blok) ve offscreen `new Image()` ön-yüklemesi ile menü yenilemelerinde kırık görsel/flash tamamen engellendi.
4. **2B Blok Radarı & Tam Açık Fizik (`src/components/World/IsoWorldView.vue`, `public/bot-worker.cjs`)**:
   - 15×15 üstten etkileşimli blok radarı (sandık/örs açma, NPC etkileşimi, tıkla-yürü, WASD/D-Pad kontrolleri, hızlı 1–9 hotbar).
   - Fizik her zaman açıktır (`physicsEnabled = true`); chunk yüklenmemiş boşluk (void/limbo) dünyaları için `ensurePhysicsAndFallbackAir` koruması vardır.
5. **Modüler Kutu (Box) Eklenti Sekmesi (`src/components/Plugins/PluginsPanel.vue`, `PluginSettingsModal.vue`, `PluginIcon.vue`, `electron/services/pluginConfig.ts`)**:
   - Tüm modüller (`autoReconnect`, `antiAfk`, `autoChat`, `chatCalibrator` ve yerel `.js`/`.cjs` scriptler) arama/filtreli kutu ızgarası olarak gösterilir; ayarlar kutuya tıklanınca modal olarak açılır.
   - Her modül ve script için Minecraft eşya dokusu, emoji, `https://` URL veya yerel görsel yükleme (`<= 120 KB`) ile özel ikon tanımlanabilir (`BotPluginSettings.moduleIcons`).

### Sıradaki Planlı İşler (Henüz Kodlanmadı)
- **`mynphysics` Paketi**: Gelecekte Mineflayer varsayılan fiziği yerine özel `mynphysics` fizik paketinin entegre edilmesi planlanmaktadır (yalnızca yol haritasında tutuluyor).
- **Yeni Eklenti Modülleri**: *Oto Yemek Yeme (`AutoEat`)*, *Oto Savunma (`AutoDefend`)* gibi yeni modüller `PluginsPanel.vue` (`builtinCards`) + `PluginSettingsModal.vue` yapısına eklenebilir.

### Hızlı Doğrulama Komutları
- `node --check public/bot-worker.cjs`
- `npx vue-tsc --noEmit`
- `npx vite build` *(Not: Headless Linux sandbox içinde canlı Electron GUI penceresi başlatılamamaktadır.)*

## 15 Kasım 2026 — Terra ve Luna ile tasarım yenilemesi

- Kullanıcı, emoji ağırlıklı sistem düğmelerinin daha tutarlı ikonlarla değiştirilmesini; daha modern cam yüzeyler, görünür arka plan ve düzenli köşe yuvarlaklıkları istedi. Plan `DESIGN_PLAN.md` içinde kaydedildi.
- Terra ana başlatıcı/panel, üst araç düzeni, ortak CSS ve `src/components/ui/AppIcon.vue` üzerinde çalıştı. Luna dünya radarı, envanter modalı ve eklenti bileşenlerini uyumlandırdı. Ana ajan entegrasyon ve son görsel düzeltmeleri yaptı.
- `@lucide/vue` eklendi. Yerel SVG ikonları kullanılıyor; dış ikon fontu/CDN gerekmiyor. Müzik değiştirme, ses, arka plan, dil, bağlantı, envanter ve eklenti eylemleri aynı ikon ailesine taşındı. Canvas radarında emoji yerine geometrik işaretçiler var; Minecraft eşya dokuları korunuyor.
- Üst kısım yardımcı araçlar ve bağlantı eylemi olarak gruplandı. Kontrol/grup/kart için 8/12/16 px radius tokenları eklendi. Neon/parlama ve yükselme etkileri azaltıldı; kart ve sol menü yüzeyleri saydamlaştırıldı. Parlak görsellerde metin okunaklılığı için karartma ve doygunluk dengelendi.
- Eklenti kartları, ayar modalı ve aç/kapa anahtarları sadeleştirildi. İkon seçicide `icon:Name` SVG seçenekleri var; kullanıcının önceden seçtiği özel emoji, eşya ve görsel değerleri silinmiyor. Yeni ikon değerlerinin kaydı doğrulandı; bozuk önekler reddediliyor.
- TypeScript kontrolü ve Vite derlemesi başarılı. Kozmetik kapsam dışında bot/sohbet/envanter/müzik davranışları yeniden tasarlanmadı.
- İzole Electron **renderer önizlemesinde**, test profili ve örnek anlık durumla genel bakış, sohbet, dünya, eklentiler, ayar modalı ve envanter render edildi. 1280×840 ve minimum 1040×700 panelde; başlatıcının gerçek 380×680 içerik alanında yatay taşma yok. Test ekranlarındaki ikonlu düğmelerde erişilebilir ad eksikliği bulunmadı. Bu kontrol canlı Minecraft sunucusu veya gerçek kullanıcı verileriyle yapılmadı.
- Önizlemeler: `docs/screenshots/design-refresh-2026-11-15/` (genel bakış, minimum panel, eklentiler, modal, envanter, başlatıcı). Bu görseller test verisiyle alınmış tasarım önizlemeleridir.


## 15 Kasım 2026 — Terra/Luna ile yararlı otomasyon modülleri

- Kullanıcının isteğiyle Mineflayer API ve Auto-Eat/Auto-Armor projeleri incelendi; üç modülün kapsamı ve kabul kontrolleri `PLUGIN_PLAN.md` dosyasına yazıldı. Yeni dış eklenti bağımlılığı eklenmeden Mineflayer API kullanıldı. Terra runtime/tip/doğrulama; Luna kartlar, modallar ve TR/EN metinler; ana ajan entegrasyon, bağımsız inceleme, protokol/görsel testler ve devir kaydı yaptı.
- **AutoEat:** açlık/can eşiği, doygunluk veya besin puanı seçimi, altın elma izni ve eldeki eşyayı geri alma. Zararlı/özel etkili yiyecekler ve çiğ yiyecekler dışlanıyor; altın elmalar varsayılan tüketilmiyor. Eşya geri alınırken NBT/dayanıklılık kimliği korunuyor.
- **AutoArmor:** belirlenen aralıkta koruma puanı ve toughness karşılaştırmasıyla daha iyi parçaları kuşanır; eşit korumada değişim döngüsü yok. Kuşanılmış büyülü/lanetli zırh, elytra ve tanınmayan özel parçalar muhafazakâr biçimde korunur. Tüm büyü kombinasyonlarını optimize eden bir zırh puanlayıcı değildir.
- **AutoFishing:** mevcut bakış yönünde su ve envanterde olta gerektirir; yakalama sonrası yeniden atış, zaman aşımı ve eksik olta/su durumları var. Suya yürümez, bakışı kendi ayarlamaz. Yemek ihtiyacı ve manuel işlemler balıkçılığı keser; olta eşya değiştirme yarışından önce geri çekilir.
- Modüller **varsayılan kapalı**; bot başına `bots.json` içinde kaydedilir. Eski kayıtlar varsayılanlarla tamamlanır, sayı aralıkları doğrulanır. Kartlardan hızlı aç/kapa, ayar modalı ve gerçek worker durum mesajı gösterilir. Bağlantı kesilince durum temizlenir.
- `public/builtin-automation.cjs` worker yanında paketlenir; worker envanter kuyruğu paylaşılır. Açık konteyner, imleçte eşya ve manuel hareket sırasında bekler. Token/iptal kontrolleri, sınırlı tekrar denemeler ve timer/listener temizliği eklendi. Native kuşanma işlemi devam ederken sıradaki envanter eylemi tamamlanmasını bekler; sunucu onayı gecikirse Mineflayer'in native zaman aşımı uygulanır.
- Bağımsız incelemede zırh koruma eşitliği, büyülü eşya koruması, NBT ile geri alma, kapatılmış işlemin durumu ezmesi ve olta/manuel slot yarışı düzeltildi. Teleport edilen modaldaki select/etiket stilleri ve eski `enabledScripts` alanının eksik olması da düzeltildi.
- **Geçen kontroller:** `node --check public/bot-worker.cjs`, `node --check public/builtin-automation.cjs`, `node tests/automation.test.cjs`, `node tests/plugin-config.test.cjs`, `npx vue-tsc --noEmit`, `npx vite build`.
- `tests/automation.test.cjs`: sahte botla yiyecek seçimi/geri alma, koruyucu zırh/elytra davranışı, gecikmiş kuşanmayı kapatma, manuel işlem/olta yarışı, zaman aşımı, açlığın balıkçılığı kesmesi, eksik olta ve listener temizliği.
- `tests/plugin-config.test.cjs`: eski ayarlar, sayı sınırları, izole geçici dosyada kaydetme/yeniden okuma ve mevcut sohbet ayarlarının korunması.
- **Gerçek Mineflayer / yerel protokol testi:** Node 22 ile `node tests/automation-protocol.test.cjs` geçti. İzole offline Minecraft 1.16.5 protokol sunucusu ve gerçek worker ile spawn, biftek envanteri, native `use_item`, sunucunun yeme tamamlandı yanıtı, otomasyon tamamlanma durumu, sohbet, manuel hotbar ve disconnect doğrulandı. Bu, tam Minecraft oyun sunucusu değildir; gerçek sunucuda zırh kuşanma ve balık yakalama henüz denenmedi.
- **Görsel kontrol:** 1280×840 ve minimum 1040×700 panelde yeni kartlar/modallar izole örnek veriyle görüntülendi; yatay taşma veya erişilebilir adı eksik ikon düğmesi yok. Yeni görseller `docs/screenshots/automation-2026-11-15/`. Gerçek kullanıcı kayıtlarına/sunucularına dokunulmadı.


## 15 Kasım 2026 — GitHub kayıt hazırlığı

- Kullanıcı isteğiyle `https://github.com/MynCraft/mynbot.git` deposunun mevcut `main` geçmişi geçici checkout içinde korundu; güncel kaynaklar, testler ve planlar aktarıldı. Derleme çıktıları, release paketleri ve yerel secret dosyaları ignore edildi. Bu çalışma alanındaki `.git` boş ve salt okunur olduğundan Git işlemleri `/tmp/mynbot-publish-20261115` checkout içinde yapılıyor.


## 16 Kasım 2026 — HATA_DUZELTME_PLANI.md kapsamlı düzeltmeler (Aşama 1–9)

- **Aşama 1 (H1, H2, H11, H14):** `public/bot-worker.cjs` içinde bağlantı kurulduktan sonraki protokol `error` olayları `status('error')` yerine `operation-error` + log olarak iletiliyor; `kicked` yalnızca `end` olayında haritadan silindikten sonra durum bildiriyor; `connected` yalnızca ilk `spawn`'da gönderiliyor; `connect` eski örneği temizleyip devam ediyor; `uncaughtException`/`unhandledRejection` ve mesaj işleyici `try/catch` korumaları eklendi. `electron/services/botManager.ts` içine 30 sn bağlantı zaman aşımı eklendi.
- **Aşama 2 (H5):** `public/bot-worker.cjs` otomatik sürüm seçiminde `mc.ping` (5 sn zaman aşımı) ile protokolü `mineflayer.testedVersions` ile eşleştiriyor, desteklenmeyen sürümlerde `latestSupportedVersion` (`1.21.8`) ile ViaVersion uyarısı verip `autoVersion` çökme yolunu atlıyor. `src/utils/supportedVersions.ts`, `electron/services/botRepository.ts` ve `src/views/BotView.vue` `<select>` sürüm seçimi güncellendi.
- **Aşama 3 (H3):** Resource pack işleme yalnızca `resourcePack` olayına indirgendi; `acceptResourcePack()` tek seferlik çağrılıyor, UUID/URL bazlı tekilleştirme (`seenResourcePacks`) eklendi.
- **Aşama 4 (H4):** `ensurePhysicsAndFallbackAir` sahte hava yaması kaldırıldı; yüklenmemiş chunk'larda bot düşmüyor, `step-control`/`move-to` `"Dünya henüz yüklenmedi"` hatası veriyor, `set-physics` `enabled` değerini uyguluyor.
- **Aşama 5 (H7, H9, H10):** `position === 'game_info'` actionbar mesajları sohbete ve desen tamponuna karışmıyor; `title` ve actionbar metinleri `handleAutoLogin` tarafından ayrı yoldan işleniyor; `lastSentText` yerine 5 sn ömürlü `recentSentMessages` ve kelime sınırlı öz-mesaj tespiti eklendi; `triggerJoinChat` ilk `spawn` sonrasına (varsa `autoLogin` sonrasına) taşındı.
- **Aşama 6 (H8):** Harici eklentiler ilk `spawn` sonrasında yükleniyor; `NODE_PATH` + `Module._initPaths()` + `ctx.require` ile uygulamanın `node_modules` modülleri çözülüyor; `ctx.bot` ve `ctx.onSpawn` eklendi; `update-plugins` ile canlı yenileme, `pluginDirectory.ts` örnek eklentisinin `ctx.onParsedChat` güncellemesi ve `PluginsPanel.vue` kartlarında script hata gösterimi sağlandı.
- **Aşama 7 (H12, H13):** `manualControls` için 10 sn otomatik bırakma zaman aşımı eklendi; `public/builtin-automation.cjs` içinde 15 sn üzeri açık pencereler kritik otomasyonlar için kapatılıyor ve bekleme nedenleri ayrıştırılıyor; `autoTotem` off-hand olmayan (1.8) sürümlerde döngüye girmiyor; `handleAutoAccept` beyaz listesi tam/kelime-sınırlı eşleşme kullanıyor.
- **Aşama 8 (H6):** Online-mode/premium sunucu atılmalarında açıklayıcı hata mesajı gösteriliyor (tam Microsoft OAuth akışı ayrı iş olarak bırakıldı).
- **Aşama 9 (H15):** `BotData.lastError` ile sohbet gönderim hataları sohbet kutusunun altında gösteriliyor; pencere kapatma butonuna bağlantıyı keseceğini belirten ipucu eklendi; `package.json` içine `npm test` betiği eklendi.
- **Doğrulamalar:** `./node_modules/.bin/vue-tsc --noEmit --incremental false` (0 hata), `npm test` (13 testin tamamı: `auto-login`, `automation-protocol`, `automation`, `plugin-config`, `nonfatal-error`, `reconnect-race`, `resource-pack`, `unloaded-chunk`, `unsupported-version`, `actionbar-patterns`, `self-filter`, `external-plugin`, `auto-accept-whitelist` geçti) ve `./node_modules/.bin/vite build` başarılı.
- **Doğrulanmayan dış sunucu testleri:** Gerçek dış sunucularda (offline-mode vanilla 1.21.8, ViaVersion'lı 1.21.10+, resource pack zorunlu sunucu, AuthMe/nLogin sunucusu) test bu ortamda yapılmadı; yalnızca yerel protokol sunucularıyla doğrulandı.
