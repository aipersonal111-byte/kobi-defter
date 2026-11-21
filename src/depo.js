
// ============================ DEPO BAŞLA ============================
/* Katmanlar (hepsi her değişiklikte, ~0,4 sn sonra):
   1) IndexedDB ana kayıt   2) localStorage senkron kopya   3) IndexedDB döner anlık görüntüler
   4) SEÇİLEN YEDEK KONUMU (Chrome/Edge):
        • klasör  → stok_portal_guncel.json (her değişiklik), gunluk_*.json, anlik_*.json (saatlik), oncesi_*.json
        • tek dosya → seçilen .json dosyası her değişiklikte üzerine yazılır
   Konum seçilmemişse / bulunamazsa / izin düşerse veri tarayıcıda tutulmaya devam eder ve kullanıcı uyarılır;
   konum geri gelince (sürücü takılınca vb.) otomatik yeniden bağlanılır ve güncel yedek yazılır.            */
const Depo = {
  db: null, ok: false, hata: '',
  async ac() {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB desteklenmiyor');
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open('sos_stok_v1', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('snap')) d.createObjectStore('snap', { keyPath: 'ts' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Veritabanı başka sekme tarafından kilitli'));
    });
    this.ok = true;
  },
  p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); },
  st(ad, mod) { return this.db.transaction(ad, mod).objectStore(ad); },
  kvAl(k) { return this.p(this.st('kv', 'readonly').get(k)); },
  kvKoy(k, v) { return this.p(this.st('kv', 'readwrite').put(v, k)); },
  snapKoy(ts, json, etiket) { return this.p(this.st('snap', 'readwrite').put({ ts, json, etiket, boyut: json.length })); },
  snapListe() { return this.p(this.st('snap', 'readonly').getAll()).then(l => l.sort((a, b) => b.ts - a.ts)); },
  snapSil(ts) { return this.p(this.st('snap', 'readwrite').delete(ts)); },
  async snapTemizle(tut) { const l = await this.snapListe(); for (const x of l.slice(tut)) await this.snapSil(x.ts); },
};

