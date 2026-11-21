// ============================ İÇE AKTARMA (Excel / CSV) ============================
// Stok kartlarını ve açılış stoğunu Excel (.xlsx) veya CSV dosyasından alır. Sütunları başlıklardan ve içeriklerinden kendisi tanır;
// kullanıcı eşlemeyi önizlemede değiştirebilir. Harici kütüphane yok: .xlsx dosyası tarayıcının kendi açıcısıyla (DecompressionStream) okunur.

const AKT_SATIR_MAX = 5000;
const aktNorm = s => trLower(String(s ?? '')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();

// ---- alan eş anlamlıları (normalleştirilmiş) ----
const AKT_ALANLAR = {
  ad:     { ad: 'Ürün adı', zorunlu: true, say: false, es: ['urun adi', 'urun ismi', 'urun', 'stok adi', 'stok ismi', 'stok kartı', 'stok karti', 'malzeme adi', 'malzeme', 'mal adi', 'mal', 'kalem', 'kalem adi', 'tanim', 'aciklama', 'ad', 'adi', 'isim', 'urun tanimi', 'stok tanimi', 'product', 'product name', 'item', 'name', 'description'] },
  kat:    { ad: 'Kategori', say: false, es: ['kategori', 'kat', 'sinif', 'tur', 'cins', 'alt grup', 'urun kategorisi', 'category'] },
  grup:   { ad: 'Grup (Ham / Mamül / Ticari)', say: false, es: ['grup', 'urun grubu', 'stok grubu', 'ana grup', 'stok turu', 'urun turu', 'mal grubu', 'group', 'type'] },
  birim:  { ad: 'Birim', say: false, es: ['birim', 'olcu birimi', 'olcu', 'br', 'brm', 'unit', 'uom', 'stok birimi'] },
  asgari: { ad: 'Asgari stok', say: true, es: ['asgari', 'asgari stok', 'minimum', 'minimum stok', 'min', 'min stok', 'kritik', 'kritik stok', 'emniyet stogu', 'guvenlik stogu', 'sipariş noktasi', 'siparis noktasi', 'min miktar', 'reorder'] },
  miktar: { ad: 'Mevcut miktar (açılış stoğu)', say: true, es: ['miktar', 'stok miktari', 'mevcut', 'mevcut stok', 'mevcut miktar', 'bakiye', 'stok bakiyesi', 'kalan', 'kalan stok', 'stok', 'sayim', 'sayim miktari', 'devir', 'acilis', 'acilis stogu', 'envanter', 'adet', 'qty', 'quantity', 'stock', 'on hand'] },
  fiyat:  { ad: 'Birim maliyet / alış fiyatı', say: true, es: ['birim fiyat', 'birim maliyet', 'alis fiyati', 'alis fiyat', 'maliyet', 'maliyet fiyati', 'ort maliyet', 'ortalama maliyet', 'alis', 'fiyat', 'alis bedeli', 'birim alis fiyati', 'cost', 'price', 'unit cost', 'unit price'] },
  kar:    { ad: 'Kâr %', say: true, es: ['kar', 'kar orani', 'kar yuzdesi', 'kar marji', 'marj', 'kar', 'margin', 'markup'] },
};
const AKT_SIRA = ['ad', 'kat', 'grup', 'birim', 'asgari', 'miktar', 'fiyat', 'kar'];
const AKT_GRUP_SOZ = {
  HAM: ['ham', 'hammadde', 'ham madde', 'hammaddeler', 'hm', 'girdi', 'malzeme'],
  MAMUL: ['mamul', 'mamuller', 'yari mamul', 'yarimamul', 'uretim', 'mm', 'mamul urun', 'nihai urun', 'bitmis urun'],
  TICARI: ['ticari', 'ticari mal', 'ticari urun', 'perakende', 'satis', 'tm', 'ticari mallar', 'satilik'],
};
const AKT_GRUP_MAP = (() => { const m = new Map(); for (const g in AKT_GRUP_SOZ) AKT_GRUP_SOZ[g].forEach(s => m.set(s, g)); return m; })();
const AKT_BIRIM_MAP = new Map([
  ['kg', 'KG'], ['kilo', 'KG'], ['kilogram', 'KG'], ['kgr', 'KG'], ['adet', 'Adet'], ['ad', 'Adet'], ['pcs', 'Adet'], ['piece', 'Adet'], ['tane', 'Adet'], ['lt', 'Litre'], ['l', 'Litre'], ['litre', 'Litre'], ['liter', 'Litre'],
  ['paket', 'Paket'], ['pkt', 'Paket'], ['pk', 'Paket'], ['koli', 'Koli'], ['kl', 'Koli'], ['m', 'Metre'], ['mt', 'Metre'], ['metre', 'Metre'], ['gr', 'gram'], ['g', 'gram'], ['gram', 'gram'], ['ml', 'ml'], ['ton', 'Ton'], ['t', 'Ton'],
]);
const aktBirim = s => { const n = aktNorm(s); if (!n) return ''; return AKT_BIRIM_MAP.get(n) || String(s).trim(); };
const aktBirimMi = s => AKT_BIRIM_MAP.has(aktNorm(s)) || ['porsiyon', 'kutu', 'sise', 'duzine', 'cuval', 'demet', 'rulo'].includes(aktNorm(s));

/** "1.234,5", "1,234.5", "%30", 12 → sayı; çözülemezse NaN. Tek noktalı "1.500" binlik sayılır (0.500 değil). */
function aktSayi(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/[%₺$€\s]|TL$/gi, '');
  if (!s) return NaN;
  if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^[1-9]\d{0,2}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, '');
  return sayiOku(s);
}

