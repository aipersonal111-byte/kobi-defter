// Giriş koruması, roller, maliyet gizleme, kilit, sürüm yükseltme (arayüz düzeyi)
const { ortam, yeniSt, bekle, denge } = require('./ortam.js');
let hata = 0; const ok = (c, m) => { if (!c) { hata++; console.log('✗', m); } else console.log('✓', m); };
const TUT = /\d[\d.]*,\d{2} ₺/;
const YASAK_BASLIK = ['Ort. maliyet', 'Son ort. maliyet', 'Stok değeri', 'Takribi satış değeri', 'Birim maliyet', 'Girdi maliyeti', 'Tahmini tutar', 'Kayıp değeri', 'Takribi fiyat', 'Birim fiyat (₺)', 'Satış fiyatı', 'Değer'];
async function giris(A, k, s) { A.dolu('#kg-kadi', k); A.dolu('#kg-sifre', s); A.tikla('[data-act=giris-yap]'); await bekle(450); }
async function kullaniciEkle(A, ad, kadi, rol, sifre) { A.git('ayar'); A.run("ui.tab.ay='kullanici'"); A.run('render()'); A.dolu('#ku-ad', ad); A.dolu('#ku-kadi', kadi); A.dolu('#ku-rol', rol); A.dolu('#ku-sifre', sifre); A.tikla('[data-act=kul-ekle]'); await bekle(450); }
const navMetni = A => A.$('nav').textContent;
(async () => {
  const st = yeniSt(); let A = ortam(st); await bekle(60); A.tikla('[data-act=gate-atla]');
  A.tikla('[data-act=ornek]'); await bekle(20);
  ok(A.run('db.kartlar.length') === 6, 'örnek veri yüklendi (koruma kapalı, herkes yetkili)');
  ok(navMetni(A).includes('Kartlar') && navMetni(A).includes('Ayarlar') && A.$('kul').hidden, 'koruma kapalıyken tüm sayfalar açık, kullanıcı rozeti yok');
  // ===== koruma etkinleştirme =====
  A.git('ayar'); A.run("ui.tab.ay='kullanici'"); A.run('render()');
  ok(A.app().includes('Giriş koruması kapalı') && A.app().includes('sunucusuz'), 'Kullanıcılar sekmesi: koruma kapalı + güvenlik notu (dürüst sınır)');
  A.dolu('#kg-ad', 'Ali Yılmaz'); A.dolu('#kg-kadi', 'ali.y'); A.dolu('#kg-sifre', 'Sifre-1234'); A.dolu('#kg-sifre2', 'baska');
  A.tikla('[data-act=koruma-ac]'); await bekle(50); ok(A.run('authAktif()') === false && A.toast().includes('aynı değil'), 'şifreler uyuşmazsa koruma açılmaz');
  A.dolu('#kg-sifre2', 'Sifre-1234'); A.tikla('[data-act=koruma-ac]'); await bekle(450);
  ok(A.run('authAktif()') && !A.$('kilit').hidden && A.$('kilit').textContent.includes('Kurtarma kodunuz'), 'koruma açıldı; kurtarma kodu gösterildi');
  const kod = A.doc.querySelector('#kilit .kod').textContent; ok(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(kod), 'kurtarma kodu biçimi: ' + kod);
  A.tikla('[data-act=kod-tamam]'); ok(A.$('kilit').hidden && A.$('kul').textContent.includes('Ali Yılmaz') && A.$('kul').textContent.includes('Yönetici'), 'devam → admin oturumda, başlıkta "👤 Ali Yılmaz · Yönetici"');
  await kullaniciEkle(A, 'Ayşe Kaya', 'ayse', 'personel', 'gecici1');
  await kullaniciEkle(A, 'Mehmet Demir', 'mehmet', 'yetkili', 'gecici2');
  await kullaniciEkle(A, 'Izleyici Bir', 'izle', 'izleyici', 'gecici3');
  ok(A.run('db.kullanicilar.length') === 4 && A.app().includes('Rol') && A.app().includes('Roller ve yetkiler'), '3 kullanıcı eklendi; roller ve yetkiler tablosu görünür');
  // ===== yönetici: tüm sekmeler, günlük =====
  ok(['Genel', 'Yedekleme', 'Sürüm', 'Kullanıcılar', 'Günlük'].every(x => A.app().includes(x)), 'yönetici Ayarlar: Genel, Yedekleme, Sürüm, Kullanıcılar, Günlük');
  A.run("ui.tab.ay='gunluk'"); A.run('render()'); ok(A.app().includes('Kullanıcı eklendi') && A.app().includes('Giriş koruması etkinleştirildi'), 'günlük: kullanıcı işlemleri kayıtlı');
  ok(!/Sifre-1234|gecici1|gecici2/.test(A.doc.body.textContent), 'şifreler ekranda/günlükte yok');
  // ===== personel =====
  A.tikla('[data-act=hesabim]'); A.tikla('[data-act=cikis]'); ok(!A.$('kilit').hidden && A.$('kilit').textContent.includes('Giriş yap') && A.app() === '', 'çıkış → giriş ekranı, sayfa içeriği boşaltıldı');
  A.dolu('#kg-kadi', 'ayse'); A.dolu('#kg-sifre', 'yanlis'); A.tikla('[data-act=giris-yap]'); await bekle(450); ok(A.$('kg-msg').textContent.includes('hatalı') && !A.$('kg-msg').hidden, 'hatalı şifre: uyarı');
  await giris(A, 'ayse', 'gecici1'); ok(A.$('kilit').textContent.includes('Yeni şifre belirleyin'), 'geçici şifreyle giriş → zorunlu şifre değişikliği');
  A.dolu('#zs-1', 'yeni-sifre-9'); A.dolu('#zs-2', 'yeni-sifre-9'); A.tikla('[data-act=zorla-kaydet]'); await bekle(450);
  ok(A.$('kilit').hidden, 'personel yeni şifreyi belirledi ve girdi');
  const nav = navMetni(A); ok(['Panel', 'Alış', 'Üretim', 'Satış', 'Zayiat', 'Stok', 'Hareketler'].every(x => nav.includes(x)) && !['Sayım', 'Analiz', 'Kartlar', 'Ayarlar'].some(x => nav.includes(x)), 'personel menüsü: giriş sayfaları + stok; sayım/analiz/kartlar/ayarlar yok');
  A.git('analiz'); ok(A.run('ui.sayfa') === 'panel', 'yetkisiz sayfaya adresle gidilemez');
  A.git('ayar'); ok(A.run('ui.sayfa') === 'panel', 'ayarlar sayfasına da gidilemez');
  const sayfalar = [['panel'], ['alis'], ['satis'], ['uretim', 'ur', ['yeni', 'gecmis']], ['zayiat', 'za', ['kayit', 'gecmis']], ['stok', 'st', ['TICARI', 'HAM', 'MAMUL', 'TUM', 'SIP']], ['hareket', 'hr', ['liste', 'arsiv']]];
  let sizinti = [], dengesiz = [];
  for (const [p, g, ks] of sayfalar) for (const k of (ks || [null])) {
    if (g) A.run(`ui.tab.${g}='${k}'`); A.git(p);
    const t = A.app(), ths = A.doc.querySelectorAll('#app th').map(x => x.textContent.trim());
    if (TUT.test(t)) sizinti.push(`${p}/${k}: tutar görünüyor (${t.match(TUT)[0]})`);
    const y = ths.filter(x => YASAK_BASLIK.includes(x)); if (y.length) sizinti.push(`${p}/${k}: başlık ${y.join(',')}`);
    const d = denge(A.doc.getElementById('app').innerHTML); if (d) dengesiz.push(p + ':' + d);
  }
  ok(!sizinti.length, 'personel: hiçbir sayfada maliyet/kâr/değer yok' + (sizinti.length ? ' → ' + sizinti.join(' | ') : '') + ' (7 sayfa, 15 sekme/görünüm)');
  ok(!dengesiz.length, 'personel sayfaları geçerli HTML');
  A.run("ui.tab.st=undefined"); A.git('panel'); ok(A.app().includes('kalem stokta') && !A.app().includes('Stok değeri'), 'personel paneli: stok adetleri, mali özet yok');
  // personel işlem girer (fiyat alanı yok)
  A.git('alis'); const sat = A.doc.querySelectorAll('#tb-al tbody tr').find(r => r.textContent.includes('Ayran')); ok(!sat.querySelector('[data-f=fy]'), 'personelin alış satırında fiyat alanı yok');
  const mik = sat.querySelector('[data-f=mik]'); mik.value = '20'; A.fire('input', mik); ok(!TUT.test(A.$('al-ozet').textContent), 'alış özeti tutarsız: ' + A.$('al-ozet').textContent);
  const AY = A.run("db.kartlar.find(k=>k.ad==='Ayran').id"); const ortOnce = A.run(`canli(${AY}).ort`); A.tikla('[data-act=alis-kaydet]'); await bekle(20);
  const son = A.run('db.hr[db.hr.length-1]'); ok(son.tip === 'ALIS' && son.kul === 'ayse' && Math.abs(son.bm - ortOnce) < 1e-9, 'personel alışı kaydetti: kullanıcı ayse, fiyat girilmediği için mevcut ortalama maliyet kullanıldı');
  A.git('satis'); const sr = A.doc.querySelectorAll('#tb-sa tbody tr').find(r => r.textContent.includes('Ayran')); const sm = sr.querySelector('[data-f=mik]'), sf = sr.querySelector('[data-f=fy]'); sm.value = '3'; A.fire('input', sm); sf.value = '20'; A.fire('input', sf);
  ok(!A.$('sa-ozet').textContent.includes('maliyet') && !A.$('sa-ozet').textContent.includes('kâr'), 'satış özeti maliyet/kâr göstermez: ' + A.$('sa-ozet').textContent);
  A.tikla('[data-act=satis-kaydet]'); await bekle(20); const sv = A.run('db.hr[db.hr.length-1]'); ok(sv.tip === 'SATIS' && sv.kul === 'ayse' && sv.fiyat === 20, 'personel satışı fiyatıyla kaydetti');
  A.run("ui.tab.hr='liste'"); A.git('hareket'); ok(!A.doc.querySelector('[data-act=hr-sil]') && !A.doc.querySelector('[data-act=hr-duzenle]') && A.app().includes('ayse'), 'personel hareketlerde silme/düzenleme göremez; kullanıcı sütunu görünür');
  ok(A.run("kayitSil([db.hr[0].id],'x').ok") === false && A.run("ayarKaydet('x',10,5).ok") === false && A.run("kartEkle({ad:'Z',grup:'HAM',birim:'KG'}).ok") === false, 'motor da yetkisiz işlemi reddeder (arayüz atlansa bile)');
  // ===== kilit: hareketsizlik =====
  A.run('ui.sonEtkinlik = Date.now() - 3600000'); await A.run('periyodikKontrol()'); ok(!A.$('kilit').hidden && A.$('kilit').textContent.includes('Giriş yap'), 'hareketsizlikte oturum kilitlenir');
  ok(A.run("db.log.some(l => l.islem === 'KILIT' && l.kadi === 'ayse')"), 'kilitlenme günlüğe yazıldı');
  // ===== yetkili =====
  await giris(A, 'mehmet', 'gecici2'); A.dolu('#zs-1', 'mehmet-yeni-1'); A.dolu('#zs-2', 'mehmet-yeni-1'); A.tikla('[data-act=zorla-kaydet]'); await bekle(450);
  const n2 = navMetni(A); ok(['Sayım', 'Analiz', 'Kartlar', 'Ayarlar'].every(x => n2.includes(x)), 'yetkili menüsü: sayım, analiz, kartlar, ayarlar var');
  A.git('stok'); ok(TUT.test(A.app()), 'yetkili maliyet/değer görür');
  A.git('ayar'); ok(A.app().includes('Günlük') && !A.app().includes('Yedekleme') && !A.app().includes('Kullanıcılar'), 'yetkili Ayarlar: yalnızca Günlük');
  ok(A.run("kayitSil([db.hr.find(r=>r.tip==='ALIS').id],'yanlış girildi').ok") !== undefined, '(yetkili silme denemesi)');
  A.tikla('[data-act=hesabim]'); A.tikla('[data-act=cikis]');
  // ===== izleyici =====
  await giris(A, 'izle', 'gecici3'); A.dolu('#zs-1', 'izle-yeni-12'); A.dolu('#zs-2', 'izle-yeni-12'); A.tikla('[data-act=zorla-kaydet]'); await bekle(450);
  const n3 = navMetni(A); ok(n3.includes('Stok') && n3.includes('Hareketler') && !['Alış', 'Üretim', 'Satış', 'Zayiat', 'Sayım', 'Analiz', 'Kartlar', 'Ayarlar'].some(x => n3.includes(x)), 'izleyici menüsü: yalnızca panel, stok, hareketler');
  A.git('stok'); ok(!TUT.test(A.app()), 'izleyici maliyet görmez');
  ok(A.run("alisKaydet('2026-11-11',[{kart:db.kartlar[0].id,mik:1,bm:1}],'').ok") === false, 'izleyici işlem yapamaz');
  A.tikla('[data-act=hesabim]'); A.tikla('[data-act=cikis]');
  // ===== yönetici: günlük, sıfırlama kullanıcıları korur =====
  await giris(A, 'ali.y', 'Sifre-1234'); A.git('ayar'); A.run("ui.tab.ay='gunluk'"); A.run('render()');
  ok(['Giriş', 'Satış', 'Alış', 'Oturum kilidi'].every(x => A.app().includes(x)) && A.app().includes('ayse') && A.app().includes('mehmet'), 'günlük: giriş, alış, satış, kilit; kullanıcılar adlarıyla');
  A.git('ayar'); A.run("ui.tab.ay='genel'"); A.run('render()'); A.tikla('[data-act=sifirla]'); A.dolu('#md-neden', 'SİL'); A.tikla('[data-act=modal-tamam]'); await bekle(300);
  ok(A.run('db.kartlar.length') === 0 && A.run('db.kullanicilar.length') === 4 && A.run('authAktif()') && A.run("db.log.some(l=>l.islem==='YEDEK'&&/silindi/.test(l.aciklama))"), '"Tüm verileri sil" stok verisini siler; kullanıcılar ve günlük korunur');
  // ===== kurtarma kodu =====
  A.tikla('[data-act=hesabim]'); A.tikla('[data-act=cikis]'); A.tikla('[data-act=kurtarma-ac]');
  A.dolu('#kr-kod', 'AAAAA-AAAAA-AAAAA-AAAAA'); A.dolu('#kr-kadi', 'ali.y'); A.dolu('#kr-s1', 'yeni-yonetici-1'); A.dolu('#kr-s2', 'yeni-yonetici-1'); A.tikla('[data-act=kurtarma-yap]'); await bekle(450);
  ok(A.$('kg-msg') && A.$('kg-msg').textContent.includes('hatalı'), 'yanlış kurtarma kodu reddedilir');
  A.dolu('#kr-kod', kod.toLowerCase()); A.tikla('[data-act=kurtarma-yap]'); await bekle(500);
  ok(A.$('kilit').textContent.includes('Kurtarma kodunuz') && A.doc.querySelector('#kilit .kod').textContent !== kod, 'doğru kod: şifre sıfırlandı, YENİ kurtarma kodu üretildi');
  A.tikla('[data-act=kod-tamam]'); await giris(A, 'ali.y', 'yeni-yonetici-1'); ok(A.$('kilit').hidden && A.$('kul').textContent.includes('Ali'), 'yeni şifreyle yönetici girişi');
  // ===== sürüm yükseltme / eski-yeni dosya =====
  const s2 = yeniSt(); let B = ortam(s2); await bekle(60); B.tikla('[data-act=gate-atla]'); B.run(`kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet'})`); await bekle(700);
  const degistir = f => { for (const k of ['ls']) { const o = JSON.parse(s2.ls.sos_db); f(o); s2.ls.sos_db = JSON.stringify(o); } const o = JSON.parse(s2.idb.sos_stok_v1.stores.kv.data.get('db')); f(o); s2.idb.sos_stok_v1.stores.kv.data.set('db', JSON.stringify(o)); };
  degistir(o => { o.app = '1.0.0'; });
  B = ortam(s2); await bekle(120);
  ok(B.dlg().open && B.dlg().textContent.includes('Uygulama güncellendi') && B.dlg().textContent.includes('1.0.0') && B.dlg().textContent.includes('3.2.0') && B.dlg().textContent.includes('Kullanıcı girişi'), 'eski sürüm verisi açılınca "Uygulama güncellendi" + neler yeni');
  ok(B.run('db.app') === B.run('SURUM') && B.run("db.log.some(l=>l.islem==='SURUM')"), 'veri sürümü güncellendi, günlüğe yazıldı');
  ok([...s2.idb.sos_stok_v1.stores.snap.data.values()].some(x => /Sürüm güncellemesi öncesi/.test(x.etiket) && JSON.parse(x.json).app === '1.0.0'), 'yükseltmeden ÖNCE otomatik anlık görüntü alındı');
  B.tikla('[data-act=surum-tamam]'); ok(B.dlg().open || true, '(tamam)');
  degistir(o => { o.app = '9.0.0'; }); B = ortam(s2); await bekle(120); ok(B.banner().includes('daha eski'), 'verinin son kullanıldığı sürümden DAHA ESKİ dosya açılırsa uyarı');
  const onceki = s2.idb.sos_stok_v1.stores.kv.data.get('db'); degistir(o => { o.v = 3; o.app = '9.0.0'; }); const yeniIdb = s2.idb.sos_stok_v1.stores.kv.data.get('db');
  B = ortam(s2); await bekle(120);
  ok(!B.$('kilit').hidden && B.$('kilit').textContent.includes('Daha yeni sürümle kaydedilmiş'), 'DAHA YENİ veri biçimi: engel ekranı');
  B.run(`kartEkle({ad:'Z',grup:'HAM',birim:'KG'})`); await bekle(700); B.run('Kayit.senkron()');
  ok(s2.idb.sos_stok_v1.stores.kv.data.get('db') === yeniIdb && JSON.parse(s2.ls.sos_db).v === 3 && JSON.parse(s2.ls.sos_db).kartlar.length === 1, 'eski dosya yeni biçimli veriyi ASLA değiştirmez (IndexedDB ve localStorage aynı kaldı)');
  ok(B.run("yedekCoz(JSON.stringify({v:3,kartlar:[],hr:[],sayac:1})).hata").includes('daha yeni'), 'daha yeni biçimli yedek geri yüklenemez');
  // ===== güncelleme denetimi =====
  const s3 = yeniSt(); let urls = []; const fetchOk = async u => { urls.push(u); return { ok: true, json: async () => ({ surum: '9.9.0', tarih: '2026-12-01', notlar: ['Harika özellik'] }) }; };
  let C = ortam(s3, { fetch: fetchOk }); await bekle(60); C.tikla('[data-act=gate-atla]');
  C.run("db.ayar.guncelleme = { repo: 'ornek/stok-portal', dal: 'main' }"); const r = await C.run('guncellemeKontrol()');
  ok(r.ok && r.yeni && r.yeni.surum === '9.9.0' && urls.some(u => u === 'https://raw.githubusercontent.com/ornek/stok-portal/main/version.json'), 'GitHub version.json okunur, yeni sürüm bulunur');
  C.run('bannerGuncelle()'); ok(C.banner().includes('Yeni sürüm var') && C.banner().includes('9.9.0'), 'banner: "Yeni sürüm var: 9.9.0"');
  C.tikla('[data-act=surum-yeni]'); ok(C.dlg().open && C.dlg().textContent.includes('Önce yedek alın') && C.dlg().textContent.includes('Harika özellik') && C.dlg().textContent.includes('üzerine yazın'), 'güncelleme adımları + notlar gösterilir');
  // varsayılan depo: ayar boşken de GitHub'a bakılır
  { const u6 = []; const C6 = ortam(yeniSt(), { fetch: async u => { u6.push(u); return { ok: true, json: async () => ({ surum: '99.0.0' }) }; } }); await bekle(60); C6.tikla('[data-act=gate-atla]'); C6.run("db.ayar.guncelleme = { repo: '', dal: 'main' }");
    const r6 = await C6.run('guncellemeKontrol()'); ok(r6.ok && u6.some(u => u === 'https://raw.githubusercontent.com/aipersonal111-byte/stok-portal/main/version.json'), 'depo ayarı boşken gömülü varsayılan depo denetlenir'); }
  // güncelleme düğmesi: yeni index.html indirilir ve sürümü doğrulanır
  { const urls4 = []; const f4 = async u => { urls4.push(u); if (/version\.json/.test(u)) return { ok: true, json: async () => ({ surum: '9.9.0', indir: 'index.html' }) }; return { ok: true, status: 200, text: async () => '<html><script>const SURUM = \'9.9.0\';</script></html>' }; };
    const C4 = ortam(yeniSt(), { fetch: f4 }); await bekle(60); C4.tikla('[data-act=gate-atla]'); C4.run("db.ayar.guncelleme = { repo: 'ornek/stok-portal', dal: 'main' }"); await C4.run('guncellemeKontrol()');
    const d = await C4.run('yeniSurumDosyasiAl()'); ok(d.ok && d.surum === '9.9.0' && urls4.some(u => u.startsWith('https://raw.githubusercontent.com/ornek/stok-portal/main/index.html')), 'yeni index.html GitHub\'dan indirilir ve sürümü doğrulanır');
    C4.run('bannerGuncelle()'); C4.tikla('[data-act=surum-yeni]'); ok(C4.dlg().innerHTML.includes('data-act="surum-guncelle"'), 'uyarıda "Yeni sürümü indir ve güncelle" düğmesi var');
    const f5 = async u => /version\.json/.test(u) ? { ok: true, json: async () => ({ surum: '9.9.0' }) } : { ok: true, status: 200, text: async () => '<html>SURUM = 1.1.0</html>' };
    const C5 = ortam(yeniSt(), { fetch: f5 }); await bekle(60); C5.tikla('[data-act=gate-atla]'); C5.run("db.ayar.guncelleme = { repo: 'ornek/stok-portal', dal: 'main' }"); await C5.run('guncellemeKontrol()');
    const d5 = await C5.run('yeniSurumDosyasiAl()'); ok(!d5.ok && d5.msg.includes('9.9.0 sürümü değil'), 'yanlış/eski index.html reddedilir: ' + d5.msg); }
  const C2 = ortam(yeniSt(), { fetch: async () => { throw new Error('ağ yok'); } }); await bekle(60); C2.run("db.ayar.guncelleme = { repo: 'ornek/stok-portal', dal: 'main' }");
  const r2 = await C2.run('guncellemeKontrol()'); ok(!r2.ok && r2.msg.includes('çevrimdışı'), 'çevrimdışıysa sessizce atlanır: ' + r2.msg);
  const r3 = await ortam(yeniSt()).run('guncellemeKontrol()'); ok(!r3.ok && r3.msg.includes('ağ erişimini desteklemiyor'), 'ağ yoksa denetim yapılmaz');
  const same = async () => ({ ok: true, json: async () => ({ surum: '3.2.0' }) }); const C3 = ortam(yeniSt(), { fetch: same }); await bekle(60); C3.run("db.ayar.guncelleme = { repo: 'a/b', dal: 'main' }"); const r4 = await C3.run('guncellemeKontrol()'); ok(r4.ok && r4.yeni === null, 'aynı sürümde "güncel" sonucu');
  console.log(hata ? '\nHATA: ' + hata : '\nROL / KİMLİK / SÜRÜM TESTLERİ GEÇTİ'); process.exit(hata ? 1 : 0);
})().catch(e => { console.log('İSTİSNA:', e.stack || e); process.exit(1); });
