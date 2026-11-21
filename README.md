# Stok Portal

Tek dosyalık, **çevrimdışı** çalışan stok takip uygulaması. Kurulum, sunucu veya internet gerekmez: `index.html` dosyasını Chrome/Edge ile açmak yeterlidir.

| Akış | Açıklama |
|---|---|
| 🛒 **Ticari** | Alış (gelen) → Satış (giden) → Kalan |
| 🥩 **Ham** | Alış (gelen) → Üretimde kullanılan (giden) → Kalan |
| 🏭 **Mamül** | Üretilen (gelen) → Satılan (giden) → Kalan |

- **Üretim:** çok girdili, yan ürünlü; fire otomatik; randıman. Girdi maliyeti mamüle ve yan ürüne dağıtılır.
- **Maliyet ve takribi kâr:** alışta birim fiyat → hareketli ağırlıklı ortalama maliyet. Satış fiyatı girilmezse *ortalama maliyet × (1 + kâr oranı)* ile tahmin edilir (genel oran Ayarlar'da, ürün bazlı Kartlar'da). Tahmini rakamlar "takribi" etiketlidir.
- **Zayiat/ikram**, **sipariş listesi**, **Stok durumu** (Devir + Gelen − Giden = Kalan).
- **Stok sayımı = sayım fişi:** ürün/genel fark nedeni, zorunlu yazılı açıklama (izahat), düzeltme hareketi, sayım geçmişi, iptal, yazdırılabilir rapor.
- **Hata düzeltme:** düzenleme/silme, arşivden geri alma, üretim ve sayım iptali. Stoğu eksiye düşürecek işlemler engellenir.
- **Kullanıcılar, roller, günlük:** isteğe bağlı giriş koruması; Yönetici / Yetkili / Personel / İzleyici; kim ne zaman ne yaptı kaydı.
- **Yedek:** seçilen klasöre/dosyaya **her değişiklikte anlık yedek**; konum seçilmezse/bulunamazsa veri tarayıcıda tutulur ve uyarı verilir.
- **Sürüm güncelleme bildirimi:** yeni sürüm açılınca "neler yeni", eski dosyanın yeni veriyi bozması engellenir, GitHub'dan yeni sürüm denetimi.

## Hızlı başlangıç

