
// ============================ KİMLİK BAŞLA ============================
/* Kullanıcı girişi, roller ve şifre yönetimi.
   ÖNEMLİ: Uygulama sunucusuz çalıştığı için bu bir OPERASYONEL erişim kontrolüdür (kim ne yaptı, kim neyi görür/yapar);
   teknik bilgisi olan biri yedek dosyasını açarak veya tarayıcı konsolundan verilere ulaşabilir. Şifreler düz metin saklanmaz
   (PBKDF2-SHA256 + rastgele tuz), ancak yedek dosyaları şifrelenmez.                                                         */
const SIFRE_MIN = 6, PBKDF2_IT = 120000;
const KADI_RE = /^[a-z0-9._-]{3,24}$/;
const kripto = () => (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : null;
const rastgeleBayt = n => { const b = new Uint8Array(n); kripto().getRandomValues(b); return b; };
const b64 = u => { let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const kadiTemiz = s => String(s || '').trim().toLowerCase();

/* ---- SHA-256 / HMAC / PBKDF2 (yalnızca crypto.subtle olmayan, güvenli olmayan bağlamlar için yedek) ---- */
let _sha = null;
function shaSabit() {
  if (_sha) return _sha;
  const p = []; for (let n = 2; p.length < 64; n++) if (p.every(q => n % q)) p.push(n);
  _sha = { K: p.map(x => Math.floor((Math.cbrt(x) % 1) * 4294967296) >>> 0), H: p.slice(0, 8).map(x => Math.floor((Math.sqrt(x) % 1) * 4294967296) >>> 0) };
  return _sha;
}
function sha256(msg) {
  const { K, H: H0 } = shaSabit(), H = H0.slice(), l = msg.length, pl = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(pl); buf.set(msg); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(pl - 4, (l * 8) >>> 0); dv.setUint32(pl - 8, Math.floor(l * 8 / 4294967296));
  const w = new Uint32Array(64);
  for (let o = 0; o < pl; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      w[i] = (w[i - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[i - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer); H.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
}
function pbkdf2Js(sifre, tuz, it) {
  let key = new TextEncoder().encode(sifre); if (key.length > 64) key = sha256(key);
  const ip = new Uint8Array(64).fill(0x36), op = new Uint8Array(64).fill(0x5c); key.forEach((x, i) => { ip[i] ^= x; op[i] ^= x; });
  const hmac = m => { const a = new Uint8Array(64 + m.length); a.set(ip); a.set(m, 64); const i1 = sha256(a); const b = new Uint8Array(96); b.set(op); b.set(i1, 64); return sha256(b); };
  const s = new Uint8Array(tuz.length + 4); s.set(tuz); s[s.length - 1] = 1;
  let u = hmac(s); const t = u.slice();
  for (let i = 1; i < it; i++) { u = hmac(u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
  return t;
}
async function pbkdf2(sifre, tuz, it) {
  const c = kripto();
  if (c && c.subtle) {
    const k = await c.subtle.importKey('raw', new TextEncoder().encode(sifre), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await c.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: tuz, iterations: it }, k, 256));
  }
  return pbkdf2Js(sifre, tuz, it);
}
const esitMi = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
async function sifreKaydi(sifre, it = PBKDF2_IT) { const tuz = rastgeleBayt(16); return { tuz: b64(tuz), hash: b64(await pbkdf2(String(sifre).normalize('NFC'), tuz, it)), it }; }
async function sifreDogru(sifre, kayit) { return esitMi(await pbkdf2(String(sifre).normalize('NFC'), unb64(kayit.tuz), kayit.it), unb64(kayit.hash)); }
let _sahte = null;                                       // olmayan kullanıcı için de aynı süreyi harcamak (zamanlama sızıntısını azaltır)
const sahteKayit = async () => (_sahte = _sahte || await sifreKaydi('sahte-' + Math.random()));

/* ---- kurtarma kodu ---- */
const KOD_ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function kurtarmaKoduUret() { const b = rastgeleBayt(20); let s = ''; for (const x of b) s += KOD_ALFA[x % 32]; return s.match(/.{5}/g).join('-'); }
const kodTemiz = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---- oturum ---- */
const denemeler = new Map();                             // kadi → { n, until }
function oturumKur(u) { oturum = { id: u.id, kadi: u.kadi, ad: u.ad, rol: u.rol }; oturumKaydet(); }
function oturumKaydet() { try { if (oturum) sessionStorage.setItem('sos_oturum', JSON.stringify({ id: oturum.id, ts: Date.now() })); } catch (e) { /* yoksay */ } }
function oturumSil() { try { sessionStorage.removeItem('sos_oturum'); } catch (e) { /* yoksay */ } }
/** Sayfa yenilenince aynı sekmedeki oturum (süresi dolmadıysa) geri gelir. */
function oturumGeriYukle() {
  if (!authAktif()) return false;
  try {
    const o = JSON.parse(sessionStorage.getItem('sos_oturum') || 'null'); if (!o) return false;
    const u = db.kullanicilar.find(x => x.id === o.id && x.aktif !== false);
    if (!u || Date.now() - o.ts > (+db.ayar.kilitDk || 15) * 60e3) return false;
    oturumKur(u); return true;
  } catch (e) { return false; }
}
/** Rol/ad/aktiflik değişikliklerini mevcut oturuma yansıtır; hesap pasifleşmişse oturumu kapatır. */
function oturumTazele() {
  if (!oturum) return false;
  const u = db.kullanicilar.find(x => x.id === oturum.id);
  if (!u || u.aktif === false) { oturum = null; oturumSil(); return false; }
  oturum.rol = u.rol; oturum.ad = u.ad; oturum.kadi = u.kadi; return true;
}
async function girisYap(kadi, sifre) {
  kadi = kadiTemiz(kadi);
  const d = denemeler.get(kadi) || { n: 0, until: 0 };
  if (Date.now() < d.until) return { ok: false, msg: `Çok fazla hatalı deneme. ${Math.ceil((d.until - Date.now()) / 1000)} sn sonra tekrar deneyin.` };
  const u = db.kullanicilar.find(x => x.kadi === kadi);
  const dogru = await sifreDogru(String(sifre || ''), u ? u.sifre : await sahteKayit());
  if (!(u && u.aktif !== false && dogru)) {
    d.n++; if (d.n >= 5) d.until = Date.now() + Math.min(300, 30 * Math.pow(2, d.n - 5)) * 1000; denemeler.set(kadi, d);
    const ek = u && u.aktif === false && dogru ? ' (pasif hesap)' : '';
    oturum = null; logYaz('GIRIS_HATA', `Hatalı giriş denemesi: ${kadi || '(boş)'}${ek}`); degisti();
    return { ok: false, msg: ek ? 'Bu hesap pasif; yöneticinize başvurun.' : 'Kullanıcı adı veya şifre hatalı.' };
  }
  denemeler.delete(kadi); u.sonGiris = Date.now(); oturumKur(u); logYaz('GIRIS', 'Giriş yapıldı'); degisti();
  return { ok: true, zorla: !!u.zorla };
}
function cikisYap(neden) {
  if (oturum) { logYaz(neden === 'kilit' ? 'KILIT' : 'CIKIS', neden === 'kilit' ? 'Oturum hareketsizlik nedeniyle kilitlendi' : 'Çıkış yapıldı'); degisti(); }
  oturum = null; oturumSil();
}

/* ---- koruma ve kullanıcı yönetimi ---- */
function sifreKontrol(s) { return String(s || '').length < SIFRE_MIN ? `Şifre en az ${SIFRE_MIN} karakter olmalı.` : ''; }
function kadiKontrol(k, haricId) {
  if (!KADI_RE.test(k)) return 'Kullanıcı adı 3-24 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi (ör. ayse.k).';
  if (db.kullanicilar.some(u => u.kadi === k && u.id !== haricId)) return 'Bu kullanıcı adı zaten var.';
  return '';
}
const aktifYoneticiSayisi = (haric) => db.kullanicilar.filter(u => u.rol === 'yonetici' && u.aktif !== false && u.id !== haric).length;
/** İlk kurulum: yönetici hesabı oluşturur, koruma açılır, TEK SEFERLİK kurtarma kodu üretir. */
async function korumayiEtkinlestir({ kadi, ad, sifre }) {
  if (authAktif()) return yasak();
  if (db.kullanicilar.length) return { ok: false, msg: 'Kullanıcılar zaten tanımlı; "Korumayı yeniden aç" kullanın.' };
  kadi = kadiTemiz(kadi); const h = kadiKontrol(kadi) || sifreKontrol(sifre) || (String(ad || '').trim() ? '' : 'Ad soyad boş olamaz.');
  if (h) return { ok: false, msg: h };
  const kod = kurtarmaKoduUret();
  const u = { id: db.sayac++, kadi, ad: String(ad).trim(), rol: 'yonetici', aktif: true, zorla: false, olusturma: Date.now(), sonGiris: Date.now(), sifre: await sifreKaydi(sifre) };
  db.kullanicilar.push(u);
  db.guvenlik = { aktif: true, kurtarma: await sifreKaydi(kodTemiz(kod)) };
  oturumKur(u); logYaz('KULLANICI', `Giriş koruması etkinleştirildi; ilk yönetici: ${kadi}`); degisti();
  return { ok: true, kod };
}
async function korumayiAc(kadi, sifre) {
  if (authAktif()) return { ok: false, msg: 'Koruma zaten açık.' };
  const u = db.kullanicilar.find(x => x.kadi === kadiTemiz(kadi) && x.rol === 'yonetici' && x.aktif !== false);
  if (!u || !(await sifreDogru(String(sifre || ''), u.sifre))) return { ok: false, msg: 'Yönetici kullanıcı adı veya şifresi hatalı.' };
  db.guvenlik.aktif = true; oturumKur(u); logYaz('KULLANICI', 'Giriş koruması yeniden açıldı'); degisti();
  return { ok: true };
}
async function korumayiKapat(sifre) {
  if (!izin('kullanici')) return yasak();
  const u = db.kullanicilar.find(x => x.id === oturum.id);
  if (!u || !(await sifreDogru(String(sifre || ''), u.sifre))) return { ok: false, msg: 'Şifre hatalı.' };
  logYaz('KULLANICI', 'Giriş koruması KAPATILDI (kullanıcı tanımları saklandı)'); db.guvenlik.aktif = false; degisti();
  return { ok: true };
}
async function kullaniciEkle({ kadi, ad, rol, sifre }) {
  if (!izin('kullanici')) return yasak();
  kadi = kadiTemiz(kadi);
  const h = kadiKontrol(kadi) || sifreKontrol(sifre) || (ROLLER[rol] ? '' : 'Rol seçin.') || (String(ad || '').trim() ? '' : 'Ad soyad boş olamaz.');
  if (h) return { ok: false, msg: h };
  db.kullanicilar.push({ id: db.sayac++, kadi, ad: String(ad).trim(), rol, aktif: true, zorla: true, olusturma: Date.now(), sonGiris: 0, sifre: await sifreKaydi(sifre) });
  logYaz('KULLANICI', `Kullanıcı eklendi: ${kadi} (${ROLLER[rol].ad})`); degisti();
  return { ok: true, msg: `${kadi} eklendi. İlk girişte şifresini değiştirmesi istenecek.` };
}
function kullaniciGuncelle(id, { ad, rol, aktif }) {
  if (!izin('kullanici')) return yasak();
  const u = db.kullanicilar.find(x => x.id === id); if (!u) return { ok: false, msg: 'Kullanıcı bulunamadı.' };
  const yeniRol = rol || u.rol, yeniAktif = aktif === undefined ? u.aktif !== false : !!aktif;
  if (!ROLLER[yeniRol]) return { ok: false, msg: 'Geçersiz rol.' };
  if ((u.rol === 'yonetici' && u.aktif !== false) && (yeniRol !== 'yonetici' || !yeniAktif) && aktifYoneticiSayisi(u.id) < 1)
    return { ok: false, msg: 'Son aktif yönetici pasifleştirilemez veya rolü düşürülemez.' };
  const d = [];
  if (ad && String(ad).trim() !== u.ad) { d.push(`ad ${u.ad} → ${String(ad).trim()}`); u.ad = String(ad).trim(); }
  if (yeniRol !== u.rol) { d.push(`rol ${ROLLER[u.rol].ad} → ${ROLLER[yeniRol].ad}`); u.rol = yeniRol; }
  if (yeniAktif !== (u.aktif !== false)) { d.push(yeniAktif ? 'aktif yapıldı' : 'pasif yapıldı'); u.aktif = yeniAktif; }
  if (!d.length) return { ok: true, msg: 'Değişiklik yok.' };
  logYaz('KULLANICI', `Kullanıcı güncellendi: ${u.kadi} — ${d.join(', ')}`); degisti();
  return { ok: true, msg: 'Kullanıcı güncellendi.' };
}
async function sifreSifirla(id, gecici) {
  if (!izin('kullanici')) return yasak();
  const u = db.kullanicilar.find(x => x.id === id); if (!u) return { ok: false, msg: 'Kullanıcı bulunamadı.' };
  const h = sifreKontrol(gecici); if (h) return { ok: false, msg: h };
  u.sifre = await sifreKaydi(gecici); u.zorla = true; denemeler.delete(u.kadi);
  logYaz('KULLANICI', `Şifre sıfırlandı (geçici): ${u.kadi}`); degisti();
  return { ok: true, msg: `${u.kadi} için geçici şifre belirlendi; ilk girişte değiştirmesi istenecek.` };
}
async function sifreDegistir(eski, yeni) {
  const u = oturum && db.kullanicilar.find(x => x.id === oturum.id); if (!u) return { ok: false, msg: 'Oturum yok.' };
  if (!(await sifreDogru(String(eski || ''), u.sifre))) return { ok: false, msg: 'Mevcut şifre hatalı.' };
  return sifreBelirle(yeni, eski);
}
/** Zorunlu şifre değişikliğinde (yönetici sıfırladıktan sonra ilk giriş) veya sifreDegistir içinden kullanılır. */
async function sifreBelirle(yeni, eski) {
  const u = oturum && db.kullanicilar.find(x => x.id === oturum.id); if (!u) return { ok: false, msg: 'Oturum yok.' };
  const h = sifreKontrol(yeni) || (yeni === eski ? 'Yeni şifre eskisiyle aynı olamaz.' : ''); if (h) return { ok: false, msg: h };
  u.sifre = await sifreKaydi(yeni); u.zorla = false; logYaz('KULLANICI', 'Kendi şifresini değiştirdi'); degisti();
  return { ok: true, msg: 'Şifre değiştirildi.' };
}
/** Yönetici şifresi unutulursa: ilk kurulumda gösterilen kurtarma koduyla yeni şifre belirlenir; yeni kod üretilir. */
async function kurtarmaIleSifirla(kod, kadi, yeni) {
  const d = denemeler.get('__kurtarma') || { n: 0, until: 0 };
  if (Date.now() < d.until) return { ok: false, msg: `Çok fazla hatalı deneme. ${Math.ceil((d.until - Date.now()) / 1000)} sn sonra tekrar deneyin.` };
  const u = db.kullanicilar.find(x => x.kadi === kadiTemiz(kadi) && x.rol === 'yonetici');
  const dogru = db.guvenlik && db.guvenlik.kurtarma && await sifreDogru(kodTemiz(kod), db.guvenlik.kurtarma);
  if (!u || !dogru) {
    d.n++; if (d.n >= 3) d.until = Date.now() + Math.min(900, 60 * Math.pow(2, d.n - 3)) * 1000; denemeler.set('__kurtarma', d);
    oturum = null; logYaz('GIRIS_HATA', `Hatalı kurtarma kodu denemesi (${kadiTemiz(kadi) || 'boş'})`); degisti();
    return { ok: false, msg: 'Kurtarma kodu veya yönetici kullanıcı adı hatalı.' };
  }
  const h = sifreKontrol(yeni); if (h) return { ok: false, msg: h };
  denemeler.delete('__kurtarma'); denemeler.delete(u.kadi);
  const yeniKod = kurtarmaKoduUret();
  u.sifre = await sifreKaydi(yeni); u.zorla = false; u.aktif = true; db.guvenlik.kurtarma = await sifreKaydi(kodTemiz(yeniKod));
  oturum = null; logYaz('KULLANICI', `Yönetici şifresi kurtarma koduyla sıfırlandı: ${u.kadi}`); degisti();
  return { ok: true, kod: yeniKod };
}
// ============================ KİMLİK BİTİŞ ============================
