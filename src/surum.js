'use strict';
// Sürüm bilgisi. Yeni sürüm yayınlarken: SURUM, DEGISIKLIKLER, package.json ve CHANGELOG.md birlikte güncellenir.
const SURUM = '3.2.0';
const VARSAYILAN_REPO = 'aipersonal111-byte/stok-portal';   // güncelleme denetimi bu depodaki version.json'a bakar; kullanıcı bir şey girmez
const VARSAYILAN_DAL = 'main';
const DB_SEMA = 2;           // veri biçimi sürümü: eski dosya, daha yeni biçimdeki veriyi bozmasın diye kontrol edilir
const DEGISIKLIKLER = [
  { s: '3.2.0', t: '2026-11-21', n: [
    'Excel (.xlsx) / CSV\'den içe aktarma: sütunları (ürün, kategori, grup, birim, asgari, miktar, maliyet, kâr) kendisi tanır, önizleme ve düzeltme sunar; kartları ve açılış stoğunu tek seferde ekler',
    'Panel\'de son yedek bilgisi; boş (0 kartlı) yedeği geri yüklerken ek uyarı',
    'Sürüm yayınlamak kolaylaştı: build.js package.json sürümünü kendisi eşitler; GitHub\'da otomatik build iş akışı eklendi',
  ] },
  { s: '3.1.6', t: '2026-11-20', n: [
    'Yedek listelerinde her yedeğin içeriği (kart / hareket sayısı) gösterilir: boş veya eski bir anlık görüntüyü yanlışlıkla geri yüklemek zorlaşır',
    'Sekme gizlenirken/kapanırken (son anlıktan 10 dakika geçmişse) anlık yedek de alınır; böylece anlık dosyalar oturumun başındaki eski hâli değil sonuna yakın hâli tutar',
    'Yedek ekranına "Anlık yedek nedir?" açıklaması eklendi',
  ] },
  { s: '3.1.5', t: '2026-11-20', n: [
    'Chrome/Edge adres çubuğunda "Yükle" düğmesi: uygulama bilgisayara kurulabilir (kendi penceresi ve simgesi), internetsiz açılır',
    'Web adresinden/yüklü uygulamadan açılınca güncelleme tek düğmeyle yapılır (yedek al + yenile); dosya indirmek gerekmez',
  ] },
  { s: '3.1.4', t: '2026-11-20', n: [
    'Açılışta tarayıcı çağrılarından biri takılsa bile uygulama "Yükleniyor" ekranında kalmaz (zaman aşımı); beklenmedik hata olursa nedeni ekranda gösterilir',
  ] },
  { s: '3.1.3', t: '2026-11-20', n: [
    'Güncelleme deposu uygulamaya gömüldü (aipersonal111-byte/stok-portal): kullanıcının depo adı girmesi gerekmez, yeni sürüm denetimi kendiliğinden çalışır',
  ] },
  { s: '3.1.2', t: '2026-11-20', n: [
    'Yeni sürüm uyarısına "Yeni sürümü indir ve güncelle" düğmesi eklendi: önce yedek alır, GitHub\'dan yeni index.html\'i indirir ve doğrular, eski dosyanın üzerine yazdırır (veya indirir)',
    'Sürüm numarası 3.1.2 olarak düzenlendi',
  ] },
  { s: '1.1.0', t: '2026-11-13', n: [
    'Kullanıcı girişi, roller (Yönetici / Yetkili / Personel / İzleyici) ve kayıt günlüğü (kim, ne zaman, ne yaptı)',
    'Personel ve izleyici rollerinde maliyet, kâr ve ciro bilgileri gizlenir',
    'Yedek konumu (klasör veya tek dosya) seçilmeli: seçilmezse, bulunamazsa veya izin düşerse uyarı verilir; yedeksiz kapatmada onay istenir',
    'Sürüm güncelleme bildirimi: yeni sürüm açılınca "neler yeni", eski dosyanın yeni veriyi bozması engellenir, GitHub\'dan yeni sürüm denetimi',
  ] },
  { s: '1.0.0', t: '2026-11-12', n: ['İlk sürüm: stok, üretim, satış, zayiat, sayım fişi, takribi maliyet ve kâr, otomatik yedek.'] },
];
const surumKarsilastir = (a, b) => {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
};
