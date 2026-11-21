'use strict';
/* =====================================================================
   SOS STOK — tek dosya, çevrimdışı çalışır. Veri: tarayıcı (IndexedDB) +
   seçilen klasöre otomatik dosya yedeği.
   Akış:  ALIŞ → HAM | TİCARİ ;  ÜRETİM: HAM → MAMÜL (+yan ürün, fire) ;
          SATIŞ: MAMÜL | TİCARİ ;  ZAYİAT/İKRAM ;  SAYIM
   Maliyet: hareketli ağırlıklı ortalama. Satış fiyatı girilmezse
   ortalama maliyet × (1 + takribi kâr oranı) ile tahmin edilir.
   ===================================================================== */

// ============================ MOTOR BAŞLA ============================
const EPS = 1e-9;
const GRUPLAR = ['TICARI', 'HAM', 'MAMUL'];
const GRUP_AD = { TICARI: 'Ticari / Perakende', HAM: 'Ham madde', MAMUL: 'Mamül' };
const GRUP_KISA = { TICARI: 'Ticari', HAM: 'Ham', MAMUL: 'Mamül' };
const GRUP_IKON = { TICARI: '🛒', HAM: '🥩', MAMUL: '🏭' };
const TIP_AD = { ALIS: 'Alış', URETIM_GIRDI: 'Üretimde kullanılan', URETIM_CIKTI: 'Üretilen', YAN_URUN: 'Yan ürün',
  FIRE: 'Fire', SATIS: 'Satış', ZAYIAT: 'Zayiat / ikram', SAYIM: 'Sayım düzeltmesi' };
const ZAYIAT_NEDEN = ['Bozulma / son kullanma', 'Döküldü / kırıldı / düştü', 'Personel yemeği', 'İkram',
  'Numune / tadım', 'Hatalı üretim / yanık', 'Diğer'];
const SAYIM_NEDEN = ['Tartı / sayım farkı', 'Kayıt hatası (alış/satış girilmemiş)', 'Bozulma / zayiat (kayda geçmemiş)', 'Kayıp / bilinmiyor', 'Diğer'];
const IZAHAT_MIN = 20;
const BIRIMLER = ['KG', 'Adet', 'Litre', 'Paket', 'Koli', 'Metre', 'gram', 'ml', 'Ton'];

