const fs=require('fs'), vm=require('vm'), path=require('path'), nodeCrypto=require('crypto');
const kok=path.join(__dirname,'..','src');
const src=['surum.js','motor.js','kimlik.js'].map(f=>fs.readFileSync(path.join(kok,f),'utf8')).join('\n');
const ss={}; 
const ctx={console,Intl,Date,Math,Number,String,Array,Map,Set,JSON,isFinite,Object,Promise,Uint8Array,Uint32Array,DataView,TextEncoder,btoa,atob,crypto:nodeCrypto.webcrypto,
  sessionStorage:{getItem:k=>ss[k]||null,setItem:(k,v)=>{ss[k]=v;},removeItem:k=>{delete ss[k];}}};
vm.createContext(ctx);
vm.runInContext(src+`;globalThis.T={get db(){return db},set db(v){db=v},get oturum(){return oturum},set oturum(v){oturum=v},
 sha256,pbkdf2Js,pbkdf2,sifreKaydi,sifreDogru,korumayiEtkinlestir,korumayiAc,korumayiKapat,girisYap,cikisYap,kullaniciEkle,kullaniciGuncelle,sifreSifirla,sifreDegistir,sifreBelirle,kurtarmaIleSifirla,
 oturumGeriYukle,oturumTazele,izin,authAktif,kartEkle,alisKaydet,satisKaydet,kayitSil,kayitDuzenle,sayimKaydet,uretimKaydet,ayarKaydet,dogrula,bosDb,canli,denemeler,kodTemiz,
 logYaz,DB_SEMA,surumKarsilastir,SURUM,ROLLER,LOG_MAX};`,ctx);
