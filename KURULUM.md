# Kobi Defter v3.0 — Çevrimiçi Kurulum Rehberi

Bu klasördeki dosyaları bir web adresinde (https) yayınlarsınız. Program o adresten açılır, **ilk açılıştan sonra internetsiz de çalışır**. Verileriniz yine **sizin cihazınızda** durur; isterseniz Google Drive'a da eşlenir.

Dosyalar: `index.html` (program), `sw.js` (çevrimdışı + güncelleme), `manifest.webmanifest` + 3 simge (uygulama olarak yükleme), `version.json` (yenilik notları).

## 1) Yayınlama (ücretsiz, 10 dakika) — GitHub Pages
1. github.com'da hesap açın → **New repository** → ad: `kobi-defter` → Public → Create.
2. **Add file → Upload files**: bu klasördeki TÜM dosyaları sürükleyin → Commit.
3. **Settings → Pages → Branch: main / root → Save**.
4. 1–2 dakika sonra adresiniz: `https://KULLANICIADINIZ.github.io/kobi-defter/`
(Alternatif: Cloudflare Pages / Netlify'a klasörü sürükle-bırak.)

> Not: Public depoda yalnızca **program** durur. Muhasebe verileriniz hiçbir zaman buraya yüklenmez.

## 2) Kullanım
- Adresi Chrome/Edge'de açın. Adres çubuğundaki **Yükle** simgesine ya da Ayarlar › Yedek & Veri › **Uygulama olarak yükle**'ye basın; masaüstünde/telefonda uygulama gibi açılır.
- İlk açılıştan sonra internet kesilse de çalışır.
- **Eski dosya sürümünden geçiş:** Eski Kobi Defter dosyasında *Ayarlar › Yedek & Veri › Yedek al*; yeni adreste *Yedekten geri yükle*. (Tarayıcı adresi değiştiği için veri otomatik taşınmaz.)

## 3) Güncelleme yayınlama (sizin tarafınız)
1. Yeni `index.html` dosyasını depoya yükleyin (aynı adla, üzerine yazın).
2. `sw.js` içindeki `SURUM='3.0'` değerini yeni sürüme çevirin (ör. `3.1`) — **bu zorunlu**, aksi halde cihazlar yeniliği fark etmez.
3. `version.json` içindeki `surum`, `tarih`, `notlar` alanlarını güncelleyin.
4. Commit edin. Kullanıcı internete bağlandığında yeni sürüm arka planda iner; **yönetici** rolündeki kullanıcıya sağ altta "Yeni sürüm hazır" çıkar. "Yedek al ve güncelle" der → önce yedek alınır, sonra yenilenir. Muhasebe/Salt okunur rolleri bu bandı görmez.

## 4) Google Drive senkronu (isteğe bağlı)
Verileriniz yine cihazda çalışır; Drive, başka bilgisayardan devam etmek ve ek yedek içindir. Program yalnızca kendi oluşturduğu `kobi-defter-veri.json` dosyasına erişir (`drive.file` kapsamı).

Tek seferlik Google ayarı:
1. console.cloud.google.com → yeni proje oluşturun.
2. **APIs & Services → Library → Google Drive API → Enable**.
3. **OAuth consent screen**: External, uygulama adı Kobi Defter, e-postanız; **Test users**'a kendi Gmail adresinizi (ve kullanacak diğer kişileri) ekleyin.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorized JavaScript origins**: `https://KULLANICIADINIZ.github.io` (yol YOK, sonunda / YOK).
5. Oluşan **Client ID**'yi (`…apps.googleusercontent.com`) kopyalayın.
6. Program: **Ayarlar › Yedek & Veri › Google Drive senkronu** → Client ID'yi yapıştırın → **Drive'a bağlan**.

Çalışma şekli: her kayıttan ~45 sn sonra Drive'a gönderilir; internet yoksa sıraya alınır ve gelince gönderilir. Google güvenlik gereği her oturumda bir kez "Drive'a bağlan" onayı isteyebilir. Yeni cihazda bağlanınca boşsa Drive'daki veri otomatik iner; iki tarafta da farklı veri varsa **hangisinin esas alınacağı sorulur** (önce yerel yedek indirilir).

Test modunda (yayına alınmamış) uygulamada Google, belirteçleri 7 günde yeniler; sorun olursa yeniden bağlanın.

## 5) Notlar
- Aynı anda iki cihazda çalışmayın; sırayla kullanın (tek kişi, iki rol senaryosu için uygundur).
- Tarayıcı verisini ("site verilerini") silerseniz yerel veri gider; Drive veya klasör yedeği bu yüzden önerilir.