const Klasor = {
  destek: typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function',
  dosyaDestek: typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function',
  h: null, tur: '', durum: 'yok', ad: '', hata: '', sonYazma: 0, _anlik: 0, _gunluk: 0,
  // durum: yok (seçilmedi) | tamam | izin (tarayıcı izni gerekiyor) | kayip (konum bulunamadı) | hata
  get secilebilir() { return this.destek || this.dosyaDestek; },
  async baslat() {
    if (!this.secilebilir || !Depo.ok) return;
    try { this.h = (await Depo.kvAl('dir')) || null; this.sonYazma = (await Depo.kvAl('sonYazma')) || 0; } catch (e) { this.h = null; }
    if (this.h) { this.tur = this.h.kind === 'file' ? 'dosya' : 'klasor'; this.ad = this.h.name; await this.kontrol(); }
  },
  /** İzin var mı ve konum gerçekten duruyor mu? (klasör silindi/taşındı/sürücü çıkarıldı ise 'kayip') */
  async kontrol() {
    if (!this.h) { this.durum = 'yok'; return; }
    try { if ((await this.h.queryPermission({ mode: 'readwrite' })) !== 'granted') { this.durum = 'izin'; return; } }
    catch (e) { this.durum = 'hata'; this.hata = String(e.message || e); return; }
    try { await this.varMi(); this.durum = 'tamam'; this.hata = ''; }
    catch (e) {
      if (e && e.name === 'NotFoundError') { this.durum = 'kayip'; this.hata = 'Yedek konumu bulunamadı (silinmiş, taşınmış veya sürücü takılı değil).'; }
      else { this.durum = 'hata'; this.hata = String((e && e.message) || e); }
    }
  },
  async varMi() { if (this.tur === 'dosya') await this.h.getFile(); else for await (const x of this.h.entries()) { void x; break; } },
  async _sakla(h, tur) { this.h = h; this.tur = tur; this.ad = h.name; this.durum = 'tamam'; this.hata = ''; await Depo.kvKoy('dir', h); },
  async sec() { await this._sakla(await window.showDirectoryPicker({ mode: 'readwrite', id: 'sosstok' }), 'klasor'); },
  async dosyaSec() {
    await this._sakla(await window.showSaveFilePicker({ suggestedName: 'stok_portal_yedek.json', types: [{ description: 'Stok Portal yedeği', accept: { 'application/json': ['.json'] } }] }), 'dosya');
  },
  async izinVer() {
    try { await this.h.requestPermission({ mode: 'readwrite' }); } catch (e) { this.hata = String(e.message || e); }
    await this.kontrol();
  },
  async dosyaYaz(ad, metin) {
    const h = this.tur === 'dosya' ? this.h : await this.h.getFileHandle(ad, { create: true });
    const w = await h.createWritable();           // atomik: kapanışta yer değiştirir
    await w.write(metin); await w.close();
  },
  async listele() {
    if (this.tur === 'dosya') { const f = await this.h.getFile(); return [{ ad: this.h.name, boyut: f.size, degisim: f.lastModified }]; }
    const out = [];
    for await (const [ad, h] of this.h.entries()) {
      if (h.kind === 'file' && /^(stok_portal|anlik|gunluk|oncesi).*\.json$/.test(ad)) { const f = await h.getFile(); out.push({ ad, boyut: f.size, degisim: f.lastModified }); }
    }
    return out.sort((a, b) => b.degisim - a.degisim);
  },
  async oku(ad) { return (await (this.tur === 'dosya' ? this.h : await this.h.getFileHandle(ad)).getFile()).text(); },
  async temizle(onek, tut) {
    const l = (await this.listele()).filter(x => x.ad.startsWith(onek));
    for (const x of l.slice(tut)) { try { await this.h.removeEntry(x.ad); } catch (e) { /* yoksay */ } }
  },
  async yaz(json, zorla, kapanis) {
    if (this.durum !== 'tamam') return false;
    try {
      if (this.tur === 'dosya') await this.dosyaYaz(null, json);
      else {
        const d = new Date(), gun = iso(d).replace(/-/g, ''), hm = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
        await this.dosyaYaz('stok_portal_guncel.json', json);
        if (zorla || Date.now() - this._gunluk > 5 * 60e3) { await this.dosyaYaz(`gunluk_${gun}.json`, json); this._gunluk = Date.now(); await this.temizle('gunluk_', 90); }
        if (zorla || Date.now() - this._anlik > (kapanis ? 10 : 60) * 60e3) { await this.dosyaYaz(`anlik_${gun}_${hm}.json`, json); this._anlik = Date.now(); await this.temizle('anlik_', 48); }
      }
      this.sonYazma = Date.now(); this.hata = '';
      try { if (Depo.ok) await Depo.kvKoy('sonYazma', this.sonYazma); } catch (e) { /* yoksay */ }
      return true;
    } catch (e) {
      this.hata = String((e && e.message) || e);
      if (e && e.name === 'NotFoundError') { this.durum = 'kayip'; this.hata = 'Yedek konumu bulunamadı (silinmiş, taşınmış veya sürücü takılı değil).'; }
      else this.durum = (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) ? 'izin' : 'hata';
      return false;
    }
  },
};

