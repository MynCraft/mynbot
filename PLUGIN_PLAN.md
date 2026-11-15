# Yararlı otomasyon modülleri — 15 Kasım 2026

Kapsam: mevcut eklenti sistemine üç yerleşik modül eklemek. Kullanıcı planlama, Terra/Luna ile uygulama ve ana ajan tarafından kontrol istedi. Modüller varsayılan kapalıdır; bot başına ayarları mevcut `bots.json` içinde saklanır. Eski ayar dosyaları yeni varsayılanlarla açılmalıdır.

## Araştırma ve uygulama tercihi

- Mineflayer API: https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md (`equip`, `consume`, `fish`, envanter ve sağlık olayları).
- Auto-Eat örneği: https://github.com/nxg-org/mineflayer-auto-eat
- Auto-Armor örneği: https://github.com/nxg-org/mineflayer-auto-armor
- Hazır paketlerin kullanım alanları incelendi. Bu sürümde yeni harici bağımlılık kurmadan, mevcut Mineflayer API'leriyle uygulamaya özgü yerleşik modüller yazılacak; kaynak kodu kopyalanmayacak. Böylece kalıcılık, durdurma ve eldeki eşya koordinasyonu tek yerde yönetilebilir.

## Modüller ve ortak veri sözleşmesi

1. **Otomatik Yemek / `autoEat`**: açlık `hungerThreshold` değerine indiğinde veya sağlık `healthThreshold` altına indiğinde, bot yiyebilecek durumdaysa uygun yiyeceği seçer. `selection: 'saturation' | 'food'`; zehirli/özel etkisi belirsiz yiyecekler dışlanır. Altın elmalar `allowGoldenApples` ile açıkça seçilir. `restoreHeldItem` eski eldeki eşyayı hâlâ mevcutsa geri takar.
   - Varsayılan: `{ enabled: false, hungerThreshold: 16, healthThreshold: 10, selection: 'saturation', allowGoldenApples: false, restoreHeldItem: true }`.
2. **Otomatik Zırh / `autoArmor`**: envanterdeki daha koruyucu parçaları doğru zırh yuvasına kuşanır. Eşdeğer veya daha kötü parçaları sürekli değiştirip durmaz; slot/kimlik tekrar kontrolü yapar.
   - Varsayılan: `{ enabled: false, intervalSeconds: 10 }`.
3. **Otomatik Balıkçılık / `autoFishing`**: olta mevcutken mevcut bakış yönünde balık tutar ve yakalama sonrası tekrar atar. Suya yönelme veya otomatik yol bulma bu modülün işi değildir. Yemek ve manuel işlemler balıkçılığı kesebilir. Eksik olta, başarısız yakalama ve zaman aşımı kontrollü beklemeye geçer.
   - Varsayılan: `{ enabled: false, recastDelaySeconds: 2, timeoutSeconds: 60 }`.

Arayüz için opsiyonel `BotData.automation` sözleşmesi: modül anahtarı → `{ state: 'idle' | 'waiting' | 'running' | 'error', message?: string, lastRunAt?: number }`. Mesaj gerçek çalışma durumundan gelir; sahte başarı göstergesi yoktur.

## Çalışma kuralları

- Her botun otomasyonları kendi yaşam döngüsüne bağlıdır. Spawn, canlı ayar değişikliği, modülün kapanması ve disconnect/reconnect için timer/dinleyici temizliği gerekir.
- Yemek, zırh ve balıkçılık eldeki eşya/envanter işlemlerini çakıştırmaz. Manuel envanter, açık konteyner, imleçte eşya ve manuel hareket/etkileşim sırasında otomasyon bekler veya ilgili balıkçılık eylemini bırakır.
- Zaman aşımı ve iptal generation/token kontrolleriyle eski bağlantının yeni bağlantıya müdahalesini engeller. Reddedilen Promise'ler yakalanır; loglar sınırlı/sıklık kontrollüdür.
- Ayar doğrulaması tüm sayısal alanlarda sonlu değer, alt/üst sınır ve eski kayıt uyumluluğunu kapsar.

## İş paylaşımı

- **Terra:** `src/types/bot.ts`, `electron/services/pluginConfig.ts`, worker/otomasyon modülü, gerekli `BotManager` veri aktarımı, kalıcılık uyumluluğu ve backend testleri.
- **Luna:** `src/components/Plugins/PluginsPanel.vue`, `PluginSettingsModal.vue`, gerekirse `PluginIcon.vue` ve TR/EN metinleri. Yeni kartlar, durumlar, ayarlar, özetler, tüm ayarların klonlanıp kaydedilmesi. Mevcut Lucide/cam tasarımı korunur.
- **Ana ajan:** entegrasyon, bağımsız kontrol, görsel önizleme, bu plan ve `STATUS.md`. Dosya sahiplikleri çakıştırılmaz.

## Kabul kontrolleri

- Düşük açlık/sağlık, uygun yiyecek seçimi, yasaklı yiyecekler, eski eşyanın geri alınması ve açık menüde bekleme.
- Daha iyi zırhın kuşanması, eşit parçada değişim döngüsü olmaması ve eksik parçada bekleme.
- Olta eksikliği, tekrar atma, zaman aşımı/iptal, modül kapanışı ve balıkçılık-yemek etkileşimi.
- Eski ayar dosyası, yeni alanların kaydedilip yeniden okunması, geçersiz sayılar ve çoklu bot/bağlantı temizliği.
- Anlamlı otomasyon testleri, worker sözdizimi, TypeScript ve Vite derlemesi. Görsel testler yalnızca izole profil/veriyle yapılır. Gerçek Minecraft protokol testi ile mock testin kapsamı sonuçta ayrı belirtilir; denenmeyen şey denenmiş gibi raporlanmaz.


## Uygulama sonucu

Üç modül Terra/Luna ile uygulandı ve ana ajan tarafından kontrol edildi. Ayrıntılı sonuç, sınırlamalar ve görsel kayıtlar `STATUS.md` içindeki 15 Kasım otomasyon kaydında. Kuşanılmış büyülü zırh/elytra korunur; büyü optimizasyonu yapılmaz. Balıkçılık yalnızca bakış yönünde su varken çalışır.

Tekrar kontrol komutları:

```sh
node tests/automation.test.cjs
node tests/plugin-config.test.cjs
# Mineflayer için Node 22+ ve localhost port açma izni gerekir:
node tests/automation-protocol.test.cjs
npx vue-tsc --noEmit
npx vite build
```

Gerçek worker ile yerel 1.16.5 protokol sunucusunda otomatik yemek doğrulandı. Zırh ve balıkçılığın otomasyon senaryoları sahte botla test edildi; gerçek sunucuda yakalama/kuşanma testi yapılmadı.