// ---------- biçimleme ----------
const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const fmt = n => nf2.format(+n || 0);
const mikF = n => nf3.format(Math.abs(n) < 5e-10 ? 0 : (+n || 0));
const tl = n => nf2.format(+n || 0) + ' ₺';
const yuzde = n => (isFinite(n) ? nf2.format(n) : '—') + (isFinite(n) ? ' %' : '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const trLower = s => String(s ?? '').toLocaleLowerCase('tr');

/** "1.234,5", "1234,5", "12.5" -> sayı; boş/geçersiz -> NaN */
function sayiOku(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const bugun = () => iso(new Date());
const gunEkle = (tarih, n) => { const d = new Date(tarih + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const trTarih = t => (t && t.length >= 10) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '';

// ---------- veri ----------
let db = bosDb();
let dv = 0;                       // veri sürümü (önbellek geçersiz kılma)
const memo = new Map();
/* ---------- roller ve yetkiler ---------- */
const ROLLER = {
  yonetici: { ad: 'Yönetici', izin: ['gor', 'giris', 'mali', 'duzelt', 'sayim', 'kart', 'ayar', 'kullanici', 'log'] },
  yetkili: { ad: 'Yetkili', izin: ['gor', 'giris', 'mali', 'duzelt', 'sayim', 'kart', 'log'] },
  personel: { ad: 'Personel', izin: ['gor', 'giris'] },
  izleyici: { ad: 'İzleyici', izin: ['gor'] },
};
const IZIN_AD = { gor: 'Stok durumu ve hareketleri görme', giris: 'Alış / Üretim / Satış / Zayiat girişi', mali: 'Maliyet, kâr ve ciro bilgilerini görme',
  duzelt: 'Hareket düzenleme / silme / geri alma, üretim ve sayım iptali', sayim: 'Stok sayımı', kart: 'Stok kartı yönetimi',
  ayar: 'Ayarlar, yedekleme, geri yükleme, veri silme', kullanici: 'Kullanıcı yönetimi', log: 'Kayıt günlüğünü görme' };
const LOG_MAX = 10000;
let oturum = null;                                   // { id, kadi, ad, rol } — kimlik.js yönetir
const authAktif = () => !!(db.guvenlik && db.guvenlik.aktif && db.kullanicilar.length);
/** Giriş koruması kapalıysa herkes her şeyi yapabilir; açıksa yalnızca rolün izinleri geçerlidir. */
const izin = p => !authAktif() || (!!oturum && !!ROLLER[oturum.rol] && ROLLER[oturum.rol].izin.includes(p));
const yasak = () => ({ ok: false, msg: 'Bu işlem için yetkiniz yok.' });
const aktifKadi = () => (oturum ? oturum.kadi : '');
function logYaz(islem, aciklama, ayr) {
  const e = { id: db.sayac++, ts: Date.now(), kadi: oturum ? oturum.kadi : '', ad: oturum ? oturum.ad : '', rol: oturum ? oturum.rol : '', islem, aciklama: String(aciklama || '') };
  if (ayr) e.ayr = ayr;
  db.log.push(e);
  if (db.log.length > LOG_MAX) { const at = db.log.length - LOG_MAX + 1000; db.log.splice(0, at); db.logKirpilan = (db.logKirpilan || 0) + at; }
}
const ozetMetin = (rows, n = 4) => { const g = new Map(); for (const r of rows) g.set(r.kart, (g.get(r.kart) || 0) + r.mik);
  const l = [...g.entries()].map(([k, v]) => `${kartAd(k)} ${mikF(v)}`); return l.slice(0, n).join(', ') + (l.length > n ? ` … (+${l.length - n})` : ''); };
const memoize = (k, fn) => { if (!memo.has(k)) memo.set(k, fn()); return memo.get(k); };
let kaydetKancasi = () => {};     // depolama katmanı bağlar
function bosDb() {
  return { v: DB_SEMA, app: SURUM, firma: 'İşletmem', ayar: { kar: 30, kilitDk: 15, guncelleme: { repo: '', dal: 'main' } }, kartlar: [], hr: [], sayimlar: [],
    kullanicilar: [], guvenlik: { aktif: false }, log: [], logKirpilan: 0, sayac: 1, gun: 0 };
}
function degisti() { dv++; memo.clear(); kaydetKancasi(); }
function dogrula(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.kartlar) || !Array.isArray(o.hr)) return false;
  o._yeni = (+o.v || 1) > DB_SEMA;          // bu uygulamadan daha yeni biçimde kaydedilmiş veri: değiştirilmemeli
  o.ayar = Object.assign({ kar: 30, kilitDk: 15 }, o.ayar || {});
  o.ayar.guncelleme = Object.assign({ repo: '', dal: 'main' }, o.ayar.guncelleme || {});
  o.firma = o.firma || 'İşletmem';
  o.sayimlar = Array.isArray(o.sayimlar) ? o.sayimlar : [];
  o.kullanicilar = Array.isArray(o.kullanicilar) ? o.kullanicilar : [];
  o.log = Array.isArray(o.log) ? o.log : [];
  o.guvenlik = (o.guvenlik && typeof o.guvenlik === 'object') ? o.guvenlik : { aktif: false };
  o.logKirpilan = +o.logKirpilan || 0;
  o.sayac = Math.max(+o.sayac || 1, 1 + Math.max(0, ...o.kartlar.map(k => +k.id || 0), ...o.hr.map(r => +r.id || 0), ...o.sayimlar.map(s => +s.id || 0),
    ...o.kullanicilar.map(u => +u.id || 0), ...o.log.map(l => +l.id || 0)));
  o.gun = +o.gun || 0;
  if (!o._yeni) o.v = DB_SEMA;
  return true;
}

const K = id => memoize('km', () => new Map(db.kartlar.map(k => [k.id, k]))).get(id);
const kartAd = id => (K(id) ? K(id).ad : '(silinmiş kart)');
const kartBirim = id => (K(id) ? K(id).birim : '');
const aktif = () => memoize('aktif', () => db.hr.filter(r => !r.sil));
const sirali = rows => rows.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id - b.id));
const kartlarSirali = () => memoize('ks', () => db.kartlar.filter(k => k.aktif !== false).slice().sort((a, b) =>
  GRUPLAR.indexOf(a.grup) - GRUPLAR.indexOf(b.grup) || a.ad.localeCompare(b.ad, 'tr')));
const karOrani = k => (k && k.kar != null && k.kar !== '' && isFinite(+k.kar)) ? +k.kar : (+db.ayar.kar || 0);
const takribiFiyat = (ort, k) => ort * (1 + karOrani(k) / 100);

