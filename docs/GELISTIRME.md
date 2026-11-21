# Geliştirme notları

Bu belge, projeyi (insan veya yapay zekâ yardımıyla) güncellerken bozulmaması gereken kuralları özetler.

## Katmanlar

| Dosya | Sorumluluk | Kural |
|---|---|---|
| `src/motor.js` | Tüm iş mantığı (stok, maliyet, üretim, satış, sayım, rapor) | DOM'a ve depolamaya **dokunmaz**; `db` nesnesi üzerinde çalışır; her değişiklik `degisti()` çağırır |
| `src/surum.js` | `SURUM`, `DB_SEMA`, `DEGISIKLIKLER` (neler yeni) | Sürüm yayınlarken buradan başlanır; `build.js` bundan `version.json` üretir |
| `src/kimlik.js` | Giriş, roller, şifre (PBKDF2), kurtarma kodu, kullanıcı yönetimi | Motorun `oturum` / `izin()` / `logYaz()` yapılarını kullanır; şifre düz metin saklanmaz |
| `src/depo.js` | IndexedDB, localStorage kopyası, **yedek konumu (klasör/dosya)**, çoklu sekme, sürüm denetimi | `kaydetKancasi` ile `degisti()`'ne bağlanır; yazma hatası uygulamayı durdurmaz; konum sorunlarında veri tarayıcıda tutulmaya devam eder |
| `src/ui.js` | Sayfalar (`SAYFA.*` HTML üretir), canlı hesaplar (`live*`), olaylar (`ACT.*`) | Sayfa fonksiyonları saf HTML metni döndürür; kullanıcı girdisi `esc()` ile kaçışlanır |

## Veri modeli (`db`)

```
db = { v, app, firma, ayar:{kar,kilitDk,guncelleme:{repo,dal}}, kartlar:[], hr:[], sayimlar:[],
       kullanicilar:[], guvenlik:{aktif,kurtarma}, log:[], logKirpilan, sayac, gun }
kul   = { id, kadi, ad, rol:'yonetici'|'yetkili'|'personel'|'izleyici', aktif, zorla, sifre:{tuz,hash,it}, sonGiris }
log   = { id, ts, kadi, ad, rol, islem, aciklama }
kart  = { id, ad, kat, grup:'HAM'|'MAMUL'|'TICARI', birim, asgari, kar|null, aktif }
hr    = { id, t:'YYYY-MM-DD', kart, yon:'G'|'C'|'X', tip, mik, bm, fiyat|null, oran|null,
          kod, not, neden, sil, silNeden, silTs, ts }            // sayım satırlarında ayrıca sis, say
sayim = { id, kod:'SYM-…', t, not, izahat, ts, satirlar:[{kart,sis,say,fark,bm,neden}] }
```

- `yon`: `G` stoğa giriş, `C` stoktan çıkış, `X` stoğu etkilemez (yalnızca FİRE bilgi satırı).
- `tip`: `ALIS`, `URETIM_GIRDI`, `URETIM_CIKTI`, `YAN_URUN`, `FIRE`, `SATIS`, `ZAYIAT`, `SAYIM`.
- `kod`: üretim seansı `URT-…`, sayım fişi `SYM-…`. Aynı `kod`lu satırlar **bütün olarak** silinir/geri alınır (`genislet`).
- `sil=1`: arşivde; stok hesabına girmez. Kalıcı silme yoktur.

## Değişmez kurallar