1. `index.html` dosyasını indirip **Chrome** veya **Edge** ile açın.
2. Açılışta çıkan pencereden **yedek klasörü** (önerilen) veya **tek yedek dosyası** seçin. *(Windows/Chrome Masaüstü, Belgeler, İndirilenler'in kendisini seçtirmez: içinde yeni bir klasör, örn. `StokYedek`, oluşturup onu seçin.)*
3. **Kartlar** sayfasında stok kartlarınızı açın (Ham / Mamül / Ticari); sonra **Alış → Üretim → Satış** ile çalışın.
4. Birden fazla kişi kullanacaksa **Ayarlar → Kullanıcılar → Korumayı aç**.

Denemek için Panel'deki **"Örnek veriyle dene"** düğmesini kullanabilirsiniz.

## Yedekleme

Veriler **bu bilgisayardaki tarayıcıda** (IndexedDB) saklanır; hiçbir sunucuya gönderilmez. Her değişiklikte (~0,4 sn sonra):

1. Tarayıcı ana kaydı + eşzamanlı yerel kopya güncellenir, tarayıcı içi döner anlık görüntüler (son 30) tutulur.
2. **Seçilen yedek konumuna** yazılır:
   - **Klasör:** `stok_portal_guncel.json` (her değişiklik), `gunluk_YYYYMMDD.json` (son 90 gün), `anlik_*.json` (saatlik, son 48), `oncesi_*.json` (geri yükleme/silme/sürüm yükseltme öncesi).
   - **Tek dosya:** seçilen `.json` dosyası her değişiklikte üzerine yazılır (geçmiş tutulmaz).

**Konum seçilmemişse, bulunamazsa veya izin düşerse:**

- Veri **tarayıcıda tutulmaya devam eder** (işlem engellenmez).
- Üstte kalıcı kırmızı/sarı uyarı çıkar; açılışta seçim penceresi gösterilir; üst çubuk "⚠ yedek yok" der; uyarıda **"Yedeği indir"** düğmesi bulunur.
- Yedeksiz değişiklik varken sekmeyi kapatırken tarayıcı onay ister; 10 dakikada bir hatırlatma verilir.
- Konum geri gelince (silinen klasör yeniden oluşturulunca, sürücü takılınca vb.) uygulama **otomatik yeniden bağlanır** ve güncel yedeği yazar.
- Chrome yeniden açıldığında konum iznini yeniden isteyebilir: uyarıdan **"İzin ver"**.

Yedekten dönmek: **Ayarlar → Yedekleme → Yedekten aç…** veya listeden **Geri yükle** (işlemden önce mevcut durumun görüntüsü otomatik alınır).

> ⚠️ **Tarayıcı verisini (site verilerini) silmeyin.** Silerseniz yedek konumu son kurtarma yoludur.
> ⚠️ **Aynı adresten kullanın.** Veri, uygulamanın açıldığı adrese bağlıdır. Dosyadan açıp sonra GitHub Pages'e (veya tersine) geçerseniz yeni adres boş görünür: eski adreste **Yedeği indir**, yenisinde **Yedekten aç…** yapın.
> ⚠️ İki sekmede birden açmayın: ikinci sekmede değişiklik olursa eski sekme verinin üzerine yazmamak için kaydı durdurur ve uyarır.
> Firefox/Safari'de uygulama çalışır ancak klasöre otomatik yazamaz; düzenli "Yedeği indir" kullanın (uygulama bunu hatırlatır).

## Kullanıcılar, roller ve günlük

Ayarlar → Kullanıcılar'dan **Giriş korumasını aç**: ilk **yönetici** hesabı oluşturulur ve **tek seferlik kurtarma kodu** gösterilir (yönetici şifresi unutulursa tek yol; yazdırıp saklayın). Koruma kapalıyken herkes her şeyi yapabilir.

| İzin | Yönetici | Yetkili | Personel | İzleyici |
|---|:-:|:-:|:-:|:-:|
| Stok durumu ve hareketleri görme | ✓ | ✓ | ✓ | ✓ |
| Alış / Üretim / Satış / Zayiat girişi | ✓ | ✓ | ✓ | – |
| Maliyet, kâr, ciro görme | ✓ | ✓ | – | – |
| Düzenleme / silme / geri alma / iptal | ✓ | ✓ | – | – |
| Stok sayımı, stok kartı yönetimi | ✓ | ✓ | – | – |
| Günlüğü görme | ✓ | ✓ | – | – |
| Ayarlar, yedekleme, geri yükleme, veri silme | ✓ | – | – | – |
| Kullanıcı yönetimi | ✓ | – | – | – |

- Personel/izleyici ekranlarında maliyet, değer, kâr ve ciro **gösterilmez** (tablo sütunları ve özetler kaldırılır). Personel alışta fiyat girmezse mevcut ortalama maliyet kullanılır.
- Her hareket kaydı kullanıcı adıyla işaretlenir; **Günlük** sekmesi girişleri, hatalı girişleri, kilitleri, kayıt/silme/düzenleme, kart, ayar, yedek ve kullanıcı değişikliklerini listeler (en fazla 10 000 satır; CSV'ye aktarılabilir).
- Şifreler PBKDF2-SHA256 + rastgele tuz ile saklanır; 5 hatalı denemeden sonra geçici bekleme; hareketsizlikte (varsayılan 15 dk) oturum kilitlenir; yönetici şifre sıfırlayınca kullanıcı ilk girişte kendi şifresini belirler. Kullanıcılar silinmez, pasifleştirilir.

> ⚠️ **Güvenlik sınırı:** uygulama sunucusuz çalışır; bu bir **operasyonel erişim kontrolüdür** (kim ne yaptı, kim neyi görür). Teknik bilgisi olan biri yedek dosyasını açarak veya tarayıcı konsolundan verilere ve günlüğe ulaşabilir/değiştirebilir; yedek dosyaları **şifrelenmez**. Gerçek güvenlik için bilgisayarın kendi kullanıcı hesabını ve disk şifrelemeyi de kullanın. Birden çok bilgisayarda aynı anda ortak veriyle çalışmak için sunucu gerekir (kapsam dışı).

## Sürüm güncelleme

- **Yeni dosya açılınca:** veri daha eski bir sürümle kullanılmışsa uygulama önce otomatik anlık görüntü alır, veriyi yükseltir ve **"Uygulama güncellendi — neler yeni"** gösterir.
- **Koruma:** veri bu dosyadan *daha yeni* biçimde kaydedilmişse dosya veriye dokunmaz, kayıt yapmaz ve "güncel index.html'i kullanın" der. Verinin son kullanıldığı sürümden daha eski bir dosya açılırsa uyarılır.
- **Yeni sürüm denetimi:** Ayarlar → Sürüm'de `kullanıcı/depo` yazılırsa uygulama (internet varken) açılışta depodaki `version.json` dosyasını okuyup bildirir; Pages'te yayınlanıyorsa aynı adresteki `version.json` da denetlenir. Çevrimdışıyken sessizce atlanır.
- **Güncelleme adımları:** ① yedek alın ② yeni `index.html`'i eskisinin üzerine yazın (aynı yerden/adresten açın) ③ açılışta bildirim çıkar. Veriler tarayıcıda kaldığı için kaybolmaz.

## GitHub'a koymak ve yayınlamak

`.gitignore`, yedek dosyalarını ve eski veritabanlarını dışarıda tutar; yine de `stok_portal_*.json`, `anlik_*`, `gunluk_*` gibi dosyaları depoya **elle eklemeyin**. `index.html` ve `version.json` **depoya dahildir** (indirip çalıştırmak ve güncelleme denetimi için).

İsteğe bağlı GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / `(root)`*. Adres `https://<kullanıcı>.github.io/<depo>/`. Ücretsiz hesapta Pages için depo herkese açık olmalıdır (uygulama kodu açık olur; verileriniz yalnızca kendi tarayıcınızdadır). Hassas işletme verisi için dosyayı yerelden (`file://`) kullanmak daha az yüzey bırakır.

## Geliştirme

```bash
node build.js          # src/ → index.html + version.json
node build.js --check  # güncel mi? (CI çalıştırır; package.json sürümünü de denetler)
npm test               # 6 test takımı (bağımlılık yok, Node ≥ 18)
```

```
src/head.html   CSS ve sayfa iskeleti        src/kimlik.js  giriş, roller, şifre (PBKDF2), kurtarma kodu
src/surum.js    sürüm, veri biçimi, neler yeni  src/depo.js    IndexedDB, yedek konumu, sürüm denetimi
src/motor.js    stok/maliyet/üretim/sayım/rapor mantığı, yetki denetimi, günlük
src/ui.js       sayfalar, canlı hesaplar, pencereler, olaylar    src/tail.html
tests/          Node testleri + sahte DOM/IndexedDB/klasör (gerçek tarayıcı gerekmez)
docs/GELISTIRME.md  mimari, değişmez kurallar, yeni sürüm yayınlama
```

**Yeni sürüm yayınlama:** `src/surum.js` içinde `SURUM` ve `DEGISIKLIKLER` → `package.json` sürümü → `CHANGELOG.md` → `node build.js` → `npm test` → commit (`index.html` ve `version.json` dahil) → isteğe bağlı etiket/release. Veri biçimi değişirse `DB_SEMA`'yı artırıp `dogrula()` içinde eski veriyi yükseltin.

## Test durumu — dürüst not

Testler mantığı (stok/maliyet/üretim/sayım/silme-geri alma), kimlik ve yetkileri (kripto yedek uygulaması gerçek PBKDF2 ile karşılaştırılır; roller, kilit, kurtarma), arayüz akışlarını (sahte DOM'la sayfalar üretilip alanlar doldurulur, düğmelere tıklanır; personel sayfalarında maliyet sızıntısı taranır) ve yedek katmanını (sahte IndexedDB/klasör/dosya: konum kaybı, izin kaybı, yeniden bağlanma, yedeksiz uyarılar, çoklu sekme, sürüm yükseltme, daha yeni veri koruması) doğrular. **Gerçek tarayıcıda otomatik test yoktur**: görsel düzen, yazdırma çıktısı, Chrome'un klasör/dosya seçici ve izin davranışı elle denenmelidir. Bulduğunuz sorunları ekran görüntüsüyle iletin.

## Bilinen sınırlar

- Tek bilgisayar. Birden çok bilgisayarda eşzamanlı ortak veri için sunucu gerekir (kapsam dışı).
- Kullanıcı koruması ve günlük sunucusuzdur: teknik olarak aşılabilir/değiştirilebilir (bkz. güvenlik sınırı).
- Reçete/menü bazlı otomatik stok düşümü yoktur (bilinçli olarak çıkarıldı).
- Ondalık için virgül kullanın: `1250` veya `1,25`; nokta ondalık sayılır (`1.250` = 1,25).
- Satışta girilmeyen fiyat için kaydedilen kâr oranı sonradan değişmez.