/** Dönem defteri: kart başına devir, gelen, satılan, kullanılan, diğer, kalan, ort. maliyet, değer. */
function defter(bas, bit) {
  return memoize(`d|${bas || ''}|${bit || ''}`, () => {
    const st = new Map();
    const S = id => { if (!st.has(id)) st.set(id, { qty: 0, val: 0, son: 0, devir: null, gelen: 0, satilan: 0, kullanilan: 0, diger: 0 }); return st.get(id); };
    for (const r of sirali(aktif())) {
      if (bit && r.t > bit) continue;
      if (r.yon === 'X') continue;
      const s = S(r.kart);
      const donemde = !bas || r.t >= bas;
      if (donemde && s.devir === null) s.devir = s.qty;
      if (r.yon === 'G') {
        s.qty += r.mik; s.val += r.mik * r.bm;
        if (s.qty > EPS) s.son = s.val / s.qty;
        if (donemde) s.gelen += r.mik;
      } else {
        const avg = s.qty > EPS ? s.val / s.qty : 0;
        s.val -= r.mik * avg; s.qty -= r.mik;
        if (s.qty <= EPS) s.val = 0;
        if (donemde) {
          if (r.tip === 'SATIS') s.satilan += r.mik;
          else if (r.tip === 'URETIM_GIRDI') s.kullanilan += r.mik;
          else s.diger += r.mik;
        }
      }
    }
    const out = new Map();
    for (const k of db.kartlar) {
      const s = st.get(k.id) || { qty: 0, val: 0, son: 0, devir: 0, gelen: 0, satilan: 0, kullanilan: 0, diger: 0 };
      const ort = s.qty > EPS ? s.val / s.qty : s.son;
      out.set(k.id, { kart: k, devir: s.devir === null ? s.qty : s.devir, gelen: s.gelen, satilan: s.satilan,
        kullanilan: s.kullanilan, diger: s.diger, kalan: s.qty, ort, deger: s.qty > EPS ? s.qty * ort : 0,
        takribi: (k.grup !== 'HAM' && s.qty > EPS) ? s.qty * takribiFiyat(ort, k) : 0 });
    }
    return out;
  });
}
const canli = id => { const s = defter(null, null).get(id); return s ? { net: s.kalan, ort: s.ort } : { net: 0, ort: 0 }; };
function durumKodu(d) {
  const a = +d.kart.asgari || 0;
  if (d.kalan < -0.001) return 'eksi';
  if (d.kalan <= 0.0009) return 'bitti';
  if (a > 0 && d.kalan <= a) return 'dusuk';
  return 'var';
}
const DURUM_AD = { eksi: 'Eksi', bitti: 'Bitti', dusuk: 'Asgari altı', var: 'Var' };

// ---------- doğrulama: işlem stoğu eksiye düşürür mü? ----------
function minSeri(rows, idler) {
  const q = new Map(), mn = new Map();
  for (const r of sirali(rows)) {
    if (r.yon === 'X' || !idler.has(r.kart)) continue;
    const v = (q.get(r.kart) || 0) + (r.yon === 'G' ? r.mik : -r.mik);
    q.set(r.kart, v);
    mn.set(r.kart, Math.min(mn.has(r.kart) ? mn.get(r.kart) : 0, v));
  }
  return mn;
}
/** Yalnızca stoğu KÖTÜLEŞTİREN ve eksiye düşüren değişiklikler engellenir. */
function bozulur(once, sonra, idler) {
  const a = minSeri(once, idler), b = minSeri(sonra, idler), msg = [];
  for (const id of idler) {
    const bv = b.get(id) || 0, av = a.get(id) || 0;
    if (bv < -1e-6 && bv < av - 1e-9) msg.push(`${kartAd(id)}: stok ${mikF(bv)} ${kartBirim(id)} olur`);
  }
  return msg;
}
function satirYap(o) {
  return Object.assign({ id: db.sayac++, t: bugun(), kart: 0, yon: 'G', tip: 'ALIS', mik: 0, bm: 0, fiyat: null, oran: null,
    kod: '', not: '', neden: '', sil: 0, silNeden: '', silTs: '', ts: Date.now(), kul: aktifKadi() }, o);
}
function islemUygula(yeni, logTip, logMetin) {
  if (yeni.some(r => r.yon === 'C')) {
    const idler = new Set(yeni.map(r => r.kart));
    const p = bozulur(aktif(), aktif().concat(yeni), idler);
    if (p.length) return { ok: false, msg: 'Stok yetersiz → ' + p.join(' | ') };
  }
  db.hr.push(...yeni);
  if (logTip) logYaz(logTip, logMetin);
  degisti();
  return { ok: true };
}
const gecerli = x => isFinite(x) && x > 0;

