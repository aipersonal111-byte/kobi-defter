const fs=require('fs'), vm=require('vm'), path=require('path');
const {makeDocument,fire,El,parseInto,docListeners}=require('./minidom.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const body=html.match(/<body>([\s\S]*?)<script>/)[1];
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const doc=makeDocument(body);
const store={}; const toasts=[];
const winL={};
const ctx={console,Intl,Date,Math,Number,String,Array,Map,Set,JSON,isFinite,Object,Promise,setTimeout:(f,t)=>{ if(t&&t>1000) return 0; return setTimeout(f,0); },clearTimeout,setInterval:()=>0,
  document:doc, location:{hash:''}, navigator:{}, localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},
  URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}}, Blob:class{constructor(p){this.p=p;}}, FileReader:class{}, scrollTo(){},
};
ctx.window=ctx; ctx.globalThis=ctx; ctx.addEventListener=(t,f)=>{(winL[t]=winL[t]||[]).push(f);};
vm.createContext(ctx);
vm.runInContext(script,ctx);
const S=()=>ctx.SOS; let hata=0;
const ok=(c,m)=>{ if(!c){hata++; console.log('✗',m);} else console.log('✓',m); };
const bekle=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>doc.getElementById(id);
const app=()=>$('app');
function git(p){ ctx.location.hash='#'+p; (winL.hashchange||[]).forEach(f=>f()); }
function dolu(sel,v){ const e=doc.querySelector(sel); if(!e) throw new Error('yok: '+sel); e.value=v; fire('input',e); return e; }
function tikla(sel){ const e=doc.querySelector(sel); if(!e) throw new Error('tıklanacak yok: '+sel); fire('click',e); }
function denge(h){ // etiket dengesi
  const st=[]; const re=/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g; let m; const VO=new Set(['input','br','img','hr','meta','link']);
  while((m=re.exec(h))){ const t=m[2].toLowerCase(); if(VO.has(t)||m[3].trim().endsWith('/')) continue; if(m[1]){ if(st.pop()!==t) return 'beklenmeyen </'+t+'>'; } else st.push(t); }
  return st.length? 'kapanmamış <'+st.pop()+'>' : '';
}
(async()=>{
  await bekle(30);
  ok(app().textContent.includes('Hoş geldiniz'),'boş panel karşılama');
  tikla('[data-act=ornek]'); await bekle(5);
  ok(S().db.kartlar.length===6 && S().db.hr.length>5,'örnek veri yüklendi (UI)');
  // tüm sayfalar + sekmeler
  for(const p of ['panel','alis','uretim','satis','zayiat','stok','hareket','sayim','analiz','kartlar','ayar']){
    git(p); const h=app().innerHTML; const d=denge(h);
    ok(h.length>200 && !d,`sayfa ${p} üretildi, etiketler dengeli ${d}`);
  }
  for(const [g,ks] of [['st',['TICARI','HAM','MAMUL','TUM','SIP']],['an',['mali','uretim','kayip']],['hr',['liste','arsiv']],['ur',['yeni','gecmis']],['za',['kayit','gecmis']]]){
    const pg={st:'stok',an:'analiz',hr:'hareket',ur:'uretim',za:'zayiat'}[g]; git(pg);
    for(const k of ks){ S().ui.tab[g]=k; S().SAYFA[pg]; git(pg); const h=app().innerHTML; const d=denge(h); ok(!d&&h.length>100,`${pg}/${k} sekmesi ${d}`); }
    S().ui.tab[g]=undefined;
  }
  // stok dönemleri
  git('stok'); for(const d of ['bugun','hafta','ay','tum','aralik']){ S().ui.f.stok.donem=d; git('stok'); ok(!denge(app().innerHTML),'stok dönem '+d); }
  // --- Kartlar: yeni kart ---
  git('kartlar'); dolu('#nk-ad','Su'); dolu('#nk-kat','İçecek'); dolu('#nk-grup','TICARI'); dolu('#nk-birim','Adet'); dolu('#nk-asgari','10'); dolu('#nk-kar','40');
  tikla('[data-act=kart-ekle]'); await bekle(5);
  const su=S().db.kartlar.find(k=>k.ad==='Su'); ok(su&&su.kar===40&&su.asgari===10&&su.grup==='TICARI','kart eklendi (form)');
  // toplu kart
  git('kartlar'); dolu('#toplu',"Tuz; Baharat; Ham; KG; 5\nKola; İçecek; Ticari; Adet\nHatalı satır"); tikla('[data-act=kart-toplu]'); await bekle(5);
  ok(S().db.kartlar.some(k=>k.ad==='Tuz'&&k.grup==='HAM')&&S().db.kartlar.some(k=>k.ad==='Kola'&&k.birim==='Adet'),'toplu kart eklendi');
  // --- Alış ---
  git('alis'); const sat=doc.querySelectorAll('#tb-al tbody tr'); ok(sat.length>=4,'alış tablosu satırları');
  const r1=sat.find(r=>r.textContent.includes('Su')); const mik=r1.querySelector('[data-f=mik]'), fy=r1.querySelector('[data-f=fy]');
  mik.value='100'; fire('input',mik); fy.value='7,5'; fire('input',fy);
  ok($('al-ozet').textContent.includes('750'),'alış canlı toplam: '+$('al-ozet').textContent);
  const onceHr=S().db.hr.length; tikla('[data-act=alis-kaydet]'); await bekle(5);
  const alis=S().db.hr[S().db.hr.length-1]; ok(S().db.hr.length===onceHr+1&&alis.tip==='ALIS'&&alis.mik===100&&alis.bm===7.5,'alış kaydedildi (UI)');
  // --- Satış: fiyatsız (takribi) ---
  git('satis'); const ss=doc.querySelectorAll('#tb-sa tbody tr'); const sr=ss.find(r=>r.textContent.includes('Su'));
  const sm=sr.querySelector('[data-f=mik]'); sm.value='20'; fire('input',sm);
  ok(/takribi/.test($('sa-ozet').innerHTML)||$('sa-ozet').textContent.includes('ciro'),'satış canlı özet: '+$('sa-ozet').textContent);
  tikla('[data-act=satis-kaydet]'); await bekle(5);
  const sv=S().db.hr[S().db.hr.length-1]; ok(sv.tip==='SATIS'&&sv.fiyat===null&&Math.abs(sv.oran-40)<1e-9,'fiyatsız satış, takribi oran %40 (kart oranı) saklandı');
  // yetersiz stok → buton kilit
  git('satis'); const sr2=doc.querySelectorAll('#tb-sa tbody tr').find(r=>r.textContent.includes('Su')); const sm2=sr2.querySelector('[data-f=mik]'); sm2.value='999999'; fire('input',sm2);
  ok($('sa-btn').disabled,'yetersiz stokta kaydet düğmesi kilitli');
  // --- Zayiat ---
  git('zayiat'); const zr=doc.querySelectorAll('#tb-za tbody tr').find(r=>r.textContent.includes('Su')); const zm=zr.querySelector('[data-f=mik]'); zm.value='2'; fire('input',zm);
  dolu('#za-neden','İkram'); tikla('[data-act=zayiat-kaydet]'); await bekle(5);
  const zv=S().db.hr[S().db.hr.length-1]; ok(zv.tip==='ZAYIAT'&&zv.neden==='İkram'&&zv.mik===2,'zayiat kaydedildi (UI)');
  // --- Üretim ---
  git('uretim'); const gs=$('ur-g').querySelector('select'), cs=$('ur-c').querySelector('select');
  const opt=(sel,ad)=>sel.querySelectorAll('option').find(o=>o.textContent.startsWith(ad)).attrs.value;
  gs.value=opt(gs,"Dana 5'li"); fire('change',gs); $('ur-g').querySelector('[data-f=mik]').value='50'; fire('input',$('ur-g').querySelector('[data-f=mik]'));
  cs.value=opt(cs,'Et döner'); fire('change',cs); $('ur-c').querySelector('[data-f=mik]').value='35'; fire('input',$('ur-c').querySelector('[data-f=mik]'));
  ok($('ur-onizle').textContent.includes('Randıman')&&$('ur-onizle').textContent.includes('70,00'),'üretim önizleme randıman %70: '+$('ur-onizle').textContent.slice(0,120));
  ok(!$('ur-btn').disabled,'üretim düğmesi açık');
  tikla('[data-act=ur-ekle][data-s=y]'); const ys=$('ur-y').querySelector('select'); ys.value=opt(ys,'Döner kırpıntısı'); fire('change',ys); $('ur-y').querySelector('[data-f=mik]').value='5'; fire('input',$('ur-y').querySelector('[data-f=mik]')); $('ur-y').querySelector('[data-f=deger]').value='150'; fire('input',$('ur-y').querySelector('[data-f=deger]'));
  tikla('[data-act=uretim-kaydet]'); await bekle(5);
  const sea=S().db.hr.filter(r=>r.kod&&!r.sil); ok(sea.some(r=>r.tip==='URETIM_CIKTI'&&r.mik===35)&&sea.some(r=>r.tip==='YAN_URUN'&&r.mik===5)&&sea.some(r=>r.tip==='FIRE'&&Math.abs(r.mik-10)<1e-9),'üretim kaydedildi: mamül 35, yan ürün 5, fire 10');
  // --- üretim iptal (geçmiş sekmesi) ---
  S().ui.tab.ur='gecmis'; git('uretim'); const kodBtn=doc.querySelectorAll('[data-act=seans-iptal]'); ok(kodBtn.length>=1,'üretim geçmişi iptal düğmesi');
  fire('click',kodBtn[0]); ok($('dlg').open&&$('dlg').textContent.includes('iptal'),'iptal onay penceresi açıldı'); dolu('#md-neden','test'); tikla('[data-act=modal-tamam]'); await bekle(5);
  ok(S().db.hr.some(r=>r.kod&&r.sil===1&&r.silNeden==='test'),'üretim iptal edildi (UI)');
  // --- hareket sil / geri al ---
  S().ui.tab.hr='liste'; S().ui.tab.ur='yeni'; git('hareket'); const sb=doc.querySelectorAll('[data-act=hr-sil]'); ok(sb.length>0,'hareket sil düğmeleri'); fire('click',sb[0]); dolu('#md-neden','hatalı'); tikla('[data-act=modal-tamam]'); await bekle(5);
  ok(S().db.hr.filter(r=>r.sil===1&&r.silNeden==='hatalı').length>=1,'hareket silindi (UI)');
  S().ui.tab.hr='arsiv'; git('hareket'); const gb=doc.querySelectorAll('[data-act=hr-geri]'); ok(gb.length>0,'arşivde geri al düğmesi'); fire('click',gb[0]); await bekle(5);
  // --- düzenle ---
  S().ui.tab.hr='liste'; git('hareket'); const db_=doc.querySelectorAll('[data-act=hr-duzenle]'); ok(db_.length>0,'düzenle düğmesi'); fire('click',db_[0]); ok($('dlg').open&&$('md-mik'),'düzenle penceresi'); dolu('#md-not','düzeltildi'); tikla('[data-act=modal-kaydet]'); await bekle(5);
  ok(S().db.hr.some(r=>r.not==='düzeltildi'),'hareket düzenlendi (UI)');
  // --- sayım (fiş akışı) ---
  git('sayim'); ok($('app').textContent.includes('Sayım geçmişi')&&$('app').textContent.includes('Fark nedeni'),'sayım sayfası: geçmiş sekmesi ve genel neden alanı');
  const yr=doc.querySelectorAll('#tb-sy tbody tr').find(r=>r.textContent.includes('Su')); const sy=yr.querySelector('[data-f=say]'); sy.value='50'; fire('input',sy);
  ok($('sy-ozet').textContent.includes('farklı'),'sayım canlı fark: '+$('sy-ozet').textContent); ok(!yr.querySelector('[data-f=neden]').hidden,'farklı satırda neden seçimi göründü');
  const hrOnce=S().db.hr.length; tikla('[data-act=sayim-incele]');
  ok($('toast').textContent.includes('Fark nedeni'),'neden seçilmeden onaya geçilmez (uyarı): '+$('toast').textContent.slice(-80)); ok(S().db.hr.length===hrOnce,'uyarıda kayıt yapılmadı');
  dolu('#sy-genel','Tartı / sayım farkı'); dolu('#sy-not','ay sonu'); tikla('[data-act=sayim-incele]');
  ok($('dlg').open&&$('dlg').textContent.includes('Eksik toplamı')&&$('dlg').textContent.includes('Tartı / sayım farkı'),'inceleme penceresi: farklar, toplamlar, neden');
  ok(S().db.hr.length===hrOnce,'inceleme aşamasında henüz kayıt yok'); ok(!!$('md-izahat')&&$('dlg').textContent.includes('zorunlu'),'onay penceresinde zorunlu izahat kutusu');
  tikla('[data-act=modal-kaydet]'); await bekle(5);
  ok($('toast').textContent.includes('izahat')&&S().db.sayimlar.length===0&&$('dlg').open,'izahat yazılmadan kayıt yapılamaz, pencere açık kalır');
  const iz=$('md-izahat'); iz.value='kısa'; fire('input',iz); ok($('md-say').textContent.includes('/20'),'karakter sayacı: '+$('md-say').textContent);
  tikla('[data-act=modal-kaydet]'); await bekle(5); ok(S().db.sayimlar.length===0,'kısa izahatla da kayıt yapılamaz');
  iz.value='Ay sonu sayımında su stokunda eksik çıktı; satış fişleri geç girildi, tartı farkı değil.'; fire('input',iz); ok($('md-say').textContent.includes('✓'),'sayaç tamam: '+$('md-say').textContent);
  tikla('[data-act=modal-kaydet]'); await bekle(5);
  ok(S().db.sayimlar.length===1&&S().db.hr.some(r=>r.tip==='SAYIM'&&r.neden==='Tartı / sayım farkı'&&r.kod.startsWith('SYM-')),'sayım fişi ve düzeltme hareketi kaydedildi (UI)');
  S().ui.tab.sy='gecmis'; git('sayim'); ok($('app').textContent.includes('düzeltme uygulandı'),'sayım geçmişinde fiş görünüyor');
  tikla('[data-act=sayim-detay]'); ok($('dlg').open&&$('dlg').textContent.includes('Tartı / sayım farkı')&&$('dlg').textContent.includes('satış fişleri geç girildi'),'fiş detayı: neden ve izahat görünüyor');
  tikla('[data-act=sayim-rapor]'); const rapor=$('rapor').innerHTML; ok(rapor.includes('Stok Sayım Raporu')&&rapor.includes('Açıklama / izahat')&&rapor.includes('satış fişleri geç girildi')&&rapor.includes('Sayımı yapan')&&!denge(rapor),'yazdırılabilir rapor: başlık, farklar, izahat, imza alanı, dengeli HTML'); ok(doc.body.classList.contains('rp'),'yazdırma modu açıldı');
  tikla('[data-act=modal-kapat]');
  tikla('[data-act=sayim-iptal]'); dolu('#md-neden','yanlış sayım'); tikla('[data-act=modal-tamam]'); await bekle(5);
  ok(S().db.hr.filter(r=>r.tip==='SAYIM').every(r=>r.sil===1),'sayım iptal edildi (UI)'); git('sayim'); ok($('app').textContent.includes('iptal edildi'),'geçmişte iptal durumu'); S().ui.tab.sy='yeni';
  // hareketlerde sayım satırı → sayım iptali düğmesi
  S().ui.tab.hr='arsiv'; git('hareket'); S().ui.tab.hr='liste';
  // --- ayarlar: kâr oranı ---
  git('ayar'); ok(app().textContent.includes('sürüm 3.2.0'),'ayarlarda sürüm numarası görünür'); dolu('#ay-kar','35,5'); dolu('#ay-firma','Test İşletme'); tikla('[data-act=ayar-kaydet]'); await bekle(5);
  ok(S().db.ayar.kar===35.5&&S().db.firma==='Test İşletme','ayarlar kaydedildi');
  // kart düzenle & pasif & sil
  git('kartlar'); const kd=doc.querySelectorAll('[data-act=kart-duzenle]'); fire('click',kd[0]); ok($('dlg').open&&$('ek-ad'),'kart düzenle penceresi');
  dolu('#ek-kat','Yeni Kategori'); tikla('[data-act=modal-kaydet]'); await bekle(5); ok(S().db.kartlar.some(k=>k.kat==='Yeni Kategori'),'kart düzenlendi');
  // analiz aralık düğmeleri
  git('analiz'); for(const n of ['0','6','29','ay','tum']){ tikla(`[data-act=aralik][data-n="${n}"]`); ok(!denge(app().innerHTML),'analiz aralık '+n); }
  // yedek metni gidiş-dönüş & depolama senkron kopyası
  await bekle(600); const kopya=JSON.parse(store.sos_db||'null'); ok(kopya&&kopya.hr.length===S().db.hr.length,'localStorage senkron kopya güncel ('+(kopya&&kopya.hr.length)+' hareket)');
  console.log(hata? '\nHATA: '+hata : '\nUI TESTLERİ GEÇTİ');
  process.exit(hata?1:0);
})().catch(e=>{ console.log('İSTİSNA:',e.stack||e); process.exit(1); });
