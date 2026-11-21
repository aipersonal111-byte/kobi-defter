// Testler için ortak ortam: sahte IndexedDB, klasör/dosya tutamaçları, BroadcastChannel, kripto, sessionStorage, minidom.
const fs = require('fs'), vm = require('vm'), path = require('path'), nodeCrypto = require('crypto');
const { makeDocument, fire } = require('./minidom.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const body = html.match(/<body>([\s\S]*?)<script>/)[1], script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const bekle = ms => new Promise(r => setTimeout(r, ms));
function done(v) { const r = {}; setTimeout(() => { r.result = v; r.onsuccess && r.onsuccess(); }, 0); return r; }
function fakeIDB(dbs) { return { open(name) { const req = {}; setTimeout(() => { let d = dbs[name]; const fresh = !d; if (!d) d = dbs[name] = { stores: {} };
  const o = { objectStoreNames: { contains: n => n in d.stores }, createObjectStore(n, opt) { d.stores[n] = { keyPath: opt && opt.keyPath, data: new Map() }; },
    transaction(n) { const s = d.stores[n]; return { objectStore() { return { put(v, k) { const key = s.keyPath ? v[s.keyPath] : k; s.data.set(key, v); return done(key); }, get(k) { return done(s.data.get(k)); }, getAll() { return done([...s.data.values()]); }, delete(k) { s.data.delete(k); return done(); } }; } }; } };
  req.result = o; if (fresh && req.onupgradeneeded) req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0); return req; } }; }
const hataNf = () => { const e = new Error('bulunamadı'); e.name = 'NotFoundError'; return e; };
function fakeDir(name) {
  const files = new Map(); let perm = 'granted', t = 1000;
  const h = { kind: 'directory', name, files, gone: false, fail: null, setPerm(p) { perm = p; },
    queryPermission: async () => perm, requestPermission: async () => { perm = 'granted'; return perm; },
    async getFileHandle(n, o) { if (h.gone) throw hataNf(); if (h.fail) { const e = new Error('izin yok'); e.name = h.fail; throw e; } if (!files.has(n)) { if (!(o && o.create)) throw hataNf(); files.set(n, { text: '', m: t++ }); } const f = files.get(n);
      return { kind: 'file', async createWritable() { let buf = ''; return { async write(x) { buf += x; }, async close() { f.text = buf; f.m = ++t; } }; }, async getFile() { return { size: f.text.length, lastModified: f.m, text: async () => f.text }; } }; },
    async removeEntry(n) { files.delete(n); },
    entries() { if (h.gone) throw hataNf(); const arr = [...files.entries()].map(([n, f]) => [n, { kind: 'file', async getFile() { return { size: f.text.length, lastModified: f.m, text: async () => f.text }; } }]); return (async function* () { for (const x of arr) yield x; })(); } };
  return h;
}
function fakeFile(name) {
  const f = { text: '', m: 1 }; let perm = 'granted';
  const h = { kind: 'file', name, f, gone: false, setPerm(p) { perm = p; }, queryPermission: async () => perm, requestPermission: async () => { perm = 'granted'; return perm; },
    async getFile() { if (h.gone) throw hataNf(); return { size: f.text.length, lastModified: f.m, text: async () => f.text }; },
    async createWritable() { if (h.gone) throw hataNf(); let buf = ''; return { async write(x) { buf += x; }, async close() { f.text = buf; f.m++; } }; } };
  return h;
}
const chans = []; class BC { constructor(n) { this.n = n; chans.push(this); } postMessage(m) { chans.filter(c => c !== this).forEach(c => c.onmessage && c.onmessage({ data: m })); } }
function yeniSt() { return { ls: {}, ss: {}, idb: {}, dir: fakeDir('StokYedek'), file: fakeFile('yedek.json') }; }
/** opt: noPicker (klasör/dosya seçici yok), fetch (sahte fetch), href */
function ortam(st, opt = {}) {
  const doc = makeDocument(body), winL = {}, toasts = [];
  const ctx = { console, Intl, Date, Math, Number, String, Array, Map, Set, JSON, isFinite, Object, Promise, Uint8Array, Uint32Array, DataView, TextEncoder, btoa, atob, crypto: nodeCrypto.webcrypto,
    setTimeout: (f, t) => setTimeout(f, t > 1000 ? 1e7 : Math.min(t || 0, 50)), clearTimeout, setInterval: () => 0,
    document: doc, location: { hash: opt.hash || '', protocol: 'file:', href: opt.href || 'file:///c/index.html' }, navigator: { storage: { persist: async () => true } },
    localStorage: { getItem: k => st.ls[k] || null, setItem: (k, v) => { st.ls[k] = v; } },
    sessionStorage: { getItem: k => st.ss[k] || null, setItem: (k, v) => { st.ss[k] = String(v); }, removeItem: k => { delete st.ss[k]; } },
    indexedDB: fakeIDB(st.idb), BroadcastChannel: BC, URL: Object.assign(class { constructor(u, b) { this.href = u; } }, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }), Blob: class { constructor(p) { this.p = p; } }, FileReader: class {}, scrollTo() {} };
  if (opt.fetch) ctx.fetch = opt.fetch;
  if (opt.extra) Object.assign(ctx, opt.extra);
  ctx.window = ctx; ctx.globalThis = ctx; ctx.addEventListener = (t, f) => { (winL[t] = winL[t] || []).push(f); };
  if (!opt.noPicker) { ctx.showDirectoryPicker = async () => st.dir; ctx.showSaveFilePicker = async () => st.file; }
  vm.createContext(ctx); vm.runInContext(script, ctx);
  const o = { ctx, doc, winL, run: c => vm.runInContext(c, ctx), $: id => doc.getElementById(id), fire,
    dolu: (sel, v) => { const e = doc.querySelector(sel); if (!e) throw new Error('yok: ' + sel); e.value = v; fire('input', e); fire('change', e); return e; },
    tikla: sel => { const e = doc.querySelector(sel); if (!e) throw new Error('tıklanacak yok: ' + sel); fire('click', e); },
    git: p => { ctx.location.hash = '#' + p; (winL.hashchange || []).forEach(f => f()); },
    app: () => doc.getElementById('app').textContent, toast: () => doc.getElementById('toast').textContent,
    banner: () => doc.getElementById('banner').textContent, dlg: () => doc.getElementById('dlg') };
  return o;
}
function denge(h) { const st = []; const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g; let m; const VO = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
  while ((m = re.exec(h))) { const t = m[2].toLowerCase(); if (VO.has(t) || m[3].trim().endsWith('/')) continue; if (m[1]) { if (st.pop() !== t) return 'beklenmeyen </' + t + '>'; } else st.push(t); } return st.length ? 'kapanmamış <' + st.pop() + '>' : ''; }
module.exports = { ortam, yeniSt, fakeDir, fakeFile, bekle, fire, denge };