// ---------- kartlar ----------
function kartKontrol(o, haricId) {
  const ad = String(o.ad || '').trim();
  if (!ad) return 'Ürün adı boş olamaz.';
  if (!GRUPLAR.includes(o.grup)) return 'Grup seçin.';
  if (!String(o.birim || '').trim()) return 'Birim boş olamaz.';
  const var_ = db.kartlar.find(k => k.id !== haricId && trLower(k.ad) === trLower(ad) && k.grup === o.grup);
  if (var_) return `"${ad}" zaten ${GRUP_KISA[o.grup]} grubunda var.`;
  return '';
}
function kartEkle(o, sessiz) {
  if (!izin('kart')) return yasak();
  const h = kartKontrol(o); if (h) return { ok: false, msg: h };
  const k = { id: db.sayac++, ad: o.ad.trim(), kat: (o.kat || '').trim(), grup: o.grup, birim: o.birim.trim(),
    asgari: gecerli(+o.asgari) ? +o.asgari : 0, kar: (o.kar === '' || o.kar == null || !isFinite(+o.kar)) ? null : +o.kar, aktif: true };
  db.kartlar.push(k); if (!sessiz) { logYaz('KART', `Kart eklendi: ${k.ad} (${GRUP_KISA[k.grup]}, ${k.birim})`); degisti(); }
  return { ok: true, id: k.id };
}
function kartGuncelle(id, o) {
  if (!izin('kart')) return yasak();
  const k = db.kartlar.find(x => x.id === id); if (!k) return { ok: false, msg: 'Kart bulunamadı.' };
  const h = kartKontrol(o, id); if (h) return { ok: false, msg: h };
  const once = `${k.ad} / ${GRUP_KISA[k.grup]} / ${k.birim} / asgari ${k.asgari} / kâr ${k.kar ?? 'genel'}`;
  Object.assign(k, { ad: o.ad.trim(), kat: (o.kat || '').trim(), grup: o.grup, birim: o.birim.trim(),
    asgari: gecerli(+o.asgari) ? +o.asgari : 0, kar: (o.kar === '' || o.kar == null || !isFinite(+o.kar)) ? null : +o.kar });
  logYaz('KART', `Kart güncellendi: ${once} → ${k.ad} / ${GRUP_KISA[k.grup]} / ${k.birim} / asgari ${k.asgari} / kâr ${k.kar ?? 'genel'}`);
  degisti();
  return { ok: true };
}
const kartHareketVar = id => db.hr.some(r => r.kart === id);
function kartSil(id) {
  if (!izin('kart')) return yasak();
  if (kartHareketVar(id)) return { ok: false, msg: 'Bu kartın stok hareketi var; silinemez. Kullanmayacaksanız "Pasif yap" deyin.' };
  logYaz('KART', 'Kart silindi: ' + kartAd(id));
  db.kartlar = db.kartlar.filter(k => k.id !== id); degisti();
  return { ok: true };
}
function kartPasif(id, pasif) {
  if (!izin('kart')) return;
  const k = db.kartlar.find(x => x.id === id); if (!k) return;
  k.aktif = !pasif; logYaz('KART', `Kart ${pasif ? 'pasif yapıldı' : 'aktif yapıldı'}: ${k.ad}`); degisti();
}

// ---------- alış ----------
function alisKaydet(t, satirlar, not) {
  if (!izin('giris')) return yasak();
  satirlar = satirlar.filter(x => gecerli(x.mik));
  if (!satirlar.length) return { ok: false, msg: 'Miktar girilmiş satır yok.' };
  let tahmini = 0;
  const yeni = satirlar.map(x => {
    let bm = x.bm;
    if (!gecerli(bm)) { bm = canli(x.kart).ort; tahmini++; }
    return satirYap({ t, kart: x.kart, yon: 'G', tip: 'ALIS', mik: x.mik, bm, not });
  });
  const r = islemUygula(yeni, 'ALIS', `${yeni.length} kalem alış: ${ozetMetin(yeni)}${not ? ' — ' + not : ''}`);
  return r.ok ? { ok: true, msg: `${yeni.length} kalem stoğa eklendi.` + (tahmini ? ` ${tahmini} kalemde fiyat girilmediği için mevcut ortalama maliyet kullanıldı.` : '') } : r;
}

// ---------- satış ----------
function satisKaydet(t, satirlar, not) {
  if (!izin('giris')) return yasak();
  satirlar = satirlar.filter(x => gecerli(x.mik));
  if (!satirlar.length) return { ok: false, msg: 'Miktar girilmiş satır yok.' };
  const yeni = satirlar.map(x => {
    const k = K(x.kart), c = canli(x.kart), f = gecerli(x.fiyat) ? x.fiyat : null;
    return satirYap({ t, kart: x.kart, yon: 'C', tip: 'SATIS', mik: x.mik, bm: c.ort, fiyat: f, oran: f == null ? karOrani(k) : null, not });
  });
  const r = islemUygula(yeni, 'SATIS', `${yeni.length} kalem satış: ${ozetMetin(yeni)}`);
  return r.ok ? { ok: true, msg: `${yeni.length} kalem satıldı.` } : r;
}
/** Satış satırı geliri: girilen fiyat varsa gerçek, yoksa maliyet × (1+oran) takribi */
function satisGeliri(r) {
  if (r.fiyat != null) return { tut: r.mik * r.fiyat, gercek: true };
  const oran = r.oran != null ? r.oran : karOrani(K(r.kart));
  return { tut: r.mik * r.bm * (1 + oran / 100), gercek: false };
}

// ---------- zayiat / ikram ----------
function zayiatKaydet(t, satirlar, neden, not) {
  if (!izin('giris')) return yasak();
  satirlar = satirlar.filter(x => gecerli(x.mik));
  if (!satirlar.length) return { ok: false, msg: 'Miktar girilmiş satır yok.' };
  const yeni = satirlar.map(x => satirYap({ t, kart: x.kart, yon: 'C', tip: 'ZAYIAT', mik: x.mik, bm: canli(x.kart).ort, neden, not }));
  const r = islemUygula(yeni, 'ZAYIAT', `${neden}: ${ozetMetin(yeni)}`);
  return r.ok ? { ok: true, msg: `${yeni.length} kalem "${neden}" olarak stoktan düşüldü.` } : r;
}