const T=ctx.T; let hata=0; const ok=(c,m)=>{ if(!c){hata++; console.log('✗',m);} else console.log('✓',m); };
(async()=>{
  // --- kripto: yedek SHA-256 / PBKDF2 gerçek kripto ile aynı sonucu vermeli ---
  const enc=s=>new TextEncoder().encode(s);
  for(const s of ['','abc','a'.repeat(55),'a'.repeat(56),'a'.repeat(64),'a'.repeat(119),'Türkçe şifre ğüşiöç']){
    const a=Buffer.from(T.sha256(enc(s))).toString('hex'), b=nodeCrypto.createHash('sha256').update(Buffer.from(enc(s))).digest('hex'); if(a!==b){hata++;console.log('✗ sha256 farklı:',s.length);}
  } console.log('✓ yedek SHA-256 gerçek kriptoyla aynı (sınır uzunlukları dahil)');
  const tuz=Uint8Array.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
  const pj=Buffer.from(T.pbkdf2Js('şifre123',tuz,3000)).toString('hex'), pn=nodeCrypto.pbkdf2Sync('şifre123'.normalize('NFC'),Buffer.from(tuz),3000,32,'sha256').toString('hex');
  ok(pj===pn,'yedek PBKDF2 (JS) gerçek PBKDF2 ile aynı'); 
  const uzunSifre=nodeCrypto.pbkdf2Sync('x'.repeat(100),Buffer.from(tuz),500,32,'sha256').toString('hex'); ok(Buffer.from(T.pbkdf2Js('x'.repeat(100),tuz,500)).toString('hex')===uzunSifre,'64 baytı aşan şifre (HMAC anahtar özeti) doğru');
  const kayit=await T.sifreKaydi('gizli123',1000); ok(await T.sifreDogru('gizli123',kayit)&&!await T.sifreDogru('gizli124',kayit),'şifre doğrulama (tuzlu)');
  ok(!JSON.stringify(kayit).includes('gizli123'),'şifre düz metin saklanmaz');
  // --- koruma kapalıyken her şey serbest ---
  ok(T.authAktif()===false&&T.izin('ayar'),'koruma kapalıyken herkes yetkili');
  T.kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet'}); T.alisKaydet('2026-11-01',[{kart:1,mik:100,bm:9}],'f');
  ok(T.db.hr[0].kul===''&&T.db.log.some(l=>l.islem==='ALIS'&&l.kadi===''),'korumasızken kayıt "kullanıcısız" günlüğe düşer');
  // --- koruma etkinleştirme ---
  ok(!(await T.korumayiEtkinlestir({kadi:'a',ad:'Ali',sifre:'123456'})).ok,'kısa kullanıcı adı reddedilir');
  ok(!(await T.korumayiEtkinlestir({kadi:'ali.y',ad:'Ali',sifre:'123'})).ok,'kısa şifre reddedilir');
  const k=await T.korumayiEtkinlestir({kadi:'Ali.Y',ad:'Ali Yılmaz',sifre:'Sifre-1234'});
  ok(k.ok&&/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(k.kod),'yönetici oluşturuldu, kurtarma kodu biçimi: '+k.kod);
  ok(T.authAktif()&&T.oturum.kadi==='ali.y'&&T.oturum.rol==='yonetici','koruma açıldı, yönetici oturumda (kadı küçük harfe çevrildi)');
  ok(!JSON.stringify(T.db.guvenlik).includes(k.kod.replace(/-/g,'')),'kurtarma kodu da düz metin saklanmaz');
  // --- kullanıcılar ve roller ---
  const e1=await T.kullaniciEkle({kadi:'ayse',ad:'Ayşe K.',rol:'personel',sifre:'gecici1'}); ok(e1.ok,'personel eklendi');
  await T.kullaniciEkle({kadi:'mehmet',ad:'Mehmet',rol:'yetkili',sifre:'gecici2'}); await T.kullaniciEkle({kadi:'izle',ad:'İzleyici',rol:'izleyici',sifre:'gecici3'});
  ok(!(await T.kullaniciEkle({kadi:'ayse',ad:'x',rol:'personel',sifre:'gecici1'})).ok,'aynı kullanıcı adı reddedilir');
  ok(T.db.kullanicilar.every(u=>u.sifre&&u.sifre.hash&&!('parola' in u)),'kullanıcılarda yalnızca tuzlu özet var');
  T.cikisYap(); ok(T.oturum===null,'çıkış yapıldı'); ok(!T.izin('gor')&&!T.alisKaydet('2026-11-02',[{kart:1,mik:1,bm:1}],'').ok,'oturum yokken hiçbir işlem yapılamaz');
  const yanlis=await T.girisYap('ayse','yanlis'); ok(!yanlis.ok&&T.db.log.some(l=>l.islem==='GIRIS_HATA'),'hatalı giriş reddedildi ve günlüğe yazıldı');
  const g1=await T.girisYap('AYSE','gecici1'); ok(g1.ok&&g1.zorla,'personel girişi; geçici şifre → zorunlu değişiklik bayrağı');
  ok(T.izin('giris')&&!T.izin('mali')&&!T.izin('duzelt')&&!T.izin('kart')&&!T.izin('ayar')&&!T.izin('log'),'personel izinleri: yalnızca giriş');
  const al=T.alisKaydet('2026-11-02',[{kart:1,mik:10,bm:9}],'personel girişi'); ok(al.ok&&T.db.hr[T.db.hr.length-1].kul==='ayse','personel alış girebilir; satır kullanıcı adıyla işaretlenir');
  ok(!T.kayitSil([T.db.hr[0].id],'x').ok&&!T.kartEkle({ad:'X',grup:'HAM',birim:'KG'}).ok&&!T.kayitDuzenle(T.db.hr[0].id,{mik:1}).ok,'personel silemez, kart ekleyemez, düzenleyemez (motor reddeder)');
  ok(!T.ayarKaydet('Z',50,15).ok&&!(await T.kullaniciEkle({kadi:'xx1',ad:'x',rol:'personel',sifre:'123456'})).ok,'personel ayar ve kullanıcı yönetimi yapamaz');
  ok(!T.sayimKaydet('2026-11-02',[{kart:1,sayilan:5}],'','Diğer','yeterince uzun açıklama metni').ok,'personel sayım yapamaz');
  const zs=await T.sifreBelirle('yeni-sifre-1',''); ok(zs.ok&&T.db.kullanicilar.find(u=>u.kadi==='ayse').zorla===false,'zorunlu şifre değişikliği tamamlandı');
  ok(!(await T.sifreDegistir('yanlis','baska-sifre')).ok&&(await T.sifreDegistir('yeni-sifre-1','baska-sifre-2')).ok,'şifre değiştirme: mevcut şifre doğrulanır');
  // yetkili
  T.cikisYap(); await T.girisYap('mehmet','gecici2');
  ok(T.izin('mali')&&T.izin('duzelt')&&T.izin('sayim')&&T.izin('kart')&&T.izin('log')&&!T.izin('ayar')&&!T.izin('kullanici'),'yetkili izinleri: işlemler + günlük, ayar/kullanıcı yok');
  ok(T.kartEkle({ad:'Su',grup:'TICARI',birim:'Adet'}).ok&&T.kayitSil([T.db.hr[0].id],'yanlış girildi').ok,'yetkili kart ekler ve kayıt siler');
  T.db.hr.filter(r=>r.sil).forEach(r=>{}); 
  ok(T.db.log.some(l=>l.islem==='SIL'&&l.kadi==='mehmet'&&/yanlış girildi/.test(l.aciklama)),'silme günlükte: kim, ne, neden');
  // izleyici
  T.cikisYap(); await T.girisYap('izle','gecici3'); ok(T.izin('gor')&&!T.izin('giris')&&!T.alisKaydet('2026-11-03',[{kart:1,mik:1,bm:1}],'').ok,'izleyici sadece görür');
  // yönetici
  T.cikisYap(); await T.girisYap('ali.y','Sifre-1234'); ok(T.izin('kullanici')&&T.izin('ayar'),'yönetici tam yetkili');
  ok(T.ayarKaydet('Test',35,20).ok&&T.db.ayar.kilitDk===20,'yönetici ayar kaydeder (kilit süresi dahil)');
  const ali=T.db.kullanicilar.find(u=>u.kadi==='ali.y');
  ok(!T.kullaniciGuncelle(ali.id,{aktif:false}).ok&&!T.kullaniciGuncelle(ali.id,{rol:'personel'}).ok,'son aktif yönetici pasifleştirilemez / düşürülemez');
  const ayse=T.db.kullanicilar.find(u=>u.kadi==='ayse'); ok(T.kullaniciGuncelle(ayse.id,{rol:'yetkili'}).ok&&T.db.kullanicilar.find(u=>u.kadi==='ayse').rol==='yetkili','rol değiştirildi');
  ok((await T.sifreSifirla(ayse.id,'gecici-yeni')).ok&&T.db.kullanicilar.find(u=>u.kadi==='ayse').zorla,'yönetici şifre sıfırlar (zorunlu değişiklik)');
  T.kullaniciGuncelle(ayse.id,{aktif:false}); T.cikisYap(); const pas=await T.girisYap('ayse','gecici-yeni'); ok(!pas.ok&&/pasif/.test(pas.msg),'pasif hesap giremez');
  // deneme sınırı
  let son; for(let i=0;i<6;i++) son=await T.girisYap('izle','yanlis-'+i); ok(!son.ok&&/sn sonra/.test(son.msg),'5 hatalı denemeden sonra geçici kilit: '+son.msg);
  ok(!(await T.girisYap('izle','gecici3')).ok,'kilitliyken doğru şifre de bekler');
  T.denemeler.clear();
  // oturum geri yükleme / tazeleme
  await T.girisYap('ali.y','Sifre-1234'); const o=T.oturum; ctx.sessionStorage.setItem('sos_oturum',JSON.stringify({id:o.id,ts:Date.now()})); T.oturum=null; ok(T.oturumGeriYukle()&&T.oturum.kadi==='ali.y','sayfa yenilenince oturum geri gelir');
  ctx.sessionStorage.setItem('sos_oturum',JSON.stringify({id:o.id,ts:Date.now()-60*60e3})); T.oturum=null; ok(!T.oturumGeriYukle(),'süresi dolan oturum geri gelmez');
  await T.girisYap('ali.y','Sifre-1234'); ok(T.kullaniciGuncelle(T.db.kullanicilar.find(u=>u.kadi==='ali.y').id,{ad:'Ali Y.'}).ok,'ad güncellendi'); ok(T.oturumTazele()&&T.oturum.ad==='Ali Y.','oturum güncel bilgiyi alır');
  // kurtarma kodu
  T.cikisYap(); T.denemeler.clear();
  ok(!(await T.kurtarmaIleSifirla('AAAAA-AAAAA-AAAAA-AAAAA','ali.y','yeni-yonetici')).ok,'yanlış kurtarma kodu reddedilir');
  const kr=await T.kurtarmaIleSifirla(k.kod.toLowerCase(),'ali.y','yeni-yonetici-1'); ok(kr.ok&&kr.kod!==k.kod,'doğru kurtarma kodu şifreyi sıfırlar ve YENİ kod üretir');
  ok((await T.girisYap('ali.y','yeni-yonetici-1')).ok,'yeni şifreyle giriş'); T.cikisYap();
  ok(!(await T.kurtarmaIleSifirla(k.kod,'ali.y','tekrar-deneme')).ok,'eski kurtarma kodu artık geçersiz');
  // günlük içeriği
  ok(T.db.log.every(l=>l.ts&&l.islem&&('kadi' in l)),'günlük kayıtları biçimli');
  const jt=JSON.stringify(T.db.log); ok(!/gecici|Sifre-1234|yeni-yonetici/.test(jt),'günlükte şifre ve kod geçmez');
  ok(['GIRIS','GIRIS_HATA','CIKIS','KULLANICI','ALIS','SIL','KART','AYAR'].every(t=>T.db.log.some(l=>l.islem===t)),'günlük tipleri: giriş, hatalı giriş, çıkış, kullanıcı, alış, silme, kart, ayar');
  // günlük kırpma
  for(let i=0;i<T.LOG_MAX+50;i++) T.logYaz('TEST','x'); ok(T.db.log.length<=T.LOG_MAX&&T.db.logKirpilan>0,'günlük sınırı: eskiler kırpılır ('+T.db.log.length+', kırpılan '+T.db.logKirpilan+')');
  // koruma kapatma/açma
  await T.girisYap('ali.y','yeni-yonetici-1'); ok(!(await T.korumayiKapat('yanlis')).ok&&(await T.korumayiKapat('yeni-yonetici-1')).ok&&!T.authAktif(),'koruma şifre onayıyla kapatılır'); 
  T.oturum=null; ok(T.izin('ayar'),'koruma kapalıyken serbest'); ok((await T.korumayiAc('ali.y','yeni-yonetici-1')).ok&&T.authAktif(),'koruma yeniden açılır');
  // şema
  const eski={v:1,firma:'E',kartlar:[{id:1,ad:'A',grup:'HAM',birim:'KG'}],hr:[],ayar:{kar:20},sayac:5,gun:1}; ok(T.dogrula(eski)&&eski.v===T.DB_SEMA&&Array.isArray(eski.kullanicilar)&&Array.isArray(eski.log)&&eski.ayar.kilitDk===15&&eski._yeni===false,'eski (v1) yedek v2\'ye yükseltilir');
  const yeniSurum={v:T.DB_SEMA+1,kartlar:[],hr:[],sayac:1}; ok(T.dogrula(yeniSurum)&&yeniSurum._yeni===true&&yeniSurum.v===T.DB_SEMA+1,'daha yeni biçimli veri işaretlenir, v değiştirilmez');
  ok(T.surumKarsilastir('1.2.0','1.1.9')===1&&T.surumKarsilastir('1.1.0','1.1.0')===0&&T.surumKarsilastir('1.0.9','1.1.0')===-1&&T.surumKarsilastir('2.0.0','1.9.9')===1,'sürüm karşılaştırma');
  console.log(hata?'\nHATA: '+hata:'\nKİMLİK TESTLERİ GEÇTİ'); process.exit(hata?1:0);
})().catch(e=>{console.log('İSTİSNA:',e.stack||e);process.exit(1);});
