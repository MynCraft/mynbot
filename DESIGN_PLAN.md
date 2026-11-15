# Tasarım iyileştirme planı — 15 Kasım 2026

Amaç: mevcut özellikleri koruyarak emoji ağırlıklı arayüzü daha tutarlı, sakin ve modern hale getirmek. Arka planın seçilebildiği saydam yüzeyler; okunaklı metinler ve ölçülü Minecraft kimliği.

## Görsel kararlar

- Sistem düğmeleri ve gezinmede Lucide SVG ikonları; ortak boyut 16–18 px ve çizgi kalınlığı yaklaşık 1,7 px. Minecraft eşya dokuları korunur.
- Kontrollerde 8 px, gruplarda 12 px, kart ve modallarda 16 px temel köşe ölçeği. Birbirinden kopuk radius, ağır neon glow ve gereksiz yükselme animasyonları azaltılır.
- Cam yüzeyler koyu lacivert/gri ve hafif beyaz kenarlı olur. Arka planı tek karartma katmanı dengeler; kartlar ve sol menü görseli tamamen örtmez. Form/sohbet metinleri için daha yoğun iç yüzey korunur.
- Yeşil vurgu esas olarak bağlantı eylemi, etkin gezinme ve durumlara ayrılır. İkincil eylemler sakin nötr kontrollerdir.
- Üst kısım bot kimliği/bağlantı eylemi ile görünüm, müzik ve dil araçlarını ayrı gruplar halinde sunar. Müzik değiştirme tek anlamlı SVG ikonuyla ifade edilir.
- Minecraftia marka ve kısa başlıklarda kalır. Form ve uzun metinlerde okunaklı sans yazı ve tutarlı hiyerarşi kullanılır.
- Kullanıcının kendi seçtiği özel eklenti ikonları silinmez. Sistem varsayılanları ve ikon seçicinin hazır sembolleri emoji yerine SVG simgeler olur.
- Klavye odağı, erişilebilir adlar, devre dışı durumlar ve azaltılmış hareket tercihi korunur.

## İş paylaşımı ve dosya sahipliği

**Terra:** `src/style.css`, `src/views/BotView.vue`, `src/views/BotManagementView.vue`, `src/components/BotList/*`, yeni ortak `src/components/ui/AppIcon.vue`. Genel tasarım tokenları, üst araç düzeni, ana panel ve başlatıcı.

**Luna:** `src/components/World/IsoWorldView.vue`, `src/components/Inventory/ContainerModal.vue`, `src/components/Plugins/*`. Dünya ve modal kontrollerinin SVG dönüşümü, scoped stiller, eklenti simge seçici. Gerekirse yalnızca yeni `icon:` ikon değerlerini kabul etmek için `electron/services/pluginConfig.ts` doğrulaması; bot davranışına dokunulmaz.

**Ana ajan:** ikon bağımlılığı, koordinasyon, tasarım incelemesi, birleşik doğrulama ve `STATUS.md` kaydı. Ajanlar sahip olmadıkları dosyalarda değişiklik yapmaz; ortak ihtiyaçları mesajla paylaşır.

## Kabul kontrolü

- Sistem düğmelerinde ve harita işaretçilerinde emoji kullanılmaması; gerçek kullanıcı içeriklerinin korunması.
- Dar başlatıcı ve minimum/geniş bot panelinde taşmayan araç grupları.
- Arka planın fark edilebildiği, metin ve kontrolleri okunaklı kalan saydam yüzeyler.
- Sohbet, envanter, dünya, eklentiler, müzik ve bağlantı davranışlarının korunması.
- TypeScript kontrolü ve Vite derlemesi; mümkünse izole profil/önizleme ile ekran görüntüleri ve görsel kontrol.
- Yapılanlar ve doğrulanamayan durumlar eski kayıtlar korunarak `STATUS.md` sonuna eklenir.