// ---------- üretim ----------
const topla = (liste) => { const m = new Map(); for (const x of liste) if (gecerli(x.mik)) m.set(x.kart, (m.get(x.kart) || 0) + x.mik); return m; };
function uretimOnizle(girdiler, ciktilar, yanlar, fireManuel) {
  girdiler = girdiler.filter(x => x.kart && gecerli(x.mik)); ciktilar = ciktilar.filter(x => x.kart && gecerli(x.mik)); yanlar = yanlar.filter(x => x.kart && gecerli(x.mik));
  const birimler = new Set([...girdiler, ...ciktilar, ...yanlar].map(x => kartBirim(x.kart)));
  const ayni = birimler.size === 1;
  const G = girdiler.reduce((a, x) => a + x.mik, 0), M = ciktilar.reduce((a, x) => a + x.mik, 0), Y = yanlar.reduce((a, x) => a + x.mik, 0);
  const fire = ayni ? Math.max(0, G - M - Y) : (gecerli(fireManuel) ? fireManuel : 0);
  let maliyet = 0;
  for (const [id, q] of topla(girdiler)) maliyet += q * canli(id).ort;
  const kredi = yanlar.reduce((a, x) => a + x.mik * (gecerli(x.deger) ? x.deger : 0), 0);
  const net = Math.max(0, maliyet - kredi);
  const stokHata = [];
  for (const [id, q] of topla(girdiler)) { const n = canli(id).net; if (q > n + 0.001) stokHata.push(`${kartAd(id)}: stok ${mikF(n)}, gereken ${mikF(q)}`); }
  return { girdiler, ciktilar, yanlar, ayni, birimler: [...birimler], G, M, Y, fire, maliyet, kredi, net,
    birimMaliyet: M > 0 ? net / M : 0, randiman: (ayni && G > 0) ? M / G * 100 : NaN,
    fazla: (ayni && M + Y - G > 0.001) ? M + Y - G : 0, stokHata };
}
function uretimKaydet(t, girdiler, ciktilar, yanlar, fireManuel, not) {
  if (!izin('giris')) return yasak();
  const o = uretimOnizle(girdiler, ciktilar, yanlar, fireManuel);
  if (!o.girdiler.length) return { ok: false, msg: 'En az bir girdi (ham madde) ekleyin.' };
  if (!o.ciktilar.length) return { ok: false, msg: 'En az bir çıkan mamül ekleyin.' };
  const kod = 'URT-' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '-' + (db.sayac);
  const yeni = [];
  const ortlar = new Map(); for (const id of topla(o.girdiler).keys()) ortlar.set(id, canli(id).ort);
  for (const x of o.girdiler) yeni.push(satirYap({ t, kart: x.kart, yon: 'C', tip: 'URETIM_GIRDI', mik: x.mik, bm: ortlar.get(x.kart), kod, not }));
  for (const x of o.ciktilar) {
    const mt = o.net * (x.mik / o.M);
    yeni.push(satirYap({ t, kart: x.kart, yon: 'G', tip: 'URETIM_CIKTI', mik: x.mik, bm: mt / x.mik, kod, not }));
  }
  for (const x of o.yanlar) yeni.push(satirYap({ t, kart: x.kart, yon: 'G', tip: 'YAN_URUN', mik: x.mik, bm: gecerli(x.deger) ? x.deger : 0, kod, not }));
  if (o.fire > 0.001) {
    const ana = o.girdiler.reduce((a, x) => (x.mik > a.mik ? x : a), o.girdiler[0]);
    yeni.push(satirYap({ t, kart: ana.kart, yon: 'X', tip: 'FIRE', mik: o.fire, bm: (o.ayni && o.G > 0) ? o.maliyet / o.G : 0, kod, not }));
  }
  const r = islemUygula(yeni, 'URETIM', `${kod}: girdi ${ozetMetin(yeni.filter(x => x.tip === 'URETIM_GIRDI'))} → mamül ${ozetMetin(yeni.filter(x => x.tip === 'URETIM_CIKTI'))}`);
  return r.ok ? { ok: true, msg: `Üretim kaydedildi (${kod}).`, kod } : r;
}
function uretimSeanslari() {
  const g = new Map();
  for (const r of aktif()) if (r.kod && r.kod.startsWith('URT-')) { if (!g.has(r.kod)) g.set(r.kod, []); g.get(r.kod).push(r); }
  const out = [];
  for (const [kod, rows] of g) {
    const gi = rows.filter(r => r.tip === 'URETIM_GIRDI'), ci = rows.filter(r => r.tip === 'URETIM_CIKTI'),
      ya = rows.filter(r => r.tip === 'YAN_URUN'), fi = rows.filter(r => r.tip === 'FIRE');
    const birimler = new Set([...gi, ...ci, ...ya].map(r => kartBirim(r.kart)));
    const ayni = birimler.size === 1;
    const G = gi.reduce((a, r) => a + r.mik, 0), M = ci.reduce((a, r) => a + r.mik, 0), Y = ya.reduce((a, r) => a + r.mik, 0);
    const F = fi.reduce((a, r) => a + r.mik, 0);
    const txt = l => l.map(r => `${kartAd(r.kart)} ${mikF(r.mik)}`).join(', ');
    out.push({ kod, t: rows[0].t, ts: Math.min(...rows.map(r => r.ts)), girdi: txt(gi), cikti: txt(ci), yan: txt(ya), G, M, Y, F,
      randiman: (ayni && G > 0) ? M / G * 100 : NaN, birim: ayni ? [...birimler][0] : 'karışık',
      maliyet: gi.reduce((a, r) => a + r.mik * r.bm, 0), ana: gi.length ? kartAd(gi.reduce((a, r) => (r.mik > a.mik ? r : a), gi[0]).kart) : '',
      ids: rows.map(r => r.id) });
  }
  return out.sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : b.ts - a.ts));
}

