// İçe aktarma: xlsx/csv okuma, akıllı sütun tanıma, önizleme, kart + açılış stoğu
const fs = require('fs'), path = require('path');
const { ortam, yeniSt, bekle } = require('./ortam.js');
let hata = 0; const ok = (c, m) => { if (!c) { hata++; console.log('✗', m); } else console.log('✓', m); };
(async () => {
  const st = yeniSt(); const C = ortam(st, { extra: { DecompressionStream, Response, TextDecoder } }); await bekle(60); C.tikla('[data-act=gate-atla]');
  const fx = a => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', a)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  const COZ = 'aktSatirlariCoz(__rows, sutunTani(__rows).baslik, sutunTani(__rows).esleme, "TICARI")';
  // ---- gerçekçi, dağınık xlsx: başlık 4. satırda, "Ürün Grubu" gerçekte grup, Türkçe sayılar ----
  C.ctx.__buf = fx('stok_listesi.xlsx');
  const rows = await C.run('xlsxOku(__buf)');
  ok(rows.length >= 11 && rows.some(r => r.includes('Dana But')), 'xlsx okunur (' + rows.length + ' satır)');
  C.ctx.__rows = rows; const t = C.run('sutunTani(__rows)'), e = t.esleme;
  ok(t.baslik === 3, 'başlık satırı 4. satırda bulundu (' + t.baslik + ')');
  ok(e.ad === 1 && e.grup === 2 && e.kat === 3 && e.birim === 4 && e.miktar === 5 && e.fiyat === 6 && e.asgari === 7, 'sütunlar tanındı: ' + JSON.stringify(e));
  const s = C.run(COZ), by = ad => s.find(x => x.ad === ad);
  ok(s.length === 6 && !s.some(x => /toplam/i.test(x.ad)), 'boş ve TOPLAM satırı atlandı (' + s.length + ' kalem)');
  ok(by('Dana But').grup === 'HAM' && by('Dana But').birim === 'KG' && by('Dana But').miktar === 125.5 && by('Dana But').asgari === 50 && by('Dana But').kat === 'Kırmızı Et', 'Dana But: Hammadde→HAM, Kilogram→KG, sayılar, kategori');
  ok(by('Et Döner').grup === 'MAMUL' && !isFinite(by('Et Döner').fiyat), 'Mamül grubu; boş fiyat boş kalır');
  ok(by('Kola 330 ml').grup === 'TICARI' && by('Kola 330 ml').birim === 'Adet', '"Ticari Mal"→TICARI, adet→Adet');
  ok(by('Un').fiyat === 1250.75 && by('Un').birim === 'Çuval', 'Türkçe sayı "1.250,75" okunur; bilinmeyen birim korunur');
  // ---- uygula ----
  const r = C.run(`aktarUygula(${COZ}, { acilis: true, tarih: "2026-11-21", dosya: "stok_listesi.xlsx" })`);
  ok(r.ok && r.kart === 6 && r.stok === 6, 'aktarıldı: ' + r.msg);
  ok(C.run('db.kartlar.length') === 6 && C.run('db.hr.filter(h=>h.tip==="ALIS").length') === 6, '6 kart, 6 açılış alış satırı');
  ok(Math.abs(C.run('canli(db.kartlar.find(k=>k.ad==="Dana But").id).net') - 125.5) < 1e-9 && Math.abs(C.run('canli(db.kartlar.find(k=>k.ad==="Dana But").id).ort') - 420) < 1e-9, 'Dana But stok 125,5 kg, maliyet 420 ₺');
  ok(C.run('db.log.filter(l=>l.islem==="KART" && /içe aktarma/.test(l.aciklama)).length') === 1, 'tek günlük kaydı düştü');
  const s2 = C.run(COZ);
  ok(s2.every(x => x.durum === 'var'), 'aynı dosya tekrar yüklenirse kartlar "zaten var" sayılır, çift kayıt olmaz');
  ok(C.run(`aktarUygula(${COZ}, {acilis:true})`).ok === false, 'yeni kart yoksa aktarım yapılmaz');
  // ---- başlıksız xlsx ----
  C.ctx.__b2 = fx('basliksiz.xlsx'); C.ctx.__r2 = await C.run('xlsxOku(__b2)'); const t2 = C.run('sutunTani(__r2)');
  ok(t2.baslik === -1 && t2.tahmin && t2.esleme.ad === 0 && t2.esleme.miktar === 1 && t2.esleme.birim === 2, 'başlıksız dosyada içerikten tahmin: ' + JSON.stringify(t2.esleme));
  // ---- CSV: noktalı virgül, TR sayılar, UTF-8, tırnaklı ----
  C.ctx.__csv = 'Ürün;Kategori;Birim;Stok;Maliyet\r\n"Süt, tam yağlı";Süt ürünleri;Litre;"1.500,5";32,5\r\nPeynir;Süt ürünleri;kg;12;210\r\n';
  C.ctx.__cr = C.run('csvOku(__csv)'); const ct = C.run('sutunTani(__cr)');
  ok(C.ctx.__cr.length === 3 && C.ctx.__cr[1][0] === 'Süt, tam yağlı' && ct.esleme.ad === 0 && ct.esleme.kat === 1 && ct.esleme.birim === 2 && ct.esleme.miktar === 3 && ct.esleme.fiyat === 4, 'CSV: ayraç/tırnak/sütunlar: ' + JSON.stringify(ct.esleme));
  const cs = C.run('aktSatirlariCoz(__cr, sutunTani(__cr).baslik, sutunTani(__cr).esleme, "HAM")');
  ok(cs[0].miktar === 1500.5 && cs[0].fiyat === 32.5 && cs[0].grup === 'HAM', 'CSV sayıları: 1.500,5 → 1500,5');
  // ---- virgül ayraçlı + İngilizce başlık ----
  C.ctx.__csv2 = 'Product Name,Category,Unit,Qty,Cost\nApple,Fruit,kg,10,5.5\n'; C.ctx.__c2 = C.run('csvOku(__csv2)'); const t3 = C.run('sutunTani(__c2)');
  ok(t3.esleme.ad === 0 && t3.esleme.birim === 2 && t3.esleme.miktar === 3 && t3.esleme.fiyat === 4, 'İngilizce başlıklar tanınır');
  // ---- arayüz ----
  C.git('kartlar'); ok(C.app().includes('Excel / CSV'), 'Kartlar sayfasında içe aktarma düğmesi var');
  C.run('ui.aktar = { ad: "t.csv", rows: __cr, baslik: 0, esleme: sutunTani(__cr).esleme, tahmin: false, sutunlar: sutunTani(__cr).sutunlar, gen: 5, varsGrup: "HAM", acilis: true, tarih: "2026-11-21" }; aktarModal()');
  ok(C.dlg().open && C.dlg().textContent.includes('Sütun eşleme') && C.dlg().textContent.includes('Süt, tam yağlı') && C.dlg().textContent.includes('2 yeni kart'), 'önizleme açılır, satırlar ve sayılar görünür');
  C.tikla('[data-act=aktar-uygula]'); ok(C.run('db.kartlar.some(k=>k.ad==="Süt, tam yağlı")') && !C.dlg().open, 'arayüzden içe aktarma: kart eklendi, pencere kapandı');
  console.log(hata ? '\nİÇE AKTARMA TESTLERİ BAŞARISIZ: ' + hata : '\nİÇE AKTARMA TESTLERİ GEÇTİ'); process.exit(hata ? 1 : 0);
})().catch(e => { console.log('İSTİSNA:', e.stack || e); process.exit(1); });
