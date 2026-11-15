# MynBot — dosya kaybı incelemesi ve Terra uygulama planı

İnceleme tarihi: 14 Kasım 2026. Bu çalışma uygulama kodunu değiştirmez; mevcut dosyalardan çıkarılan bulguları ve onarım sırasını kaydeder.

## 1. Mevcut durum ve kanıt sınırları

Proje Vue 3 + TypeScript + Vite + Pinia + Vue Router arayüzü ve Electron masaüstü kabuğundan oluşuyor. Mineflayer kurulu, fakat mevcut kaynaklarda bot bağlantısı oluşturan kod yok.

- `src` altında yalnızca 9 dosya var. Router, store ve sayfa bileşenleri yok.
- `.git` bu ortamda boş görünüyor ve `git status` projeyi depo olarak tanımıyor. Bu kopyadan dosya geçmişi veya silinen dosya listesi çıkarılamadı. Bu durum orijinal diskte Git verisinin kesinlikle kaybolduğunu kanıtlamaz.
- `README.md` başlangıç şablonu; eski işlevleri veya dosya ağacını açıklamıyor.
- `dist-electron/main.js` ve `preload.mjs` incelendi: mevcut Electron kaynaklarıyla aynı sınırlı işlevler var; kayıp bot yöneticisini kurtaracak ek uygulama kodu veya source map yok.
- `dist` yok. Bu bir üretim çıktısıdır; kaynak dosya kaybı kanıtı değildir. Yeniden derlenebilir.
- Vite önbelleğinde Vue/Pinia bağımlılık paketleri var; incelenen önbellek kayıp router/store uygulama kodunu içermiyor.
- Font, iki PNG ve beş duvar kâğıdı mevcut. Sıfır baytlık proje dosyası bulunmadı; tüm varlıkların bütünlüğü görsel olarak doğrulanmadı.

Eski dosyaların tam adları ve içerikleri yalnızca bu kopyadan çıkarılamaz. Aşağıda doğrudan kanıt ile önerilen yeni dosyalar ayrı belirtilmiştir.

## 2. Doğrulanmış eksikler

| Eksik | Kanıt | Etki |
| --- | --- | --- |
| `src/router` modülü | `src/main.ts:4` içindeki `./router` importu çözülemiyor | Uygulama girişinin derlenmesini engeller. Eski dosya `router.ts` veya `router/index.ts` olabilir. |
| `src/store/botStore` modülü | `src/components/BotList/Item.vue:2` içindeki import çözülemiyor | Bot silme ve liste verisi eksik. Eski uzantı kesin değil; yeniden kurulumda `.ts` öneriliyor. |
| `/vite.svg` varlığı | `index.html:5` bunu favicon olarak istiyor, `public/vite.svg` yok | Web favicon isteği başarısız olur; mevcut `src/assets/vue.svg` farklı bir dosyadır. |
| `favicon.ico` varlığı | `electron/main.ts:36` bunu pencere ikonu olarak istiyor, `public/favicon.ico` yok | Electron pencere ikonu eksik. |

Son iki ikon için eski dosyayı aynen üretmek zorunlu değil; uygun mevcut PNG'ye referans vermek veya doğru formatta yeni ikon üretmek de çözüm olabilir.

## 3. Dosya kaybından ayrı işlev eksikleri

- `Item.vue:18`, `window.electronAPI.openBotWindow(username)` çağırıyor. Preload yalnızca `ipcRenderer` yayımlıyor; `electronAPI` uygulaması ve tipi yok. Sadece TypeScript bildirimi eklemek çalışma anındaki eksikliği çözmez.
- `Container.vue` içindeki store importu, bot listesi çizimi ve `get-open-windows` sorgusu yorum satırında. Aktif liste daima boş dizi dönüyor. Neden devre dışı bırakıldığı bilinmiyor.
- Electron main içinde yalnızca ana pencere ve `close-window` kanalı var. Bot penceresi açma ve `get-open-windows` handler'ı yok.
- `App.vue` yalnızca `RouterView` içeriyor. Hiçbir sayfa bileşeni mevcut değil. Yönetim ve bot sayfaları yeniden kurulmalı; eski dosya adları/tasarımı kanıtlanamıyor.
- Bot oluşturma/düzenleme, kalıcı kayıt, bağlantı, mesajlaşma ve durum senkronizasyonu mevcut kaynaklarda uygulanmıyor. Bunların daha önce tamamlanmış olduğunu kanıtlayan kaynak yok.
- Preload `on` dinleyiciyi bir sarmalayıcıyla kaydediyor, `off` ise orijinal dinleyiciyi kaldırmaya çalışıyor. Aynı fonksiyon kimliği kullanılmadığından abonelik temizliği düzeltilmeli.
- Pencere `frame: false`; yeniden kurulacak yönetim ekranında çalışan kapatma kontrolü bulunmalı.