// ---------- sayım (sayım fişi) ----------
/** satirlar: [{kart, sayilan, neden?}] — sayılan her kalem fişe yazılır; farklar "SAYIM" düzeltme hareketi olur.
    Fark olan her kalem için neden gerekir (satır nedeni, yoksa genel neden); fark varsa ayrıca yazılı izahat zorunludur. */
function sayimKaydet(t, satirlar, not, genelNeden, izahat) {
  if (!izin('sayim')) return yasak();
  const satirSeti = new Map();
  for (const x of satirlar) if (isFinite(x.sayilan) && x.sayilan >= 0 && K(x.kart)) satirSeti.set(x.kart, x);
  if (!satirSeti.size) return { ok: false, msg: 'Sayılan miktar girilmedi.' };
  const lines = [];
  for (const x of satirSeti.values()) {
    const c = canli(x.kart), fark = x.sayilan - c.net, fz = Math.abs(fark) > 0.001;
    lines.push({ kart: x.kart, sis: c.net, say: x.sayilan, fark: fz ? fark : 0, bm: c.ort, neden: fz ? (x.neden || genelNeden || '') : '' });
  }
  const eksik = lines.filter(l => l.fark !== 0 && !l.neden);
  if (eksik.length) return { ok: false, msg: 'Fark olan kalemler için neden seçin: ' + eksik.map(l => kartAd(l.kart)).join(', ') };
  izahat = String(izahat || '').trim();
  if (lines.some(l => l.fark !== 0) && izahat.length < IZAHAT_MIN) return { ok: false, msg: `Farklar için açıklama (izahat) zorunlu: en az ${IZAHAT_MIN} karakterle nedenini anlatın.` };
  const kod = 'SYM-' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '-' + db.sayac;
  const rows = lines.filter(l => l.fark !== 0).map(l => satirYap({ t, kart: l.kart, yon: l.fark > 0 ? 'G' : 'C', tip: 'SAYIM', mik: Math.abs(l.fark), bm: l.bm,
    kod, neden: l.neden, not: not || '', sis: l.sis, say: l.say }));
  db.sayimlar.push({ id: db.sayac++, kod, t, not: not || '', izahat, kul: aktifKadi(), ts: Date.now(), satirlar: lines.map(l => ({ kart: l.kart, sis: l.sis, say: l.say, fark: l.fark, bm: l.bm, neden: l.neden })) });
  db.hr.push(...rows); logYaz('SAYIM', `${kod}: ${lines.length} kalem sayıldı, ${rows.length} kalemde fark düzeltildi`); degisti();
  return { ok: true, kod, fark: rows.length, msg: rows.length ? `Sayım fişi kaydedildi: ${lines.length} kalem sayıldı, ${rows.length} kalemde fark düzeltildi.` : `Sayım fişi kaydedildi: ${lines.length} kalem sayıldı, fark yok.` };
}
function sayimSeanslari() {
  return db.sayimlar.map(s => {
    const rows = db.hr.filter(r => r.kod === s.kod);
    let eks = 0, faz = 0;
    for (const l of s.satirlar) { const v = Math.abs(l.fark) * l.bm; if (l.fark < 0) eks += v; else if (l.fark > 0) faz += v; }
    return Object.assign({}, s, { n: s.satirlar.length, nf: s.satirlar.filter(l => l.fark !== 0).length, eks, faz, net: faz - eks,
      iptal: rows.length > 0 && rows.every(r => r.sil), ids: rows.filter(r => !r.sil).map(r => r.id) });
  }).sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : b.ts - a.ts));
}

