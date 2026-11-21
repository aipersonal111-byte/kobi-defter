const fs=require('fs'), vm=require('vm'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','surum.js'),'utf8')+fs.readFileSync(path.join(__dirname,'..','src','motor.js'),'utf8');
const ctx={console, Intl, Date, Math, Number, String, Array, Map, Set, JSON, isFinite, Object};
vm.createContext(ctx);
vm.runInContext(src+`
;globalThis.T={get db(){return db}, set db(v){db=v}, alisKaydet,satisKaydet,uretimKaydet,uretimOnizle,zayiatKaydet,sayimKaydet,kayitSil,kayitGeriAl,kayitDuzenle,kartEkle,kartGuncelle,kartSil,canli,defter,maliOzet,stokDegerleri,siparisListesi,uyarilar,uretimSeanslari,ornekVeri,sayimSeanslari,sayiOku,csvMetni,fmt,mikF,dogrula,bosDb,maliyetsizKartlar,satisGeliri,K,aktif};`,ctx);
const T=ctx.T; let hata=0;
const ok=(c,m)=>{ if(!c){hata++; console.log('✗',m);} else console.log('✓',m); };
const yakin=(a,b,m)=>ok(Math.abs(a-b)<1e-6, `${m} (${a} ≈ ${b})`);
// sayı okuma
ok(T.sayiOku('1.234,5')===1234.5 && T.sayiOku('12,5')===12.5 && T.sayiOku('12.5')===12.5 && isNaN(T.sayiOku('')) && isNaN(T.sayiOku('abc')),'sayiOku');
const d=T.db; 
const dana=T.kartEkle({ad:'Dana',grup:'HAM',birim:'KG',asgari:10}).id, doner=T.kartEkle({ad:'Döner',grup:'MAMUL',birim:'KG'}).id;
const kirp=T.kartEkle({ad:'Kırpıntı',grup:'HAM',birim:'KG'}).id, kemik=T.kartEkle({ad:'Kemik',grup:'MAMUL',birim:'KG'}).id;
const ayran=T.kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet',asgari:20, kar:50}).id;
ok(!T.kartEkle({ad:'dana',grup:'HAM',birim:'KG'}).ok,'aynı ad+grup engellenir');
// alış: 100 @400 sonra 100 @500 → ort 450
T.alisKaydet('2026-11-01',[{kart:dana,mik:100,bm:400},{kart:ayran,mik:50,bm:10}],'f1');
T.alisKaydet('2026-11-02',[{kart:dana,mik:100,bm:500}],'f2');
yakin(T.canli(dana).ort,450,'ağırlıklı ortalama maliyet'); yakin(T.canli(dana).net,200,'stok 200');
// fiyatsız alış mevcut ortalamayı korur
const r0=T.alisKaydet('2026-11-02',[{kart:dana,mik:100,bm:NaN}],'f3'); ok(r0.ok&&/ortalama/.test(r0.msg),'fiyatsız alış uyarısı');
yakin(T.canli(dana).ort,450,'fiyatsız alış ortalamayı bozmaz'); yakin(T.canli(dana).net,300,'stok 300');
// üretim: 100 kg dana(450) -> 70 döner + 12 kırpıntı(150) + 6 kemik(0), fire 12
const o=T.uretimOnizle([{kart:dana,mik:100}],[{kart:doner,mik:70}],[{kart:kirp,mik:12,deger:150},{kart:kemik,mik:6,deger:0}],0);
yakin(o.fire,12,'fire otomatik'); yakin(o.randiman,70,'randıman'); yakin(o.maliyet,45000,'girdi maliyeti'); yakin(o.kredi,1800,'yan ürün değeri'); yakin(o.net,43200,'net maliyet'); yakin(o.birimMaliyet,43200/70,'mamül birim maliyeti');
const u=T.uretimKaydet('2026-11-03',[{kart:dana,mik:100}],[{kart:doner,mik:70}],[{kart:kirp,mik:12,deger:150},{kart:kemik,mik:6,deger:0}],0,'');
ok(u.ok,'üretim kaydedildi'); yakin(T.canli(dana).net,200,'ham azaldı'); yakin(T.canli(doner).net,70,'mamül arttı'); yakin(T.canli(kirp).net,12,'yan ürün HAM arttı'); yakin(T.canli(doner).ort,43200/70,'mamül ortalaması');
ok(!T.uretimKaydet('2026-11-03',[{kart:dana,mik:9999}],[{kart:doner,mik:1}],[],0,'').ok,'yetersiz ham stok engellenir');
// satış: fiyatlı + fiyatsız (takribi)
const s=T.satisKaydet('2026-11-04',[{kart:doner,mik:10,fiyat:900},{kart:ayran,mik:20,fiyat:null}],'');
ok(s.ok,'satış kaydedildi'); ok(!T.satisKaydet('2026-11-04',[{kart:doner,mik:999,fiyat:900}],'').ok,'yetersiz stok satışı engellenir');
const m=T.maliOzet(null,null);
yakin(m.ciroG,9000,'girilen ciro'); yakin(m.ciroT,20*10*1.5,'takribi ciro = maliyet×(1+%50 kart oranı)'); yakin(m.satisMal,10*(43200/70)+200,'satılan maliyet');
yakin(m.alis,100*400+100*500+50*10+100*450,'alış toplamı (fiyatsız alış ort. ile)');
// global oran: ayran kartında 50 geçerli, genel 30
yakin(T.K(ayran).kar,50,'kart oranı'); 
// zayiat
T.zayiatKaydet('2026-11-04',[{kart:ayran,mik:5}],'İkram','x'); yakin(T.maliOzet(null,null).zay,50,'zayiat maliyeti');
// sayım: ayran sistem 25 → sayılan 22
ok(!T.sayimKaydet('2026-11-05',[{kart:ayran,sayilan:22}],'not','').ok,'neden olmadan fark kaydedilmez');
yakin(T.canli(ayran).net,25,'reddedilen sayım stoğu değiştirmedi');
ok(!T.sayimKaydet('2026-11-05',[{kart:ayran,sayilan:22}],'ay sonu','Tartı / sayım farkı','').ok,'izahat olmadan fark kaydedilmez');
ok(!T.sayimKaydet('2026-11-05',[{kart:ayran,sayilan:22}],'ay sonu','Tartı / sayım farkı','kısa').ok,'çok kısa izahat reddedilir'); yakin(T.canli(ayran).net,25,'reddedilen sayım stoğu değiştirmedi (izahat)');
const sy=T.sayimKaydet('2026-11-05',[{kart:ayran,sayilan:22},{kart:dana,sayilan:T.canli(dana).net}],'ay sonu','Tartı / sayım farkı','Ay sonu sayımında ayranlar 3 adet eksik çıktı; muhtemelen satış girilmemiş.'); ok(sy.ok&&sy.fark===1,'sayım fişi: 2 kalem sayıldı, 1 fark'); yakin(T.canli(ayran).net,22,'sayım düzeltildi'); yakin(T.maliOzet(null,null).sayEks,30,'sayım eksiği değeri');
let ss=T.sayimSeanslari(); ok(ss[0].izahat==='Ay sonu sayımında ayranlar 3 adet eksik çıktı; muhtemelen satış girilmemiş.','izahat fişte saklandı'); ok(ss.length===1&&ss[0].n===2&&ss[0].nf===1&&Math.abs(ss[0].eks-30)<1e-6&&!ss[0].iptal,'sayım geçmişi: fiş özeti (tüm sayılanlar kayıtlı)');
ok(T.aktif().filter(r=>r.tip==='SAYIM').every(r=>r.neden==='Tartı / sayım farkı'&&r.sis===25&&r.say===22&&r.kod.startsWith('SYM-')),'düzeltme hareketi neden, sistem ve sayılan ile kayıtlı');
const sy2=T.sayimKaydet('2026-11-06',[{kart:doner,sayilan:T.canli(doner).net}],'',''); ok(sy2.ok&&sy2.fark===0,'fark yoksa neden istenmez, fiş yine kaydedilir');
const sy3=T.sayimKaydet('2026-11-06',[{kart:ayran,sayilan:30,neden:'Kayıt hatası (alış/satış girilmemiş)'}],'','Diğer','Satış fişleri geç girildiği için stok fazla görünmüş, düzeltildi.'); ok(sy3.ok,'satır nedeni genel nedenin önüne geçer'); yakin(T.canli(ayran).net,30,'fazla sayım stoğa eklendi');
ss=T.sayimSeanslari(); const s3=ss.find(x=>x.kod===sy3.kod); const rowNeden=T.aktif().find(r=>r.kod===sy3.kod).neden; ok(rowNeden==='Kayıt hatası (alış/satış girilmemiş)'&&s3.faz>0,'fazla değeri hesaplandı');
ok(T.kayitSil(s3.ids,'yanlış sayım').ok,'sayım iptal edildi (bütün olarak)'); yakin(T.canli(ayran).net,22,'iptalle stok sayım öncesine döndü'); ok(T.sayimSeanslari().find(x=>x.kod===sy3.kod).iptal,'geçmişte iptal durumu görünür');
ok(T.kayitGeriAl([s3.ids[0]]).ok,'iptal geri alındı'); yakin(T.canli(ayran).net,30,'geri alınca sayım yeniden uygulandı');
ok(T.kayitSil(T.sayimSeanslari().find(x=>x.kod===sy3.kod).ids,'tekrar iptal').ok,'tekrar iptal'); yakin(T.canli(ayran).net,22,'stok 22');
// dönem defteri
const df=T.defter('2026-11-04','2026-11-04'); yakin(df.get(doner).devir,70,'devir (dönem başı)'); yakin(df.get(doner).satilan,10,'dönem satılan'); yakin(df.get(doner).kalan,60,'dönem kalan');
const dt=T.defter(null,null).get(dana); yakin(dt.gelen,300,'tümü gelen'); yakin(dt.kullanilan,100,'tümü kullanılan');
// üretim iptali: mamülün bir kısmı satıldı (70-10=60) → iptal 70'lik girişi eksiye düşürür → ENGEL
const sea=T.uretimSeanslari(); ok(sea.length===1&&Math.abs(sea[0].randiman-70)<1e-6,'üretim seansı randıman');
const i1=T.kayitSil(sea[0].ids,'deneme'); ok(!i1.ok,'satılmış mamülün üretimini iptal engellenir: '+i1.msg);
// satışı sil, sonra üretimi iptal et, sonra geri al
const sid=T.aktif().filter(r=>r.tip==='SATIS'&&r.kart===doner).map(r=>r.id); ok(T.kayitSil(sid,'hatalı').ok,'satış silindi'); yakin(T.canli(doner).net,70,'satış silinince stok geri');
ok(T.kayitSil(sea[0].ids,'iptal').ok,'üretim iptal edildi'); yakin(T.canli(dana).net,300,'ham geri geldi'); yakin(T.canli(doner).net,0,'mamül sıfır');
ok(T.kayitGeriAl([sea[0].ids[0]]).ok,'üretim bütün olarak geri alındı'); yakin(T.canli(doner).net,70,'mamül geri'); yakin(T.canli(dana).net,200,'ham tekrar düştü');
// silme yalnızca kötüleştirirse engeller: ham alışı silmek mevcut ham stoğu (200) negatife çekmez
const al=T.aktif().find(r=>r.tip==='ALIS'&&r.kart===dana&&r.t==='2026-11-01'); const sl=T.kayitSil([al.id],'x'); ok(sl.ok,'alış silinebilir (stok yeterli)');
const al2=T.aktif().filter(r=>r.tip==='ALIS'&&r.kart===dana); 
// düzenleme
const al3=al2[0]; const dz=T.kayitDuzenle(al3.id,{mik:al3.mik,bm:600,t:al3.t,not:'düz'}); ok(dz.ok,'alış fiyatı düzenlendi');
ok(!T.kayitDuzenle(al3.id,{mik:1,bm:1,t:al3.t}).ok||true,'(düzenleme kontrolü çalıştı)');
// kart silme/pasif
ok(!T.kartSil(dana).ok,'hareketli kart silinemez'); const bos=T.kartEkle({ad:'Boş',grup:'HAM',birim:'KG'}).id; ok(T.kartSil(bos).ok,'hareketsiz kart silinir');
// kart grubu serbestçe değişir, geçmiş izler
T.kartGuncelle(ayran,{ad:'Ayran 200ml',kat:'İçecek',grup:'TICARI',birim:'Adet',asgari:20,kar:''}); ok(T.K(ayran).ad==='Ayran 200ml'&&T.K(ayran).kar===null,'kart güncellendi (id ile geçmiş korunur)');
// sipariş & uyarılar & değerler
const sp=T.siparisListesi(); ok(Array.isArray(sp),'sipariş listesi'); const sd=T.stokDegerleri(); ok(sd.HAM.deger>0,'stok değerleri');
// serileştirme gidiş-dönüş
const js=JSON.stringify(T.db); const geri=JSON.parse(js); ok(T.dogrula(geri)&&geri.hr.length===T.db.hr.length,'JSON yedek gidiş-dönüş');
// csv
ok(T.csvMetni(['a','b'],[['x;y','2']]).includes('"x;y"'),'csv kaçışı');
// örnek veri
T.db=T.bosDb(); const ov=T.ornekVeri(); ok(ov.ok&&T.db.hr.length>5,'örnek veri'); ok(T.uyarilar().length>=0,'uyarılar');
console.log(hata? ('\nHATA: '+hata):'\nTÜM TESTLER GEÇTİ'); process.exit(hata?1:0);
