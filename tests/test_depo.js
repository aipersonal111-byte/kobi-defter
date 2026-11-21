const fs=require('fs'), vm=require('vm'), path=require('path');
const {makeDocument,fire}=require('./minidom.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const body=html.match(/<body>([\s\S]*?)<script>/)[1], script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const bekle=ms=>new Promise(r=>setTimeout(r,ms));
function done(v){ const r={}; setTimeout(()=>{ r.result=v; r.onsuccess&&r.onsuccess(); },0); return r; }
function fakeIDB(dbs){ return { open(name){ const req={}; setTimeout(()=>{ let d=dbs[name]; const fresh=!d; if(!d) d=dbs[name]={stores:{}};
  const o={ objectStoreNames:{contains:n=>n in d.stores}, createObjectStore(n,opt){ d.stores[n]={keyPath:opt&&opt.keyPath,data:new Map()}; },
    transaction(n){ const s=d.stores[n]; return { objectStore(){ return { put(v,k){ const key=s.keyPath? v[s.keyPath]:k; s.data.set(key,v); return done(key); }, get(k){ return done(s.data.get(k)); }, getAll(){ return done([...s.data.values()]); }, delete(k){ s.data.delete(k); return done(); } }; } }; } };
  req.result=o; if(fresh&&req.onupgradeneeded) req.onupgradeneeded(); req.onsuccess&&req.onsuccess(); },0); return req; } }; }
function fakeDir(name){ const files=new Map(); let perm='granted'; let t=1000;
  const h={ kind:'directory', name, files, get perm(){return perm;}, setPerm(p){perm=p;}, fail:null,
    queryPermission:async()=>perm, requestPermission:async()=>{perm='granted';return perm;},
    async getFileHandle(n,o){ if(h.fail){ const e=new Error('izin yok'); e.name=h.fail; throw e; } if(!files.has(n)){ if(!(o&&o.create)) throw new Error('NotFound'); files.set(n,{text:'',m:t++}); } const f=files.get(n);
      return { kind:'file', async createWritable(){ let buf=''; return { async write(x){buf+=x;}, async close(){ f.text=buf; f.m=++t; } }; }, async getFile(){ return { size:f.text.length, lastModified:f.m, text:async()=>f.text }; } }; },
    async removeEntry(n){ files.delete(n); },
    entries(){ const arr=[...files.entries()].map(([n,f])=>[n,{kind:'file',async getFile(){return{size:f.text.length,lastModified:f.m,text:async()=>f.text}}}]); return (async function*(){ for(const x of arr) yield x; })(); } };
  return h; }
const chans=[]; class BC{ constructor(n){ this.n=n; chans.push(this); } postMessage(m){ chans.filter(c=>c!==this).forEach(c=>c.onmessage&&c.onmessage({data:m})); } }
function ortam(st){ const doc=makeDocument(body); const winL={};
  const ctx={console,Intl,Date,Math,Number,String,Array,Map,Set,JSON,isFinite,Object,Promise,setTimeout:(f,t)=>setTimeout(f,t>1000?1e7:Math.min(t||0,50)),clearTimeout,setInterval:()=>0,
    document:doc, location:{hash:''}, navigator:{storage:{persist:async()=>true}}, localStorage:{getItem:k=>st.ls[k]||null,setItem:(k,v)=>{st.ls[k]=v;}},
    indexedDB:fakeIDB(st.idb), BroadcastChannel:BC, URL:{createObjectURL:()=>'b',revokeObjectURL(){}}, Blob:class{}, FileReader:class{}, scrollTo(){} };
  ctx.window=ctx; ctx.globalThis=ctx; ctx.addEventListener=(t,f)=>{(winL[t]=winL[t]||[]).push(f);}; ctx.showDirectoryPicker=async()=>st.dir;
  vm.createContext(ctx); vm.runInContext(script,ctx); return {ctx,doc,winL,S:()=>ctx.SOS}; }
let hata=0; const ok=(c,m)=>{ if(!c){hata++; console.log('✗',m);} else console.log('✓',m); };
(async()=>{
  const st={ls:{},idb:{},dir:fakeDir('StokYedek')};
  let A=ortam(st); await bekle(40);
  const ev=A.ctx.eval||((s)=>vm.runInContext(s,A.ctx));
  ok(vm.runInContext('Depo.ok',A.ctx),'IndexedDB açıldı');
  ok(vm.runInContext('Klasor.destek',A.ctx),'klasör API algılandı');
  // veri ekle
  vm.runInContext(`kartEkle({ad:'Ayran',grup:'TICARI',birim:'Adet'}); alisKaydet('2026-11-10',[{kart:1,mik:100,bm:9}],'f1');`,A.ctx);
  await bekle(700);
  const idbJson=st.idb.sos_stok_v1.stores.kv.data.get('db'); ok(idbJson&&JSON.parse(idbJson).hr.length===1,'IndexedDB ana kayıt yazıldı (değişiklikten sonra)');
  ok(JSON.parse(st.ls.sos_db).hr.length===1,'localStorage senkron kopya yazıldı');
  ok(st.idb.sos_stok_v1.stores.snap.data.size>=1,'ilk anlık görüntü alındı');
  // klasör seç
  A.doc.querySelector('#banner'); 
  vm.runInContext(`ACT['klasor-sec']()`,A.ctx); await bekle(300);
  ok(st.dir.files.has('stok_portal_guncel.json'),'klasörde stok_portal_guncel.json oluştu');
  ok([...st.dir.files.keys()].some(k=>/^gunluk_\d{8}\.json$/.test(k)),'günlük yedek oluştu');
  ok([...st.dir.files.keys()].some(k=>/^anlik_\d{8}_\d{4}\.json$/.test(k)),'anlık (saatlik) yedek oluştu');
  // değişiklik → güncel dosya güncellenir
  vm.runInContext(`satisKaydet('2026-11-10',[{kart:1,mik:10,fiyat:12}],'')`,A.ctx); await bekle(700);
  ok(JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).hr.length===2,'her değişiklikte güncel dosya yenileniyor (2 hareket)');
  // rotasyon: 60 eski anlik dosyası
  for(let i=0;i<60;i++) st.dir.files.set(`anlik_2026010${i%9+1}_${String(i).padStart(4,'0')}.json`,{text:'{}',m:i+1});
  vm.runInContext(`Klasor._anlik=0; Kayit.bekleyen=true;`,A.ctx); await vm.runInContext(`Kayit.flush('zorla')`,A.ctx); await bekle(100);
  const an=[...st.dir.files.keys()].filter(k=>k.startsWith('anlik_')).length; ok(an<=48,'döner yedek: anlık dosya sayısı 48 ile sınırlı ('+an+')');
  ok(st.dir.files.has('stok_portal_guncel.json'),'rotasyon güncel dosyaya dokunmadı');
  // yeniden açılış: aynı depolarla yeni ortam
  A=ortam(st); await bekle(80);
  ok(vm.runInContext('db.hr.length',A.ctx)===2&&vm.runInContext('db.kartlar[0].ad',A.ctx)==='Ayran','yeniden açılışta veri geri geldi');
  ok(vm.runInContext('Klasor.durum',A.ctx)==='tamam'&&vm.runInContext('Klasor.ad',A.ctx)==='StokYedek','klasör tanıtımı hatırlandı');
  // izin düştü (Chrome yeniden başlatınca)
  st.dir.setPerm('prompt'); A=ortam(st); await bekle(80);
  ok(vm.runInContext('Klasor.durum',A.ctx)==='izin','izin gerekiyor durumu algılandı');
  ok(A.doc.getElementById('banner').textContent.includes('izni'),'banner: izin uyarısı gösterildi');
  ok(!!A.doc.querySelector('[data-act=klasor-izin]'),'izin ver düğmesi görünür');
  vm.runInContext(`kartEkle({ad:'Su',grup:'TICARI',birim:'Adet'})`,A.ctx); await bekle(700);
  ok(JSON.parse(st.idb.sos_stok_v1.stores.kv.data.get('db')).kartlar.length===2,'izin yokken bile tarayıcı kaydı yazılıyor');
  ok(JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).kartlar.length===1,'izin yokken klasör dosyası değişmedi (beklenen)');
  vm.runInContext(`ACT['klasor-izin']()`,A.ctx); await bekle(300);
  ok(vm.runInContext('Klasor.durum',A.ctx)==='tamam'&&JSON.parse(st.dir.files.get('stok_portal_guncel.json').text).kartlar.length===2,'izin verilince klasör hemen güncellendi');
  // klasör yazma hatası
  st.dir.fail='NotAllowedError'; vm.runInContext(`kartEkle({ad:'Kola',grup:'TICARI',birim:'Adet'})`,A.ctx); await bekle(700);
  ok(vm.runInContext('Klasor.durum',A.ctx)==='izin','yazma hatası (izin kaybı) → izin durumuna geçti, uygulama çökmedi');
  ok(JSON.parse(st.idb.sos_stok_v1.stores.kv.data.get('db')).kartlar.length===3,'hata anında tarayıcı kaydı yine de yazıldı');
  st.dir.fail=null; vm.runInContext(`Klasor.durum='tamam'`,A.ctx);
  // en yeni kayıt kazanır: localStorage daha yeni
  const yeni=JSON.parse(st.ls.sos_db); yeni.gun=Date.now()+1; yeni.firma='LS-YENİ'; st.ls.sos_db=JSON.stringify(yeni);
  A=ortam(st); await bekle(80); ok(vm.runInContext('db.firma',A.ctx)==='LS-YENİ','IDB ile localStorage çelişirse daha yeni olan seçilir');
  // başka sekme koruması
  const B=ortam(st); await bekle(80);
  vm.runInContext(`kartEkle({ad:'Sekme-B',grup:'HAM',birim:'KG'})`,B.ctx); await bekle(700);
  ok(vm.runInContext('Kayit.eskiSekme',A.ctx)===true,'başka sekmede değişiklik → bu sekme uyarıldı');
  const once=st.idb.sos_stok_v1.stores.kv.data.get('db');
  vm.runInContext(`kartEkle({ad:'Sekme-A',grup:'HAM',birim:'KG'})`,A.ctx); await bekle(700);
  ok(st.idb.sos_stok_v1.stores.kv.data.get('db')===once,'eski sekme kayıt yapmıyor (üzerine yazma engellendi)');
  ok(A.doc.getElementById('banner').textContent.includes('başka bir sekmede'),'banner: başka sekme uyarısı');
  // yedekten geri yükleme + öncesi görüntü
  const C=ortam({ls:{},idb:st.idb,dir:st.dir}); await bekle(80);
  const yedekMetni=st.dir.files.get('stok_portal_guncel.json').text; const nKart=JSON.parse(yedekMetni).kartlar.length;
  vm.runInContext(`kartEkle({ad:'Geçici',grup:'HAM',birim:'KG'})`,C.ctx); await bekle(700);
  C.ctx.__m=yedekMetni; vm.runInContext(`yedekOnay(__m,'test.json')`,C.ctx); ok(C.doc.getElementById('dlg').textContent.includes('Geri yükle'),'geri yükleme onay penceresi (kart/hareket özetiyle)');
  const snapOnce=st.idb.sos_stok_v1.stores.snap.data.size; fire('click',C.doc.querySelector('[data-act=modal-tamam]')); await bekle(400);
  ok(vm.runInContext('db.kartlar.length',C.ctx)===nKart,'yedek geri yüklendi (kart sayısı '+nKart+')');
  ok(st.idb.sos_stok_v1.stores.snap.data.size>snapOnce,'geri yükleme öncesi anlık görüntü alındı');
  ok([...st.dir.files.keys()].some(k=>k.startsWith('oncesi_')),'klasöre oncesi_ dosyası yazıldı');
  // bozuk dosya
  ok(vm.runInContext(`yedekCoz('{bozuk')`,C.ctx).hata&&vm.runInContext(`yedekCoz('{"a":1}')`,C.ctx).hata,'bozuk/yanlış dosya reddedilir');
  // tüm verileri sil → öncesi görüntü
  vm.runInContext(`ACT.sifirla()`,C.ctx); C.doc.getElementById('md-neden').value='SİL'; fire('click',C.doc.querySelector('[data-act=modal-tamam]')); await bekle(500);
  ok(vm.runInContext('db.kartlar.length',C.ctx)===0,'tüm veriler silindi');
  const snaps=[...st.idb.sos_stok_v1.stores.snap.data.values()].sort((a,b)=>b.ts-a.ts); ok(snaps.some(s=>/Silme öncesi/.test(s.etiket)&&JSON.parse(s.json).kartlar.length>0),'silmeden önceki görüntü kurtarılabilir');
  console.log(hata? '\nHATA: '+hata : '\nDEPO / YEDEK TESTLERİ GEÇTİ'); process.exit(hata?1:0);
})().catch(e=>{ console.log('İSTİSNA:',e.stack||e); process.exit(1); });