## 4. Yapılan kontroller

`./node_modules/.bin/vue-tsc --noEmit --incremental false` çalıştırıldı ve 6 hata verdi:

1. `electron/main.ts:6`: kullanılmayan `require`.
2. `Container.vue:4`: kullanılmayan `BotListItem`.
3. `Container.vue:11`: kullanılmayan `openUsernames`.
4. `Item.vue:2`: eksik bot store modülü.
5. `Item.vue:18`: eksik `window.electronAPI` tipi.
6. `src/main.ts:4`: eksik router modülü.

`npm ls --depth=0` başarılı: doğrudan bağımlılıklar kurulu görünüyor. Bu kontrol tüm geçişli bağımlılıkların veya yerel ikililerin sağlam olduğunu garanti etmez.

Yerel Node sürümü `20.20.2`. Kurulu `mineflayer@4.33.0` ve `minecraft-protocol@1.62.0` paketlerinin kendi `package.json` dosyaları Node `>=22` istiyor. Electron npm paketinin engine alanı, Electron içinde çalışan Node sürümü değildir. Mineflayer'ın çalışacağı gerçek süreçteki Node sürümü ayrıca doğrulanmalı.

Tam Vite derlemesi, paketleme ve GUI çalıştırması bu incelemede yapılmadı. Yeni çıktılarla mevcut kurtarma kanıtları üzerine yazılmadı.

## 5. Terra için sıralı uygulama planı

### A. Mevcut kopyayı koru ve kurtarma olanağını kontrol et

1. Uygulamadan önce kaynakları, lockfile'ı ve `dist-electron` dosyalarını ayrı bir yedeğe al. İlk iş olarak bağımlılıkları veya derleme çıktılarını silme.
2. Erişilebilir eski yedek/uzak depo varsa önce oradan gerçek router/store/sayfa dosyalarını kurtar. Bu incelemede uzak depo adresi bulunmadı; dosya kurtarma için gereken adres/konum kullanıcıdan gerekirse alınmalı.
3. Kurtarılabilir kaynak bulunamazsa aşağıdaki dosyaları yeniden oluştur. Bunları birebir kurtarılmış eski dosya olarak sunma.

### B. Router, ortak veri modeli ve store'u kur

Önerilen yeni dosyalar; eski adlar oldukları iddia edilmiyor:

- `src/router/index.ts`: Electron `loadFile` ile uyumlu hash history; yönetim `/`, bot detay `/bot/:username`, bilinmeyen rota dönüşü.
- `src/types/bot.ts`: düz/serileştirilebilir bot yapılandırması ve bağlantı durumu. Mevcut `bot.options.username` kullanımını destekle veya tüm çağıranları birlikte taşı.
- `src/store/botStore.ts`: en az `bots`, ekleme ve `deleteBot(username)`; benzersiz kullanıcı adı ve giriş doğrulama. Çalışan Mineflayer nesnelerini Pinia veya kalıcı JSON içine koyma.
- `src/views/BotManagementView.vue`: bot oluşturma formu, mevcut liste ve toast bileşenleri, pencere kapatma kontrolü.
- `src/views/BotView.vue`: seçilen bot, gerçek bağlantı durumu ve bağlantı kontrolleri. Mesajlaşma eklenecekse gerçek backend çağrısına bağla.

İlk hedef: boş projede yönetim ekranı açılabilsin; eklenen bot listelensin. Veri kalıcılığı için main process içinde tek kayıt otoritesi kullan; birden fazla pencerenin Pinia durumlarının kendiliğinden paylaşılmadığını hesaba kat.

### C. Electron köprüsünü ve bot pencerelerini tamamla

1. `electron/preload.ts` ve `electron/electron-env.d.ts` içinde gerçek uygulamasıyla eşleşen tipli `electronAPI` tanımla. Mevcut `openBotWindow(username)` çağrısını destekle.
2. `electron/main.ts` içinde kullanıcı adı → pencere kaydı tut. Aynı bot için ikinci pencere açmak yerine mevcut pencereye odaklan; kapanınca kaydı temizle.
3. Geliştirme sunucusu ve paketlenmiş `loadFile` akışlarında bot rotasının doğru açıldığını doğrula. Kullanıcı adındaki özel karakterleri encode et.
4. `get-open-windows` için handler ekle veya UI ile birlikte daha basit, tipli bir açık bot listesi API'sine geç. URL parçalayarak durum çıkarmak yerine kimlik listesi kullan.
5. Abonelikler unsubscribe döndürsün; component unmount sırasında temizlensin. Polling gerekiyorsa interval de temizlensin.
6. Açık bot silme kısıtını yalnızca UI'da değil, main process'teki kayıt işlemlerinde de uygula. Pencere açık olmasını botun Minecraft'a bağlı olmasıyla karıştırma.
7. `close-window` isteğini gönderen pencereye uygula veya ana pencere kapatma çağrısını açıkça ayır; bot penceresi yanlışlıkla yönetim penceresini kapatmamalı.