// ---------- silme / geri alma / düzenleme ----------
function genislet(ids, silindi) {
  const set = new Set(ids);
  const kodlar = new Set(db.hr.filter(r => set.has(r.id) && r.kod).map(r => r.kod));
  for (const r of db.hr) if (kodlar.has(r.kod) && !!r.sil === !!silindi) set.add(r.id);
  return db.hr.filter(r => set.has(r.id) && !!r.sil === !!silindi);
}
function kayitSil(ids, neden) {
  if (!izin('duzelt')) return yasak();
  if (!String(neden || '').trim()) return { ok: false, msg: 'Silme nedenini yazın.' };
  const hedef = genislet(ids, false);
  if (!hedef.length) return { ok: false, msg: 'Kayıt bulunamadı.' };
  const set = new Set(hedef.map(r => r.id));
  const sonra = aktif().filter(r => !set.has(r.id));
  const p = bozulur(aktif(), sonra, new Set(hedef.map(r => r.kart)));
  if (p.length) return { ok: false, msg: 'Silinemez, stok eksiye düşer → ' + p.join(' | ') };
  const ts = new Date().toISOString();
  for (const r of hedef) { r.sil = 1; r.silNeden = neden.trim(); r.silTs = ts; }
  logYaz('SIL', `${hedef.length} kayıt silindi (${hedef[0].kod || TIP_AD[hedef[0].tip]}): ${ozetMetin(hedef)} — neden: ${neden.trim()}`);
  degisti();
  return { ok: true, msg: `${hedef.length} kayıt arşive taşındı.` };
}
function kayitGeriAl(ids) {
  if (!izin('duzelt')) return yasak();
  const hedef = genislet(ids, true);
  if (!hedef.length) return { ok: false, msg: 'Kayıt bulunamadı.' };
  const kopya = hedef.map(r => Object.assign({}, r, { sil: 0 }));
  const p = bozulur(aktif(), aktif().concat(kopya), new Set(hedef.map(r => r.kart)));
  if (p.length) return { ok: false, msg: 'Geri alınamaz, stok eksiye düşer → ' + p.join(' | ') };
  for (const r of hedef) { r.sil = 0; r.silNeden = ''; r.silTs = ''; }
  logYaz('GERI', `${hedef.length} kayıt geri alındı: ${ozetMetin(hedef)}`);
  degisti();
  return { ok: true, msg: `${hedef.length} kayıt geri alındı.` };
}
function ayarKaydet(firma, kar, kilitDk) {
  if (!izin('ayar')) return yasak();
  if (!isFinite(kar) || kar < 0) return { ok: false, msg: 'Kâr oranı 0 veya daha büyük bir sayı olmalı.' };
  const eski = `${db.firma} / %${db.ayar.kar} / kilit ${db.ayar.kilitDk} dk`;
  db.firma = String(firma || '').trim() || 'İşletmem'; db.ayar.kar = kar;
  if (isFinite(kilitDk) && kilitDk >= 1 && kilitDk <= 480) db.ayar.kilitDk = Math.round(kilitDk);
  logYaz('AYAR', `${eski} → ${db.firma} / %${db.ayar.kar} / kilit ${db.ayar.kilitDk} dk`);
  degisti();
  return { ok: true, msg: 'Ayarlar kaydedildi.' };
}
const duzenlenebilir = r => !r.kod && ['ALIS', 'SATIS', 'ZAYIAT'].includes(r.tip);
function kayitDuzenle(id, o) {
  if (!izin('duzelt')) return yasak();
  const r = db.hr.find(x => x.id === id && !x.sil);
  if (!r) return { ok: false, msg: 'Kayıt bulunamadı.' };
  if (!duzenlenebilir(r)) return { ok: false, msg: 'Bu kayıt türü düzenlenemez.' };
  if (!gecerli(o.mik)) return { ok: false, msg: 'Miktar sıfırdan büyük olmalı.' };
  const yeni = Object.assign({}, r, { t: o.t || r.t, mik: o.mik, not: o.not ?? r.not });
  if (r.tip === 'ALIS') yeni.bm = gecerli(o.bm) ? o.bm : r.bm;
  if (r.tip === 'SATIS') { const f = gecerli(o.fiyat) ? o.fiyat : null; yeni.fiyat = f; yeni.oran = f == null ? (r.oran != null ? r.oran : karOrani(K(r.kart))) : null; }
  if (r.tip === 'ZAYIAT' && o.neden) yeni.neden = o.neden;
  const sonra = aktif().map(x => (x.id === id ? yeni : x));
  const p = bozulur(aktif(), sonra, new Set([r.kart]));
  if (p.length) return { ok: false, msg: 'Bu değişiklikle stok eksiye düşer → ' + p.join(' | ') };
  logYaz('DUZENLE', `${TIP_AD[r.tip]} düzenlendi: ${kartAd(r.kart)} — miktar ${mikF(r.mik)}→${mikF(yeni.mik)}${r.tip === 'ALIS' ? `, birim fiyat ${fmt(r.bm)}→${fmt(yeni.bm)}` : ''}${r.tip === 'SATIS' ? `, fiyat ${r.fiyat ?? '—'}→${yeni.fiyat ?? '—'}` : ''}`);
  Object.assign(r, yeni); degisti();
  return { ok: true, msg: 'Kayıt güncellendi.' };
}

