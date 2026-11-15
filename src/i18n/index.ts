import { ref } from 'vue';

export type Locale = 'tr' | 'en';

export const currentLocale = ref<Locale>(
  typeof localStorage !== 'undefined' && localStorage.getItem('mynbot_lang') === 'en' ? 'en' : 'tr'
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'mynbot_lang' && (e.newValue === 'tr' || e.newValue === 'en')) {
      currentLocale.value = e.newValue;
    }
  });
}

export function setLocale(lang: Locale): void {
  currentLocale.value = lang;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mynbot_lang', lang);
  }
}

export function toggleLocale(): Locale {
  const next = currentLocale.value === 'tr' ? 'en' : 'tr';
  setLocale(next);
  return next;
}

export function L(trText: string, enText: string): string {
  return currentLocale.value === 'en' ? enText : trText;
}

const MESSAGES: Record<Locale, Record<string, string>> = {
  tr: {
    // Uygulama & Navigasyon
    'app.title': 'MynBot',
    'app.subtitle': 'Gelişmiş Minecraft Bot & Otomasyon Kontrol Merkezi',
    'app.welcome': 'Minecraft Bot Yöneticisine Hoş Geldiniz',
    'nav.overview': 'Genel Bakış',
    'nav.chat': 'Sohbet & Konsol',
    'nav.inventory': 'Envanter',
    'nav.world': 'Dünya / Radar',
    'nav.plugins': 'Eklentiler & Kurallar',
    'nav.settings': 'Bağlantı Ayarları',
    'nav.back': 'Bot Listesine Dön',
    'nav.botList': 'Bot Listesi',

    // Durumlar
    'status.connected': 'Bağlı',
    'status.connecting': 'Bağlanıyor...',
    'status.disconnected': 'Bağlantı Kesildi',
    'status.error': 'Hata Oluştu',
    'status.idle': 'Boşta Bekliyor',
    'status.inGame': 'Oyunda Aktif',
    'status.kicked': 'Sunucudan Atıldı',

    // Aksiyonlar & Butonlar
    'controls.nextMusic': 'Karışık Sonraki Müzik',
    'music.downloading': 'İndiriliyor',
    'actions.connect': 'Sunucuya Bağlan',
    'actions.disconnect': 'Bağlantıyı Kes',
    'actions.changeWallpaper': 'Arka Planı Değiştir',
    'actions.musicOn': 'Minecraft Müziğini Çal',
    'actions.musicOff': 'Müziği Sustur',
    'actions.nextTrack': 'Sıradaki C418 Parçası',
    'actions.langSwitch': 'Dili Değiştir (TR / EN)',
    'actions.save': 'Değişiklikleri Kaydet',
    'actions.cancel': 'İptal',
    'actions.delete': 'Sil',
    'actions.add': 'Yeni Bot Ekle',
    'actions.refresh': 'Yenile',
    'actions.clear': 'Konsolu Temizle',
    'actions.close': 'Kapat',
    'actions.apply': 'Uygula',

    // Genel Bakış Paneli
    'overview.botName': 'Bot Kullanıcı Adı',
    'overview.server': 'Sunucu Adresi',
    'overview.version': 'Minecraft Sürümü',
    'overview.onlineSince': 'Çevrimiçi Süre',
    'overview.health': 'Can Puanı',
    'overview.food': 'Açlık Seviyesi',
    'overview.position': 'Koordinatlar (X, Y, Z)',
    'overview.dimension': 'Dünya Boyutu',
    'overview.gameMode': 'Oyun Modu',
    'overview.ping': 'Gecikme (Ping)',
    'overview.activeTasks': 'Aktif Görevler',

    // Sohbet & Konsol Paneli
    'chat.title': 'Canlı Sunucu Sohbeti & Konsol Kayıtları',
    'chat.placeholder': 'Mesaj veya komut yazın (/say, /tp, /help)...',
    'chat.send': 'Gönder',
    'chat.empty': 'Henüz sohbet veya konsol kaydı bulunmuyor.',
    'chat.autoScroll': 'Otomatik Kaydır',

    // Envanter Paneli
    'inventory.title': 'Gerçek Zamanlı Envanter & Sandık Arayüzü',
    'inventory.openQuick': 'Envanteri Aç (Hızlı Erişim)',
    'inventory.hotbar': 'Hızlı Erişim Çubuğu (Hotbar)',
    'inventory.armor': 'Zırh Kuşanımları',
    'inventory.main': 'Ana Envanter',
    'inventory.offhand': 'İkinci El (Sol El)',
    'inventory.crafting': '2x2 Üretim Alanı',
    'inventory.cursor': 'İmleçteki Eşya',
    'inventory.dropItem': 'Eşyayı Yere At (Q)',
    'inventory.heldItem': 'Eldeki Aktif Eşya',
    'inventory.clickToHold': 'İmlece almak için tıklayın, bırakmak için slota tıklayın.',

    // Dünya / Radar Paneli
    'world.title': 'İzometrik Çevre Radarı & Canlı Konum',
    'world.radar': 'Çevre Radarı',
    'world.nearbyEntities': 'Yakındaki Oyuncular & Yaratıklar',
    'world.nearbyBlocks': 'Önemli Etkileşim Blokları',
    'world.follow': 'Takip Et',
    'world.look': 'Oraya Bak',
    'world.walkTo': 'Buraya Yürü',
    'world.centerBot': 'Bota Odaklan',
    'world.radarZoom': 'Yakınlaştırma',
    'world.layer': 'Yükseklik Katmanı',

    // Eklentiler & Kurallar Paneli
    'plugins.title': 'Otomasyon, Eklenti ve Yanıt Kuralları',
    'plugins.subtitle': 'Botun sohbet tetikleyicilerine, saldırılara ve görevlere otomatik tepki vermesini yapılandırın.',
    'plugins.active': 'Etkinleştirildi',
    'plugins.inactive': 'Devre Dışı',
    'plugins.save': 'Eklenti Ayarlarını Kaydet',
    'plugins.addRule': 'Yeni Kural Ekle',
    'plugins.autoEat': 'Otomatik Yemek Yeme (AutoEat)',
    'plugins.autoEat.title': 'Otomatik Yemek (AutoEat)',
    'plugins.autoEat.description': 'Açlık veya can eşiği düşerse uygun yiyeceği kullanır.',
    'plugins.autoEat.hungerThreshold': 'Açlık eşiği',
    'plugins.autoEat.hungerHelp': 'Açlık bu değere veya altına indiğinde yemek yer.',
    'plugins.autoEat.healthThreshold': 'Can eşiği',
    'plugins.autoEat.healthHelp': 'Can bu değere veya altına indiğinde yemek yer.',
    'plugins.autoEat.selection': 'Yiyecek seçimi',
    'plugins.autoEat.saturation': 'Doygunluğu en yüksek',
    'plugins.autoEat.food': 'Açlık puanı en yüksek',
    'plugins.autoEat.allowGoldenApples': 'Altın elma kullanımına izin ver',
    'plugins.autoEat.restoreHeldItem': 'Yedikten sonra eldeki eşyayı geri al',
    'plugins.autoArmor.title': 'Otomatik Zırh (AutoArmor)',
    'plugins.autoArmor.description': 'Envanterdeki daha koruyucu zırh parçalarını otomatik kuşanır.',
    'plugins.autoArmor.interval': 'Kontrol aralığı (sn)',
    'plugins.autoArmor.intervalHelp': 'Daha iyi zırh için envanteri bu aralıkla kontrol eder.',
    'plugins.autoFishing.title': 'Otomatik Balıkçılık (AutoFishing)',
    'plugins.autoFishing.description': 'Botu suya bakacak şekilde konumlandır; oltaya ihtiyaç var.',
    'plugins.autoFishing.recastDelay': 'Yeniden atış beklemesi (sn)',
    'plugins.autoFishing.timeout': 'Yakalama zaman aşımı (sn)',
    'plugins.waitingForConnection': 'Bağlantı bekleniyor',
    'plugins.automation.idle': 'Beklemede',
    'plugins.automation.waiting': 'Eylem bekleniyor',
    'plugins.automation.running': 'Çalışıyor',
    'plugins.automation.error': 'Hata',
    'plugins.autoDefend': 'Otomatik Savunma (AutoDefend)',
    'plugins.antiAFK': 'AFK Önleyici Hareket (AntiAFK)',
    'plugins.chatTriggers': 'Sohbet Yanıtlayıcı (ChatTriggers)',
    'plugins.searchPlaceholder': 'Modül veya script ara...',
    'plugins.filterAll': 'Tümü',
    'plugins.filterActive': 'Aktifler',
    'plugins.filterBuiltin': 'Yerleşik',
    'plugins.filterScripts': 'Yerel Scriptler',
    'plugins.changeIcon': 'İkon Değiştir',
    'plugins.resetIcon': 'Varsayılan İkon',
    'plugins.customIconUrl': 'Görsel URL (https://...)',
    'plugins.uploadIcon': 'Görsel Yükle',
    'plugins.settingsHint': 'Ayarlar',
    'plugins.noMatch': 'Aramayla eşleşen eklenti bulunamadı.',

    // Bot Listesi & Giriş
    'launcher.title': 'Minecraft Bot Yöneticisi',
    'launcher.addHint': 'Eklemek istediğiniz bot kullanıcı adını yazın ve Enter tuşuna basın.',
    'launcher.noBots': 'Kayıtlı bot bulunmuyor. Yukarıdan bir bot ekleyin!',
    'launcher.botCount': '{count} Bot Kayıtlı',
  },
  en: {
    // App & Nav
    'app.title': 'MynBot',
    'app.subtitle': 'Advanced Minecraft Bot & Automation Command Center',
    'app.welcome': 'Welcome to Minecraft Bot Manager',
    'nav.overview': 'Overview',
    'nav.chat': 'Chat & Console',
    'nav.inventory': 'Inventory',
    'nav.world': 'World / Radar',
    'nav.plugins': 'Plugins & Rules',
    'nav.settings': 'Connection Settings',
    'nav.back': 'Back to Bot List',
    'nav.botList': 'Bot List',

    // Statuses
    'status.connected': 'Connected',
    'status.connecting': 'Connecting...',
    'status.disconnected': 'Disconnected',
    'status.error': 'Error Occurred',
    'status.idle': 'Idle',
    'status.inGame': 'Active In-Game',
    'status.kicked': 'Kicked from Server',

    // Actions & Buttons
    'controls.nextMusic': 'Shuffle Next Track',
    'music.downloading': 'Downloading',
    'actions.connect': 'Connect to Server',
    'actions.disconnect': 'Disconnect',
    'actions.changeWallpaper': 'Change Wallpaper',
    'actions.musicOn': 'Play Minecraft Music',
    'actions.musicOff': 'Mute Music',
    'actions.nextTrack': 'Next C418 Track',
    'actions.langSwitch': 'Switch Language (TR / EN)',
    'actions.save': 'Save Changes',
    'actions.cancel': 'Cancel',
    'actions.delete': 'Delete',
    'actions.add': 'Add New Bot',
    'actions.refresh': 'Refresh',
    'actions.clear': 'Clear Console',
    'actions.close': 'Close',
    'actions.apply': 'Apply',

    // Overview Panel
    'overview.botName': 'Bot Username',
    'overview.server': 'Server Address',
    'overview.version': 'Minecraft Version',
    'overview.onlineSince': 'Online Time',
    'overview.health': 'Health Points',
    'overview.food': 'Hunger Level',
    'overview.position': 'Coordinates (X, Y, Z)',
    'overview.dimension': 'World Dimension',
    'overview.gameMode': 'Game Mode',
    'overview.ping': 'Latency (Ping)',
    'overview.activeTasks': 'Active Tasks',

    // Chat & Console Panel
    'chat.title': 'Live Server Chat & Console Logs',
    'chat.placeholder': 'Type message or command (/say, /tp, /help)...',
    'chat.send': 'Send',
    'chat.empty': 'No chat messages or console records yet.',
    'chat.autoScroll': 'Auto Scroll',

    // Inventory Panel
    'inventory.title': 'Real-Time Inventory & Container Interface',
    'inventory.openQuick': 'Open Inventory (Quick Access)',
    'inventory.hotbar': 'Hotbar (Quick Access)',
    'inventory.armor': 'Armor Equipment',
    'inventory.main': 'Main Inventory',
    'inventory.offhand': 'Offhand (Left Hand)',
    'inventory.crafting': '2x2 Crafting Grid',
    'inventory.cursor': 'Held Item on Cursor',
    'inventory.dropItem': 'Drop Item (Q)',
    'inventory.heldItem': 'Currently Held Item',
    'inventory.clickToHold': 'Click to pick up, click slot to place.',

    // World / Radar Panel
    'world.title': 'Isometric Environment Radar & Live Position',
    'world.radar': 'Surroundings Radar',
    'world.nearbyEntities': 'Nearby Players & Mobs',
    'world.nearbyBlocks': 'Interactive Blocks',
    'world.follow': 'Follow',
    'world.look': 'Look Here',
    'world.walkTo': 'Walk Here',
    'world.centerBot': 'Center on Bot',
    'world.radarZoom': 'Zoom Level',
    'world.layer': 'Height Layer',

    // Plugins & Rules Panel
    'plugins.title': 'Automation, Plugins & Response Rules',
    'plugins.subtitle': 'Configure how the bot reacts to chat triggers, attacks, and background duties.',
    'plugins.active': 'Enabled',
    'plugins.inactive': 'Disabled',
    'plugins.save': 'Save Plugin Settings',
    'plugins.addRule': 'Add New Rule',
    'plugins.autoEat': 'Automatic Eating (AutoEat)',
    'plugins.autoEat.title': 'Automatic Eating (AutoEat)',
    'plugins.autoEat.description': 'Uses suitable food when hunger or health reaches its threshold.',
    'plugins.autoEat.hungerThreshold': 'Hunger threshold',
    'plugins.autoEat.hungerHelp': 'Eats when hunger reaches or falls below this value.',
    'plugins.autoEat.healthThreshold': 'Health threshold',
    'plugins.autoEat.healthHelp': 'Eats when health reaches or falls below this value.',
    'plugins.autoEat.selection': 'Food selection',
    'plugins.autoEat.saturation': 'Highest saturation',
    'plugins.autoEat.food': 'Most hunger points',
    'plugins.autoEat.allowGoldenApples': 'Allow golden apples',
    'plugins.autoEat.restoreHeldItem': 'Restore held item after eating',
    'plugins.autoArmor.title': 'Automatic Armor (AutoArmor)',
    'plugins.autoArmor.description': 'Automatically equips more protective armor pieces from the inventory.',
    'plugins.autoArmor.interval': 'Check interval (sec)',
    'plugins.autoArmor.intervalHelp': 'Checks the inventory for better armor at this interval.',
    'plugins.autoFishing.title': 'Automatic Fishing (AutoFishing)',
    'plugins.autoFishing.description': 'Face the bot toward water; a fishing rod is required.',
    'plugins.autoFishing.recastDelay': 'Recast delay (sec)',
    'plugins.autoFishing.timeout': 'Catch timeout (sec)',
    'plugins.waitingForConnection': 'Waiting for connection',
    'plugins.automation.idle': 'Idle',
    'plugins.automation.waiting': 'Waiting for action',
    'plugins.automation.running': 'Running',
    'plugins.automation.error': 'Error',
    'plugins.autoDefend': 'Self Defense (AutoDefend)',
    'plugins.antiAFK': 'Anti-AFK Movement (AntiAFK)',
    'plugins.chatTriggers': 'Chat Responder (ChatTriggers)',
    'plugins.searchPlaceholder': 'Search modules or scripts...',
    'plugins.filterAll': 'All',
    'plugins.filterActive': 'Active',
    'plugins.filterBuiltin': 'Built-in',
    'plugins.filterScripts': 'Local Scripts',
    'plugins.changeIcon': 'Change Icon',
    'plugins.resetIcon': 'Reset Icon',
    'plugins.customIconUrl': 'Image URL (https://...)',
    'plugins.uploadIcon': 'Upload Image',
    'plugins.settingsHint': 'Settings',
    'plugins.noMatch': 'No plugins match your filter.',

    // Launcher
    'launcher.title': 'Minecraft Bot Launcher',
    'launcher.addHint': 'Enter bot username and press Enter to register.',
    'launcher.noBots': 'No bots registered yet. Add a bot above!',
    'launcher.botCount': '{count} Registered Bots',
  },
};

export function t(key: string, params?: Record<string, string | number>): string {
  const lang = currentLocale.value;
  let text = MESSAGES[lang]?.[key] ?? MESSAGES.tr?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function useI18n() {
  return {
    locale: currentLocale,
    setLocale,
    toggleLocale,
    L,
    t,
  };
}