### D. Mineflayer çalışma ortamını ve bot yaşam döngüsünü kur

1. Önce kullanılan Electron sürecinin `process.versions.node` değerini doğrula. Kurulu Mineflayer gereksinimi karşılanmıyorsa uyumlu Electron yükseltmesini değerlendir; gerekirse Node 22+ ayrı backend süreci seç. Sistem Node'unu yükseltmek tek başına Electron içindeki Node'u değiştirmez.
2. Önerilen yeni `electron/services/botManager.ts` içinde bot oluşturma, bağlanma, bağlantıyı kesme, hata/kick/end olayları ve temizlik uygula. Mimari ayrı süreç seçildiyse bu servis o sürece taşınmalı.
3. Gerekliyse `electron/services/botRepository.ts` ile `app.getPath('userData')` altında yapılandırma sakla. Bozuk JSON, yazma hatası ve çoklu pencere güncellemelerini ele al; kimlik doğrulama sırlarını düz yapılandırmaya yazma.
4. Gerçek durum değişimlerini IPC ile pencerelere dağıt. Yeni açılan pencere mevcut durumu sorgulayabilsin. İkinci bağlantı girişimi aynı botu çoğaltmasın.
5. Pencere kapanışı ve uygulama çıkışı için bağlantı/abonelik temizliği uygula; bot penceresi kapanınca bağlantının ne olacağı açık ve tutarlı olsun.

### E. Mevcut bileşenleri bağla ve görselleri düzelt

1. `Container.vue` içindeki sabit boş listeyi kaldır, gerçek store ve pencere durumuna bağla. Yorum satırındaki eski kodu doğrudan açmak yerine yeni sözleşmeyle uyumlandır.
2. Kullanılmayan `require` ve gereksiz importları temizle; TypeScript strict denetimlerini kapatarak hata gizleme.
3. İkon referanslarını düzelt. Mevcut font ve duvar kâğıtlarını koru; eski tasarımın tüm ayrıntıları bilinmiyor.
4. `index.html` başlığını ve `electron-builder.json5` içindeki `YourAppID`/`YourAppName` şablon değerlerini anlamlı MynBot değerleriyle değiştir.
5. Arayüzdeki Font Awesome harici kit isteğinin ağ yokken davranışını kontrol et; gerekiyorsa yerel ikon kullan. Bu bir kayıp yerel dosya kanıtı değil.

### F. Kabul kontrolleri

1. `./node_modules/.bin/vue-tsc --noEmit --incremental false`: sıfır hata.
2. `./node_modules/.bin/vite build`: renderer ve Electron çıktıları üretilebiliyor.
3. `npm run dev`: yönetim ekranı açılıyor, boş liste ve kapatma kontrolü çalışıyor.
4. Bot ekleme/silme, yinelenen kullanıcı adı ve geçersiz giriş senaryoları doğrulanıyor; kalıcı kayıt yeniden açılışta korunuyor.
5. Bot penceresi açma, ikinci açılışta odaklanma, kapatıp yeniden açma, açık bot silme engeli ve pencereler arası durum güncellemesi çalışıyor.
6. İzin verilen bir test sunucusunda gerçek bağlantı, bağlantı hatası, sunucudan atılma ve kullanıcı bağlantı kesme davranışı doğrulanıyor. Test sunucusu yoksa bu adım denenmedi olarak açıkça raporlanıyor.
7. `npm run build`: hedef platform paketlemesi; paketlenmiş uygulamada hash rotaları, preload, ikon ve fontlar doğrulanıyor. Ağ/yerel sistem bağımlılığından kaynaklı paketleme engelleri kod hatalarından ayrı raporlanıyor.

## 6. Terra'ya verilecek görev

> ONARIM_PLANI.md dosyasını oku ve A–F sırasıyla uygula. Önce mevcut kopyayı koru, kurtarılabilir gerçek kaynak varsa onu tercih et. Kaynak yoksa önerilen dosya adlarıyla eksik işlevleri yeniden kur. Eski dosyaların birebir kurtarıldığını iddia etme. Yalnızca derlemeyi geçiren boş store veya sahte bot bağlantısı bırakma; router, store, Electron köprüsü, çoklu pencere ve Mineflayer yaşam döngüsünü birbiriyle çalışır hale getir. Strict TypeScript kurallarını koru. Node/Electron/Mineflayer uyumunu çalışacak süreçte doğrula. Yapılan değişiklikleri, test sonuçlarını ve doğrulanamayan davranışları raporla.