const Kayit = {
  bekleyen: false, zaman: null, kuyruk: Promise.resolve(), sonKayit: 0, sonSnap: 0, eskiSekme: false, hata: '', sonIndirme: 0, kirli: false,
  planla() {
    if (this.eskiSekme || db._yeni) return;
    this.bekleyen = true; this.kirli = true; durumGuncelle();
    clearTimeout(this.zaman);
    this.zaman = setTimeout(() => this.flush(), 400);
  },
  flush(neden) { this.kuyruk = this.kuyruk.then(() => this._flush(neden)).catch(() => {}); return this.kuyruk; },
  senkron() {                                   // sayfa kapanırken: senkron kopya (eski/yeni-biçim sekme asla yazmaz)
    if (this.eskiSekme || db._yeni) return;
    try { localStorage.setItem('sos_db', JSON.stringify(db)); } catch (e) { /* yoksay */ }
  },
  async _flush(neden) {
    if (this.eskiSekme || db._yeni || (!this.bekleyen && neden !== 'zorla')) return;
    this.bekleyen = false;
    db.gun = Date.now();
    const json = JSON.stringify(db);
    let hata = '';
    try { localStorage.setItem('sos_db', json); } catch (e) { /* kota: IDB yeterli */ }
    if (Depo.ok) {
      try {
        await Depo.kvKoy('db', json);
        if (neden === 'zorla' || Date.now() - this.sonSnap > 10 * 60e3) {
          await Depo.snapKoy(Date.now(), json, neden === 'zorla' ? 'Elle' : 'Otomatik'); this.sonSnap = Date.now();
          await Depo.snapTemizle(30);
        }
      } catch (e) { hata = 'Tarayıcı kaydı yazılamadı: ' + (e.message || e); }
    } else hata = 'Tarayıcı veritabanı yok; yalnızca yedek konumu/dosya yedeği geçerli.';
    if (Klasor.durum === 'tamam') { if (await Klasor.yaz(json, neden === 'zorla', neden === 'kapanis')) this.kirli = false; }
    this.hata = hata; this.sonKayit = Date.now();
    try { if (bc) bc.postMessage({ gun: db.gun }); } catch (e) { /* yoksay */ }
    durumGuncelle(); bannerGuncelle();
  },
  async oncesi(etiket) {                        // riskli işlemden (içe aktarma, sıfırlama, sürüm yükseltme) önce görüntü
    const json = JSON.stringify(db), d = new Date();
    try { if (Depo.ok) { await Depo.snapKoy(Date.now(), json, etiket); await Depo.snapTemizle(30); } } catch (e) { /* yoksay */ }
    if (Klasor.durum === 'tamam' && Klasor.tur === 'klasor') { try { await Klasor.dosyaYaz(`oncesi_${iso(d).replace(/-/g, '')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}.json`, json); await Klasor.temizle('oncesi_', 20); } catch (e) { /* yoksay */ } }
  },
  indirildi() { this.sonIndirme = Date.now(); this.kirli = false; try { if (Depo.ok) Depo.kvKoy('sonIndirme', this.sonIndirme); } catch (e) { /* yoksay */ } },
  /** Yedek güvencesi: seviye ok | uyari | hata. 'hata' = veri yalnızca tarayıcıda, kullanıcı uyarılmalı. */
  yedekDurumu() {
    const veri = db.hr.length + db.kartlar.length > 0;
    if (Klasor.durum === 'tamam') return { kod: 'tamam', seviye: 'ok' };
    if (!Klasor.secilebilir) return { kod: 'desteklenmiyor', seviye: veri ? 'hata' : 'uyari' };
    if (Klasor.durum === 'kayip') return { kod: 'kayip', seviye: 'hata' };
    if (Klasor.durum === 'hata') return { kod: 'hata', seviye: 'hata' };
    if (Klasor.durum === 'izin') return { kod: 'izin', seviye: 'uyari' };
    return { kod: 'yok', seviye: veri ? 'hata' : 'uyari' };
  },
  /** Sekme kapanırken: kaydedilmemiş (yedeksiz) değişiklik var mı? */
  yedeksizKapanis() { return !db._yeni && this.kirli && this.yedekDurumu().seviye !== 'ok' && db.hr.length + db.kartlar.length > 0; },
};
kaydetKancasi = () => Kayit.planla();

const bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('sos_stok_v1') : null;
if (bc) bc.onmessage = e => { if (e.data && e.data.gun > db.gun) { Kayit.eskiSekme = true; bannerGuncelle(); durumGuncelle(); } };

/** Takılabilecek tarayıcı çağrılarının uygulamayı sonsuza dek "Yükleniyor"da bırakmasını önler. */
const zamanAsimi = (p, ms, ad) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error((ad || 'İşlem') + ' zaman aşımına uğradı')), ms))]);
async function yukle() {
  let a = null, b = null;
  try { await zamanAsimi(Depo.ac(), 6000, 'Tarayıcı veritabanı'); const s = await Depo.kvAl('db'); if (s) a = JSON.parse(s); Kayit.sonIndirme = (await Depo.kvAl('sonIndirme')) || 0; } catch (e) { Depo.hata = String(e.message || e); }
  try { const s = localStorage.getItem('sos_db'); if (s) b = JSON.parse(s); } catch (e) { /* yoksay */ }
  const adaylar = [a, b].filter(x => x && dogrula(x)).sort((x, y) => (y.gun || 0) - (x.gun || 0));
  db = adaylar[0] || bosDb();
  dv++; memo.clear();
  try { await zamanAsimi(Klasor.baslat(), 6000, 'Yedek konumu denetimi'); } catch (e) { Klasor.hata = String(e.message || e); }
  try { if (navigator.storage && navigator.storage.persist) await zamanAsimi(navigator.storage.persist(), 3000, 'Kalıcı depolama isteği'); } catch (e) { /* yoksay */ }
}