// ---------- raporlar ----------
const araliktaMi = (r, bas, bit) => (!bas || r.t >= bas) && (!bit || r.t <= bit);
function maliOzet(bas, bit) {
  const rows = aktif().filter(r => araliktaMi(r, bas, bit));
  let alis = 0, satisMal = 0, ciroG = 0, ciroT = 0, zay = 0, fire = 0, sayEks = 0, sayFaz = 0;
  const kalem = new Map(), gun = new Map();
  for (const r of rows) {
    if (r.tip === 'ALIS') alis += r.mik * r.bm;
    else if (r.tip === 'SATIS') {
      const g = satisGeliri(r), m = r.mik * r.bm;
      satisMal += m; if (g.gercek) ciroG += g.tut; else ciroT += g.tut;
      const e = kalem.get(r.kart) || { kart: r.kart, mik: 0, ciro: 0, mal: 0, takribi: false };
      e.mik += r.mik; e.ciro += g.tut; e.mal += m; if (!g.gercek) e.takribi = true; kalem.set(r.kart, e);
      const d = gun.get(r.t) || { ciro: 0, mal: 0 }; d.ciro += g.tut; d.mal += m; gun.set(r.t, d);
    } else if (r.tip === 'ZAYIAT') zay += r.mik * r.bm;
    else if (r.tip === 'FIRE') fire += r.mik * r.bm;
    else if (r.tip === 'SAYIM') { if (r.yon === 'C') sayEks += r.mik * r.bm; else sayFaz += r.mik * r.bm; }
  }
  const ciro = ciroG + ciroT, kar = ciro - satisMal, net = kar - zay - sayEks + sayFaz;
  return { alis, satisMal, ciroG, ciroT, ciro, kar, marj: ciro > 0 ? kar / ciro * 100 : NaN, zay, fire, sayEks, sayFaz, net,
    kalem: [...kalem.values()].sort((a, b) => b.ciro - a.ciro), gun: [...gun.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
}
function stokDegerleri() {
  const d = defter(null, null), out = { TICARI: { deger: 0, takribi: 0, n: 0 }, HAM: { deger: 0, takribi: 0, n: 0 }, MAMUL: { deger: 0, takribi: 0, n: 0 } };
  for (const x of d.values()) {
    if (x.kart.aktif === false && x.kalan <= EPS) continue;
    const o = out[x.kart.grup]; if (!o) continue;
    o.deger += x.deger; o.takribi += x.takribi; if (x.kalan > 0.0009) o.n++;
  }
  return out;
}
function siparisListesi() {
  const out = [];
  for (const x of defter(null, null).values()) {
    const a = +x.kart.asgari || 0;
    if (x.kart.aktif === false || a <= 0 || x.kalan > a) continue;
    const oner = Math.max(0, a * 2 - x.kalan);
    out.push({ kart: x.kart, kalan: x.kalan, asgari: a, oner, tutar: oner * x.ort, ort: x.ort });
  }
  return out;
}
function uyarilar() {
  const out = [];
  for (const x of defter(null, null).values()) {
    if (x.kart.aktif === false) continue;
    const d = durumKodu(x);
    if (d === 'eksi' || d === 'dusuk') out.push({ d, x });
  }
  return out;
}
function maliyetsizKartlar() {
  const d = defter(null, null);
  return db.kartlar.filter(k => k.aktif !== false && k.grup !== 'MAMUL' && d.get(k.id).kalan > 0.0009 && !(d.get(k.id).ort > 0));
}
function csvMetni(basliklar, satirlar) {
  const h = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\ufeff' + [basliklar, ...satirlar].map(r => r.map(h).join(';')).join('\r\n');
}

// ---------- örnek veri ----------
function ornekVeri() {
  if (db.kartlar.length) return { ok: false, msg: 'Zaten kart var.' };
  const ek = (ad, kat, grup, birim, asgari) => kartEkle({ ad, kat, grup, birim, asgari }).id;
  const dana = ek('Dana 5\'li set', 'Kırmızı et', 'HAM', 'KG', 50), yag = ek('Kuyruk yağı', 'Kırmızı et', 'HAM', 'KG', 5);
  const doner = ek('Et döner', 'Döner', 'MAMUL', 'KG', 20), kirp = ek('Döner kırpıntısı', 'Döner', 'HAM', 'KG', 0);
  const ayran = ek('Ayran', 'İçecek', 'TICARI', 'Adet', 100), gaz = ek('Gazoz', 'İçecek', 'TICARI', 'Adet', 60);
  const bu = bugun(), dun = gunEkle(bu, -1), once = gunEkle(bu, -3);
  alisKaydet(once, [{ kart: dana, mik: 200, bm: 420 }, { kart: yag, mik: 20, bm: 260 }, { kart: ayran, mik: 400, bm: 9 }, { kart: gaz, mik: 240, bm: 14 }], 'Örnek fatura');
  uretimKaydet(dun, [{ kart: dana, mik: 100 }, { kart: yag, mik: 5 }], [{ kart: doner, mik: 80 }], [{ kart: kirp, mik: 8, deger: 150 }], 0, 'Örnek üretim');
  satisKaydet(bu, [{ kart: doner, mik: 18, fiyat: 900 }, { kart: ayran, mik: 90, fiyat: null }, { kart: gaz, mik: 40, fiyat: 25 }], 'Örnek satış');
  zayiatKaydet(bu, [{ kart: ayran, mik: 3 }], 'Döküldü / kırıldı / düştü', '');
  return { ok: true, msg: 'Örnek veri yüklendi.' };
}
// ============================ MOTOR BİTİŞ ============================
