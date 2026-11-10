/* Kobi Defter servis çalışanı. Her yayında SURUM'u değiştirin (version.json ile aynı). */
const SURUM='3.1';
const KAP='kobi-defter-'+SURUM;
const DOSYALAR=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(KAP).then(c=>Promise.all(DOSYALAR.map(u=>fetch(new Request(u,{cache:'reload'})).then(r=>{if(!r.ok)throw new Error(u);return c.put(u,r)})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('kobi-defter-')&&x!==KAP).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.t==='SKIP')self.skipWaiting()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('/version.json'))return;
  e.respondWith(caches.open(KAP).then(async c=>{
    let m=await c.match(r,{ignoreSearch:true});
    if(!m&&r.mode==='navigate')m=await c.match('index.html');
    return m||fetch(r)}))});
