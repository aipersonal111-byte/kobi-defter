// Yedek konumu: seçim, anlık yazma, kayıp/izin/hata algılama, tarayıcıda tutma + uyarılar, tek dosya modu, desteklenmeyen tarayıcı
const { ortam, yeniSt, bekle } = require('./ortam.js');
let hata = 0; const ok = (c, m) => { if (!c) { hata++; console.log('✗', m); } else console.log('✓', m); };
const idbDb = st => JSON.parse(st.idb.sos_stok_v1.stores.kv.data.get('db'));
(async () => {
  // ===== 1) Hiç konum seçilmemiş: uyarı + seçim penceresi =====
  const st = yeniSt(); let A = ortam(st); await bekle(60);
  ok(A.run('Kayit.yedekDurumu().kod') === 'yok', 'konum seçilmemiş → durum "yok"');
  ok(A.dlg().open && A.dlg().textContent.includes('Yedek konumu seçin') && A.dlg().textContent.includes('her değişiklik anında'), 'açılışta yedek konumu seçim penceresi çıktı');
  ok(!!A.doc.querySelector('[data-act=klasor-sec]') && !!A.doc.querySelector('[data-act=dosya-sec]') && !!A.doc.querySelector('[data-act=gate-atla]'), 'pencerede: klasör seç, tek dosya seç, şimdilik tarayıcıda tut');
  ok(A.banner().includes('Yedek konumu seçilmedi') && A.banner().includes('yalnızca bu tarayıcıda'), 'banner: seçilmedi + veriler yalnızca tarayıcıda');
  A.tikla('[data-act=gate-atla]'); ok(!A.dlg().open && A.toast().includes('yalnızca bu tarayıcıda'), '"Şimdilik tarayıcıda tut" → pencere kapanır, uyarı verilir');
  ok(st.ss.sos_gate === '1', 'pencere oturum başına bir kez gösterilir');
  A.run(`kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet'}); alisKaydet('2026-11-10',[{kart:1,mik:100,bm:9}],'f1')`); await bekle(700);
  ok(idbDb(st).hr.length === 1, 'konum yokken veri tarayıcıda (IndexedDB) tutuluyor');
  ok(A.run('Kayit.yedekDurumu().seviye') === 'hata' && A.run('Kayit.yedeksizKapanis()') === true, 'veri var + konum yok → yedeksiz kapanışta onay istenecek');
  ok(A.$('kayit-durum').textContent.includes('yedek yok') && A.$('kayit-durum').className.includes('er'), 'üst çubuk: "⚠ yedek yok" kırmızı');
  await A.run('periyodikKontrol()'); ok(A.toast().includes('yedek konumuna yazılmıyor'), 'periyodik hatırlatma: yedek alın uyarısı');
  A.git('ayar'); A.tikla('[data-act=sekme][data-k=yedek]'); ok(A.app().includes('YALNIZCA')||A.app().includes('Yedek konumu seçilmedi'), 'Ayarlar → Yedekleme sekmesinde uyarı kutusu');
  // ===== 2) Klasör seç → anlık yazma =====
  A.tikla('[data-act=klasor-sec]'); await bekle(300);
  ok(A.run('Klasor.durum') === 'tamam' && A.run('Klasor.tur') === 'klasor', 'klasör seçildi (tur=klasor)');
  ok(st.dir.files.has('stok_portal_guncel.json') && JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).hr.length === 1, 'seçilir seçilmez güncel yedek yazıldı');
  ok(A.run('Kayit.yedekDurumu().kod') === 'tamam' && !A.banner().includes('Yedek konumu seçilmedi'), 'uyarı kalktı');
  ok(A.$('kayit-durum').textContent.includes('yedek ✓') && A.$('kayit-durum').className.includes('ok'), 'üst çubuk: "📁 yedek ✓"');
  A.run(`satisKaydet('2026-11-10',[{kart:1,mik:10,fiyat:12}],'')`); await bekle(700);
  ok(JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).hr.length === 2, 'her değişiklik anında klasöre yazılıyor');
  ok(A.run('Kayit.kirli') === false && A.run('Kayit.yedeksizKapanis()') === false, 'yedekli → kapanışta onay istenmez');
  // ===== 3) Klasör kayboldu =====
  st.dir.gone = true;
  A.run(`kartEkle({ad:'Su',grup:'TICARI',birim:'Adet'})`); await bekle(700);
  ok(A.run('Klasor.durum') === 'kayip', 'klasör silindi/taşındı → durum "kayip" (bulunamadı)');
  ok(idbDb(st).kartlar.length === 2, 'konum kayıpken veri tarayıcıda tutulmaya devam ediyor');
  ok(A.banner().includes('Yedek konumu bulunamadı') && A.banner().includes('yedek alınmıyor') && !!A.doc.querySelector('#banner [data-act=yedek-indir]'), 'banner: bulunamadı + yedek alınmıyor + "Yedeği indir" düğmesi');
  ok(A.$('kayit-durum').textContent.includes('yedek konumu yok'), 'üst çubuk: yedek konumu yok');
  ok(A.run('Kayit.yedeksizKapanis()') === true, 'kayıpken değişiklik var → kapanışta onay istenecek');
  A.run(`ACT['yedek-indir']()`); ok(A.run('Kayit.sonIndirme') > 0 && A.run('Kayit.yedeksizKapanis()') === false, 'yedek indirilince kapanış uyarısı kalkar');
  ok(A.run('Kayit.yedekDurumu().kod') === 'kayip' && A.banner().includes('bulunamadı'), 'ama konum sorunu bandı sürer (kalıcı çözüm için)');
  ok(A.banner().includes('Son elle indirilen yedek'), 'banner son indirme zamanını gösterir');
  // ===== 4) Periyodik: yeniden bağlanma =====
  st.dir.gone = false; await A.run('periyodikKontrol()'); await bekle(100);
  ok(A.run('Klasor.durum') === 'tamam' && JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).kartlar.length === 2, 'konum geri gelince otomatik yeniden bağlanıldı ve güncel yedek yazıldı');
  ok(A.toast().includes('yeniden bağlanıldı') && !A.banner().includes('bulunamadı'), 'bildirim verildi, uyarı kalktı');
  // erişim kaybı: periyodik kontrolde yakalanır (yazma beklemeden)
  st.dir.gone = true; await A.run('periyodikKontrol()');
  ok(A.run('Klasor.durum') === 'kayip' && A.toast().includes('artık erişilemiyor'), 'periyodik kontrol konum kaybını yazma beklemeden yakalar');
  st.dir.gone = false; await A.run('periyodikKontrol()'); await bekle(50);
  // ===== 5) Yeniden açılışta konum yok =====
  st.dir.gone = true; delete st.ss.sos_gate; A = ortam(st); await bekle(80);
  ok(A.run('Klasor.durum') === 'kayip', 'yeniden açılışta kayıp konum algılandı');
  ok(A.dlg().open && A.dlg().textContent.includes('Yedek konumu bulunamadı') && A.dlg().textContent.includes('yalnızca bu tarayıcıda'), 'açılış penceresi: "Yedek konumu bulunamadı"');
  ok(A.run('db.kartlar.length') === 2, 'veri tarayıcıdan sorunsuz yüklendi');
  A.tikla('[data-act=klasor-sec]'); await bekle(400); st.dir.gone = false;
  // ===== 6) İzin düştü =====
  st.dir.gone = false; st.dir.setPerm('prompt'); delete st.ss.sos_gate; A = ortam(st); await bekle(80);
  ok(A.run('Klasor.durum') === 'izin' && A.banner().includes('izni gerekiyor') && !!A.doc.querySelector('#banner [data-act=klasor-izin]'), 'izin düştü → "izin ver" düğmeli uyarı');
  A.run(`kartEkle({ad:'Kola',grup:'TICARI',birim:'Adet'})`); await bekle(700);
  ok(idbDb(st).kartlar.length === 3, 'izin yokken de tarayıcı kaydı yazılıyor');
  A.tikla('#banner [data-act=klasor-izin]'); await bekle(300); ok(A.run('Klasor.durum') === 'tamam' && JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).kartlar.length === 3, 'izin verilince yedek hemen güncellendi');
  // yazma hatası
  st.dir.fail = 'NoModificationAllowedError'; A.run(`kartEkle({ad:'Çay',grup:'TICARI',birim:'Adet'})`); await bekle(700);
  ok(A.run('Klasor.durum') === 'hata' && A.banner().includes('yazılamadı'), 'başka yazma hatası → "yazılamadı" uyarısı, veri tarayıcıda');
  st.dir.fail = null;
  // ===== 7) Tek dosya modu =====
  const st2 = yeniSt(); let B = ortam(st2); await bekle(60); B.tikla('[data-act=gate-atla]');
  B.run(`kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet'})`); await bekle(500);
  B.run(`ACT['dosya-sec']()`); await bekle(300);
  ok(B.run('Klasor.tur') === 'dosya' && B.run('Klasor.durum') === 'tamam' && JSON.parse(st2.file.f.text).kartlar.length === 1, 'tek yedek dosyası seçildi ve hemen yazıldı');
  B.run(`alisKaydet('2026-11-10',[{kart:1,mik:50,bm:9}],'')`); await bekle(700);
  ok(JSON.parse(st2.file.f.text).hr.length === 1 && !B.banner().includes('seçilmedi'), 'dosya modunda her değişiklik dosyaya yazılıyor');
  ok(B.$('kayit-durum').textContent.includes('📄'), 'üst çubuk dosya simgesi');
  st2.file.gone = true; B.run(`alisKaydet('2026-11-11',[{kart:1,mik:5,bm:9}],'')`); await bekle(700);
  ok(B.run('Klasor.durum') === 'kayip' && B.banner().includes('bulunamadı'), 'seçilen yedek dosyası silinince uyarı');
  st2.file.gone = false; await B.run('periyodikKontrol()'); await bekle(100);
  ok(B.run('Klasor.durum') === 'tamam' && JSON.parse(st2.file.f.text).hr.length === 2, 'dosya geri gelince yeniden bağlanıldı ve güncel yazıldı');
  const B2 = ortam(st2); await bekle(80); ok(B2.run('Klasor.tur') === 'dosya' && B2.run('Klasor.ad') === 'yedek.json' && B2.run('Klasor.durum') === 'tamam', 'yeniden açılışta dosya tutamacı hatırlandı');
  const ls = await B2.run('Klasor.listele()'); ok(ls.length === 1 && ls[0].ad === 'yedek.json', 'dosya modunda yedek listesi');
  // ===== 8) Chrome/Edge dışı tarayıcı =====
  const st3 = yeniSt(); const C = ortam(st3, { noPicker: true }); await bekle(60);
  C.run(`kartEkle({ad:'X',grup:'HAM',birim:'KG'})`); await bekle(500);
  ok(C.run('Kayit.yedekDurumu().kod') === 'desteklenmiyor' && C.banner().includes('Chrome veya Edge') && C.banner().includes('yedeği indirin'), 'seçici yoksa: Chrome/Edge uyarısı ve yedeği indir yönlendirmesi');
  await bekle(300); const C2 = ortam(st3, { noPicker: true }); await bekle(80);
  ok(C2.dlg().open && C2.dlg().textContent.includes('Yedek alınamıyor'), 'veri varken açılış penceresi desteklenmeyen tarayıcıyı da uyarır');
  ok(!C2.doc.querySelector('[data-act=klasor-sec]'), 'desteklenmiyorsa seçim düğmesi gösterilmez');
  console.log(hata ? '\nHATA: ' + hata : '\nYEDEK KONUMU TESTLERİ GEÇTİ'); process.exit(hata ? 1 : 0);
})().catch(e => { console.log('İSTİSNA:', e.stack || e); process.exit(1); });