1. **Maliyet:** hareketli ağırlıklı ortalama, tarih+id sırasıyla (`defter()`). Çıkışta o anki ortalama kullanılır.
2. **Stok eksiye düşmez:** yeni çıkış, silme, geri alma, düzenleme `bozulur()` ile denetlenir. *Yalnızca stoğu kötüleştirip eksiye düşüren* işlem engellenir (mevcut eksik bakiyeler başka işlemleri kilitlemez).
3. **Takribi gelir:** `fiyat` girilmişse gerçek; değilse `bm × (1 + oran/100)`, `oran` satış anında kayda yazılır.
4. **Sayım:** fark olan her kalem için neden zorunlu; fark varsa `IZAHAT_MIN` karakterlik izahat zorunlu. Sayım düzeltmesi geçmişi değiştirmez, yeni hareket ekler.
5. **Yedek:** her `degisti()` → `Kayit.planla()`. Eski sekme (`Kayit.eskiSekme`) asla yazmaz. Riskli işlemlerden önce `Kayit.oncesi()`.
6. **Yetki:** her yazan motor fonksiyonu başta `izin('…')` denetler (arayüz atlansa bile reddeder); başarılı işlem `logYaz()` yazar. Koruma kapalıyken (`authAktif()` false) herkes yetkilidir. Personel/izleyicide maliyet **arayüzde** `maskele()` ile (sütun/özet kaldırma) gizlenir; yeni bir maliyet sütunu/özeti eklerseniz `MALI_BASLIK`/`MALI_TABLO` listelerine ekleyin ve `tests/test_roller.js` sızıntı taramasını çalıştırın.
7. **Yedek konumu:** `Klasor.durum` ∈ yok | tamam | izin | kayip | hata. `Kayit.yedekDurumu()` uyarı seviyesini belirler; arayüz (`yedekMesaj`, `yedekKapisi`, `periyodikKontrol`) buna göre uyarır. Konum sorunu **hiçbir zaman** işlemi engellemez.
8. **Sürüm:** `db.app` son kullanan sürümü tutar; yeni dosya veriyi yükseltmeden önce `Kayit.oncesi()` ile görüntü alır. `db.v > DB_SEMA` ise veri **salt okunur** korunur (`db._yeni`), kayıt yapılmaz.
9. **Şema değişirse** `dogrula()` içinde eski yedekleri yükseltin (yeni alanlara varsayılan verin); eski yedekler açılabilmelidir.

## Yeni sayfa eklemek

1. `SAYFALAR` listesine `[anahtar, ikon, ad]` ekleyin.
2. `SAYFA.anahtar = () => '…html…'` yazın.
3. Canlı hesap gerekiyorsa `live*` fonksiyonu yazıp `render()` ve `olaylariBagla()` içindeki eşlemelere ekleyin; fonksiyon, sayfanın farklı sekmelerinde alanı bulamazsa **sessizce dönmelidir**.
4. Düğmeler `data-act="ad"` ile `ACT.ad` fonksiyonuna bağlanır.

## Test

```bash
npm test
```

- `tests/test_motor.js` — motor mantığı (Node'da, DOM yok).
- `tests/test_ui.js` — `tests/minidom.js` sahte DOM'uyla sayfalar üretilir, alanlar doldurulur, düğmelere tıklanır.
- `tests/test_depo.js`, `tests/test_yedek.js` — sahte IndexedDB / klasör / dosya / BroadcastChannel ile yedek katmanı ve konum kaybı senaryoları.
- `tests/test_kimlik.js` — şifre, roller, günlük, kurtarma (yedek SHA-256/PBKDF2 gerçek kriptoyla karşılaştırılır).
- `tests/test_roller.js` — giriş ekranı, rol menüleri, maliyet sızıntı taraması, kilit, sürüm yükseltme/engelleme, güncelleme denetimi.
- `tests/ortam.js` — testler için ortak sahte ortam.

Yeni özellik ekleyince ilgili testi de ekleyin; `index.html`'i `node build.js` ile yeniden üretip commit edin (CI `--check` ile denetler). Gerçek tarayıcıda görsel kontrol ve yazdırma testi elle yapılmalıdır.

## İçe aktarma (`src/aktar.js`)

Excel (.xlsx; harici kütüphane yok, `DecompressionStream` ile) ve CSV okur; `sutunTani()` başlık/içerikten sütunları eşler, `aktSatirlariCoz()` satırları kart adaylarına çevirir, `aktarUygula()` kartları ve isteğe bağlı açılış stoğunu yazar (tek günlük kaydı). Yeni alan eklerken `AKT_ALANLAR` ve `AKT_SIRA`'ya ekleyin; test: `tests/test_aktar.js` (`tests/fixtures/*.xlsx`).

## Sürümleme

Yalnızca `src/surum.js` (`SURUM`, `DEGISIKLIKLER`) ve `CHANGELOG.md` elle güncellenir; `node build.js` `index.html`, `version.json` ve `package.json` sürümünü üretir/eşitler. GitHub'a `src/` değişikliği yüklenince `.github/workflows/test.yml` bunu kendisi yapıp depoya yazar.