// ---- dosya okuma ----
const aktHucre = v => (v == null ? '' : v);
function aktXmlCoz(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&'); }

async function aktInflate(bayt) {
  const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bayt); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
/** ZIP (xlsx) içindeki dosyaları {ad: Uint8Array} olarak döndürür; yalnızca istenenler açılır. */
async function aktZipAc(buf, istenen) {
  const b = new Uint8Array(buf), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65600); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Dosya bir Excel (.xlsx) dosyası gibi görünmüyor.');
  const adet = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < adet; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const yontem = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), n = dv.getUint16(p + 28, true), m = dv.getUint16(p + 30, true), k = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const ad = new TextDecoder().decode(b.subarray(p + 46, p + 46 + n)); p += 46 + n + m + k;
    if (!istenen(ad)) continue;
    const ln = dv.getUint16(lo + 26, true), lm = dv.getUint16(lo + 28, true), bas = lo + 30 + ln + lm, ham = b.subarray(bas, bas + csize);
    out[ad] = yontem === 0 ? ham : await aktInflate(ham);
  }
  return out;
}
const aktKolon = r => { let n = 0; for (const c of r.replace(/\d/g, '')) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
/** .xlsx → satırlar (dizi dizisi). En çok dolu satırı olan sayfa seçilir. */
async function xlsxOku(buf) {
  const z = await aktZipAc(buf, ad => /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(ad));
  const dec = new TextDecoder('utf-8'), ss = [];
  if (z['xl/sharedStrings.xml']) {
    const x = dec.decode(z['xl/sharedStrings.xml']); const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g; let m;
    while ((m = re.exec(x))) { const t = m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''); let s = ''; const r2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let q; while ((q = r2.exec(t))) s += q[1]; ss.push(aktXmlCoz(s)); }
  }
  let en = null;
  for (const ad of Object.keys(z).filter(a => /worksheets\//.test(a)).sort()) {
    const x = dec.decode(z[ad]), satirlar = []; const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
    while ((m = re.exec(x))) {
      const at = m[1], ic = m[2] || ''; const r = /\br="([A-Z]+)(\d+)"/.exec(at); if (!r) continue;
      const t = (/\bt="(\w+)"/.exec(at) || [])[1], v = (/<v>([\s\S]*?)<\/v>/.exec(ic) || [])[1]; let val = null;
      if (t === 'inlineStr') { let s = ''; const r2 = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let q; while ((q = r2.exec(ic))) s += q[1]; val = aktXmlCoz(s); }
      else if (v === undefined) continue;
      else if (t === 's') val = ss[+v] ?? '';
      else if (t === 'str' || t === 'e') val = aktXmlCoz(v);
      else if (t === 'b') val = v === '1' ? 'Evet' : 'Hayır';
      else { const n = Number(v); val = isFinite(n) ? n : aktXmlCoz(v); }
      const ri = +r[2] - 1, ci = aktKolon(r[1]); (satirlar[ri] = satirlar[ri] || [])[ci] = val;
    }
    const dolu = satirlar.filter(s => s && s.some(c => c !== '' && c != null)).length;
    if (!en || dolu > en.dolu) en = { dolu, satirlar };
  }
  if (!en) throw new Error('Excel dosyasında okunabilir sayfa bulunamadı.');
  return Array.from(en.satirlar, s => (s ? Array.from(s, aktHucre) : [])).slice(0, AKT_SATIR_MAX + 30);
}
/** CSV / TXT metni → satırlar. Ayraç (; , sekme) ve tırnaklar otomatik. */
function csvOku(metin) {
  metin = String(metin).replace(/^﻿/, '');
  const ilk = metin.split(/\r?\n/).filter(s => s.trim()).slice(0, 10); const say = c => ilk.reduce((a, s) => a + (s.split(c).length - 1), 0);
  const aday = [';', '\t', ',', '|'].map(c => [c, say(c)]).sort((a, b) => b[1] - a[1]); const ay = aday[0][1] ? aday[0][0] : ';';
  const rows = []; let r = [], h = '', q = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (q) { if (c === '"') { if (metin[i + 1] === '"') { h += '"'; i++; } else q = false; } else h += c; }
    else if (c === '"') q = true;
    else if (c === ay) { r.push(h); h = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && metin[i + 1] === '\n') i++; r.push(h); h = ''; rows.push(r); r = []; }
    else h += c;
  }
  if (h !== '' || r.length) { r.push(h); rows.push(r); }
  return rows.slice(0, AKT_SATIR_MAX + 30);
}
/** Dosya (File) → satırlar. */
async function aktDosyaOku(f) {
  const ad = String(f.name || '').toLowerCase(), buf = await f.arrayBuffer();
  if (/\.xlsx$|\.xlsm$/.test(ad)) return xlsxOku(buf);
  if (/\.xls$/.test(ad)) throw new Error('Eski .xls biçimi desteklenmiyor: Excel\'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" veya "CSV" seçip tekrar deneyin.');
  const b = new Uint8Array(buf); let metin;
  try { metin = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { metin = new TextDecoder('windows-1254').decode(b); }
  return csvOku(metin);
}

// ---- akıllı sütun tanıma ----
function aktLev(a, b) { if (Math.abs(a.length - b.length) > 1) return 9; const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
function aktBaslikPuan(h, alan) {
  h = aktNorm(h); if (!h) return 0; let en = 0;
  for (const s0 of AKT_ALANLAR[alan].es) {
    const s = aktNorm(s0); let p = 0;
    if (h === s) p = 100;
    else if (` ${h} `.includes(` ${s} `)) p = 55 + s.length;               // başlık eş anlamlıyı kelime olarak içeriyor ("Alış Birim Fiyatı")
    else if (s.length >= 4 && h.length >= 4 && aktLev(h, s) <= 1) p = 50;   // yazım hatası
    if (p > en) en = p;
  }
  return en;
}
const aktSutun = (rows, ci, bas) => rows.slice(bas).map(r => r[ci]).filter(v => v !== '' && v != null);
const aktSayiOran = v => v.length ? v.filter(x => isFinite(aktSayi(x))).length / v.length : 0;
const aktGrupOran = v => v.length ? v.filter(x => AKT_GRUP_MAP.has(aktNorm(x))).length / v.length : 0;
const aktBirimOran = v => v.length ? v.filter(x => aktBirimMi(x)).length / v.length : 0;

/** rows → { baslik: başlık satırı indeksi (-1 yok), esleme: {alan: sütun|-1}, tahmin: bool, sutunlar: [başlık metni] } */
function sutunTani(rows) {
  const gen = Math.max(0, ...rows.slice(0, 40).map(r => r.length));
  let en = { n: 0, i: -1, esleme: null };
  rows.slice(0, 25).forEach((r, i) => {
    if (r.filter(c => c !== '' && c != null).length < 2) return;
    const aday = [];
    for (let c = 0; c < gen; c++) for (const a of AKT_SIRA) { const p = aktBaslikPuan(r[c], a); if (p >= 50) aday.push({ c, a, p }); }
    aday.sort((x, y) => y.p - x.p); const kc = new Set(), ka = new Set(), es = {};
    for (const x of aday) { if (kc.has(x.c) || ka.has(x.a)) continue; kc.add(x.c); ka.add(x.a); es[x.a] = x.c; }
    const n = Object.keys(es).length; if (n > en.n || (n === en.n && n && i < en.i)) en = { n, i, esleme: es };
  });
  let baslik = -1, esleme = {}, tahmin = false;
  if (en.n >= 2 || (en.n === 1 && en.esleme.ad != null)) { baslik = en.i; esleme = en.esleme; }
  else tahmin = true;
  const bas = baslik + 1;
  // içerik doğrulaması ve düzeltme: sayısal alanlar sayısal sütunda olmalı; "grup" başlıklı sütun grup sözcüğü içermiyorsa kategoridir
  for (const a of AKT_SIRA) {
    if (esleme[a] == null) continue; const v = aktSutun(rows, esleme[a], bas);
    if (AKT_ALANLAR[a].say && aktSayiOran(v) < 0.5) delete esleme[a];
    else if (a === 'ad' && aktSayiOran(v) > 0.8) delete esleme[a];
  }
  if (esleme.grup != null && aktGrupOran(aktSutun(rows, esleme.grup, bas)) < 0.5) { if (esleme.kat == null) esleme.kat = esleme.grup; delete esleme.grup; }
  if (esleme.grup == null) for (let c = 0; c < gen; c++) if (!Object.values(esleme).includes(c) && aktGrupOran(aktSutun(rows, c, bas)) >= 0.6) { esleme.grup = c; break; }
  if (esleme.birim == null) for (let c = 0; c < gen; c++) if (!Object.values(esleme).includes(c) && aktBirimOran(aktSutun(rows, c, bas)) >= 0.7) { esleme.birim = c; break; }
  // başlık bulunamadıysa içerikten tahmin: ad = en uzun metin sütunu, kalan sayısal sütunlar sırayla miktar → fiyat
  if (esleme.ad == null) {
    let enc = -1, enu = 0; for (let c = 0; c < gen; c++) { if (Object.values(esleme).includes(c)) continue; const v = aktSutun(rows, c, bas); if (v.length < 2 || aktSayiOran(v) > 0.5) continue; const u = v.reduce((a, x) => a + String(x).length, 0) / v.length; if (u > enu) { enu = u; enc = c; } }
    if (enc >= 0) esleme.ad = enc;
  }
  if (tahmin) for (const a of ['miktar', 'fiyat']) { for (let c = 0; c < gen; c++) if (!Object.values(esleme).includes(c) && aktSayiOran(aktSutun(rows, c, bas)) >= 0.8) { esleme[a] = c; break; } }
  const sutunlar = []; for (let c = 0; c < gen; c++) { const h = baslik >= 0 ? rows[baslik][c] : ''; sutunlar.push(String(h ?? '').trim()); }
  return { baslik, esleme, tahmin, sutunlar, gen };
}
const aktSutunAd = (n, t) => { let s = '', k = n + 1; while (k) { s = String.fromCharCode(65 + (k - 1) % 26) + s; k = Math.floor((k - 1) / 26); } return s + (t ? ` — ${t}` : ''); };

// ---- satırları çözme ----
/** Eşlemeye göre kart adaylarını üretir; her biri 'yeni' | 'var' | 'hata' | 'tekrar' durumundadır. */
function aktSatirlariCoz(rows, baslik, esleme, varsGrup) {
  const out = [], gor = new Set(); const g = a => esleme[a] == null || esleme[a] < 0 ? null : esleme[a];
  for (let i = baslik + 1; i < rows.length && out.length < AKT_SATIR_MAX; i++) {
    const r = rows[i] || []; if (!r.some(c => c !== '' && c != null)) continue;
    const al = a => { const v = g(a) == null ? '' : r[g(a)]; return v == null ? '' : v; };
    const ad = String(al('ad') ?? '').trim(); if (!ad) { if (g('ad') != null && r.some(c => c !== '' && c != null)) out.push({ n: i + 1, ad: '', durum: 'hata', msg: 'Ürün adı boş' }); continue; }
    if (/^(genel |ara )?toplam\b/.test(aktNorm(ad)) || /^(sayfa|rapor|tarih)\b/.test(aktNorm(ad)) && !g('miktar')) continue;
    const gs = aktNorm(al('grup')); const grup = AKT_GRUP_MAP.get(gs) || varsGrup;
    const birimHam = al('birim'), birim = aktBirim(birimHam) || (grup === 'TICARI' ? 'Adet' : 'KG');
    const num = a => { const v = al(a); return v === '' || v == null ? NaN : aktSayi(v); };
    const x = { n: i + 1, ad, kat: String(al('kat') ?? '').trim(), grup, birim, asgari: num('asgari'), miktar: num('miktar'), fiyat: num('fiyat'), kar: num('kar'), durum: 'yeni', msg: '' };
    if (x.miktar < 0) { x.durum = 'hata'; x.msg = 'Negatif miktar'; }
    else if (g('miktar') != null && al('miktar') !== '' && !isFinite(x.miktar)) { x.durum = 'hata'; x.msg = `Miktar sayı değil: "${al('miktar')}"`; }
    else if (g('fiyat') != null && al('fiyat') !== '' && !isFinite(x.fiyat)) { x.durum = 'hata'; x.msg = `Fiyat sayı değil: "${al('fiyat')}"`; }
    else {
      const anah = grup + '|' + trLower(ad);
      if (gor.has(anah)) { x.durum = 'tekrar'; x.msg = 'Dosyada tekrar (atlanır)'; }
      else if (db.kartlar.some(k => trLower(k.ad) === trLower(ad) && k.grup === grup)) { x.durum = 'var'; x.msg = 'Bu kart zaten var (atlanır)'; }
      else if (db.kartlar.some(k => trLower(k.ad) === trLower(ad))) x.msg = 'Başka grupta aynı adlı kart var';
      gor.add(anah);
    }
    out.push(x);
  }
  return out;
}
/** 'yeni' satırlar için kart açar; istenirse miktarı olanlara açılış stoğu (alış hareketi) yazar. Tek günlük kaydı düşer. */
function aktarUygula(satirlar, opt) {
  opt = opt || {};
  if (!izin('kart')) return yasak();
  const yeni = satirlar.filter(x => x.durum === 'yeni'); if (!yeni.length) return { ok: false, msg: 'Aktarılacak yeni kart yok.' };
  if (opt.acilis && !izin('giris')) return { ok: false, msg: 'Açılış stoğu için giriş yetkiniz yok; "açılış stoğu" seçeneğini kapatın.' };
  const idler = []; let hata = 0;
  for (const x of yeni) {
    const r = kartEkle({ ad: x.ad, kat: x.kat, grup: x.grup, birim: x.birim, asgari: isFinite(x.asgari) ? x.asgari : 0, kar: isFinite(x.kar) ? x.kar : '' }, true);
    if (r.ok) idler.push({ x, id: r.id }); else hata++;
  }
  let stokluKalem = 0, msg2 = '';
  if (opt.acilis) {
    const liste = idler.filter(o => o.x.miktar > 0).map(o => ({ kart: o.id, mik: o.x.miktar, bm: o.x.fiyat > 0 ? o.x.fiyat : NaN }));
    if (liste.length) { const r = alisKaydet(opt.tarih || bugun(), liste, `Açılış stoğu (içe aktarma${opt.dosya ? ': ' + opt.dosya : ''})`); if (r.ok) { stokluKalem = liste.length; if (liste.some(l => !(l.bm > 0))) msg2 = ' Fiyatı olmayan kalemler maliyetsiz kaldı (Panel\'de uyarı çıkar).'; } else msg2 = ' Açılış stoğu yazılamadı: ' + r.msg; }
  }
  logYaz('KART', `Excel/CSV içe aktarma: ${idler.length} kart eklendi${stokluKalem ? `, ${stokluKalem} kaleme açılış stoğu` : ''}${opt.dosya ? ' — ' + opt.dosya : ''}`); degisti();
  return { ok: true, kart: idler.length, stok: stokluKalem, hata, msg: `${idler.length} kart eklendi` + (stokluKalem ? `, ${stokluKalem} kaleme açılış stoğu girildi.` : '.') + msg2 };
}
// ============================ İÇE AKTARMA BİTİŞ ============================