function dosyaIndir(ad, metin, mime) {
  const blob = new Blob([metin], { type: mime || 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = ad;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const zamanDamga = () => { const d = new Date(); return iso(d).replace(/-/g, '') + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };

/** Yedek metnini doğrular ve özetler (uygulamadan önce onay penceresi için). */
function yedekCoz(metin) {
  let o; try { o = JSON.parse(metin); } catch (e) { return { hata: 'Dosya geçerli bir JSON değil.' }; }
  if (!dogrula(o)) return { hata: 'Bu dosya bir Stok Portal yedeği değil.' };
  if (o._yeni) return { hata: `Bu yedek daha yeni bir sürümle alınmış (veri biçimi v${o.v}); bu dosya v${DB_SEMA}'yi destekliyor. Güncel index.html ile açın.` };
  return { o, kart: o.kartlar.length, hr: o.hr.length, gun: o.gun, firma: o.firma, surum: o.app || '—' };
}
async function yedekUygula(o, etiket) {
  await Kayit.oncesi('Geri yükleme öncesi — ' + etiket);
  db = o; dv++; memo.clear();
  if (authAktif()) oturumTazele();
  logYaz('YEDEK', 'Yedekten geri yüklendi: ' + etiket);
  Kayit.bekleyen = true; await Kayit.flush('zorla');
}

/* ---------- sürüm denetimi ---------- */
const SurumDenetim = { yeni: null, son: 0, hata: '' };
/** GitHub'daki (ayarlanmışsa) veya aynı adresteki (Pages gibi http/https) version.json ile karşılaştırır. Çevrimdışıysa sessizce geçer. */
async function guncellemeKontrol() {
  const adresler = [], g0 = (db.ayar && db.ayar.guncelleme) || {}, g = { repo: g0.repo || VARSAYILAN_REPO, dal: g0.dal || VARSAYILAN_DAL };
  if (g.repo && /^[\w.-]+\/[\w.-]+$/.test(g.repo)) adresler.push({ url: `https://raw.githubusercontent.com/${g.repo}/${g.dal || 'main'}/version.json`, kaynak: 'github' });
  if (typeof location !== 'undefined' && /^https?:/.test(location.protocol)) { try { adresler.push({ url: new URL('version.json', location.href).href + '?t=' + Date.now(), kaynak: 'site' }); } catch (e) { /* yoksay */ } }
  if (!adresler.length || typeof fetch !== 'function') { SurumDenetim.hata = adresler.length ? 'Bu ortam ağ erişimini desteklemiyor.' : 'Güncelleme kaynağı tanımlı değil.'; return { ok: false, msg: SurumDenetim.hata }; }
  for (const a of adresler) {
    try {
      const r = await fetch(a.url, { cache: 'no-store' }); if (!r.ok) continue;
      const j = await r.json(); if (!j || !j.surum) continue;
      SurumDenetim.son = Date.now(); SurumDenetim.hata = '';
      SurumDenetim.yeni = surumKarsilastir(j.surum, SURUM) > 0 ? Object.assign({ kaynak: a.kaynak }, j) : null;
      return { ok: true, yeni: SurumDenetim.yeni, j };
    } catch (e) { /* sıradaki adres */ }
  }
  SurumDenetim.hata = 'Sürüm bilgisi alınamadı (çevrimdışı olabilirsiniz).';
  return { ok: false, msg: SurumDenetim.hata };
}

/** Yeni sürümün index.html'ini (GitHub raw veya aynı site) indirir ve doğru sürüm olduğunu denetler. */
async function yeniSurumDosyasiAl() {
  const y = SurumDenetim.yeni, g0 = (db.ayar && db.ayar.guncelleme) || {}, g = { repo: g0.repo || VARSAYILAN_REPO, dal: g0.dal || VARSAYILAN_DAL };
  if (!y) return { ok: false, msg: 'Yeni sürüm bilgisi yok; önce "Şimdi denetle" deyin.' };
  if (typeof fetch !== 'function') return { ok: false, msg: 'Bu ortam ağ erişimini desteklemiyor.' };
  const url = y.kaynak === 'github' ? `https://raw.githubusercontent.com/${g.repo}/${g.dal || 'main'}/${y.indir || 'index.html'}?t=${Date.now()}` : new URL(y.indir || 'index.html', location.href).href + '?t=' + Date.now();
  try {
    const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return { ok: false, msg: 'Dosya indirilemedi (HTTP ' + r.status + '). Depo herkese açık (public) olmalı.' };
    const metin = await r.text();
    if (!/<title>[^<]*<\/title>|<html/i.test(metin) || metin.indexOf(`const SURUM = '${y.surum}'`) < 0) return { ok: false, msg: `İndirilen dosya ${y.surum} sürümü değil (index.html ile version.json depoya birlikte yüklenmemiş olabilir).` };
    return { ok: true, metin, surum: y.surum };
  } catch (e) { return { ok: false, msg: 'İndirme başarısız: ' + (e.message || e) }; }
}
// ============================ DEPO BİTİŞ ============================
