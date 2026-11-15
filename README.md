# MynBot

Minecraft sunucuları için Electron tabanlı bot yöneticisi. Kayıp kaynakların bir kısmı yeniden oluşturulmuştur; eski arayüzün veya tüm eski özelliklerin birebir kurtarıldığı anlamına gelmez.

## Gereksinimler ve çalıştırma

- Bağımlılıkları `npm install` ile yükleyin.
- Bot bağlantıları için bilgisayarda Node.js **22 veya üzeri** bulunmalıdır. Electron 30 kendi içinde Node 20 kullandığından Mineflayer ayrı bir Node işleminde çalışır. Program önce `MYNBOT_NODE` değişkenini, sonra `PATH` üzerindeki `node` komutunu ve Linux'ta `~/.local/share/nvm` altındaki kurulumları kontrol eder. Değişkene Node çalıştırılabilir dosyasının tam yolunu verebilirsiniz.
- Geliştirme için `npm run dev`, dağıtım paketi için `npm run build` çalıştırın. Electron Builder ilk paketlemede platforma özel dosyaları indirmek için ağ erişimi isteyebilir.
- Paketlenmiş uygulama da bot bağlantısı için sistemde ayrı bir Node 22+ kurulumuna ihtiyaç duyar.

Yönetim ekranında bot adını girip ekleyin; listeden bot penceresini açın, Sunucu ayarları bölümünde adres ve portu kaydedin ve **Bağlan** seçeneğine basın. Envanter ve canlı sohbet ayrı sekmelerdedir; panelin arka planı yenileme düğmesiyle değiştirilebilir. İsteğe bağlı Minecraft sürümü belirtilmezse sürüm otomatik algılanır. Yalnızca çevrimdışı hesapla bağlantı desteklenir. Bot penceresi kapatılınca bağlantısı kesilir. Penceresi açık olan bot silinemez.

Bot ayarları Electron'un kullanıcı verisi dizinindeki `bots.json` dosyasında saklanır. Bu dosyada şifre veya Microsoft hesabı bilgisi tutulmaz. Dosya okunamaz ya da bozuksa üzerine yazılmaz ve uygulama hata gösterir.

Bağlantıların çalışması, sunucunun çevrimdışı hesapları kabul etmesine, belirtilen sürüme ve sunucu erişimine bağlıdır.
