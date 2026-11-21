// Küçük DOM: yalnızca bu uygulamanın kullandığı özellikler (test için)
const VOID=new Set(['input','br','img','hr','meta','link']);
const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
class El{
  constructor(tag){ this.tagName=tag.toUpperCase(); this.tag=tag.toLowerCase(); this.attrs={}; this.children=[]; this.parent=null; this._v=undefined; this._chk=false; this.style={}; this._open=false; this.listeners={}; this._text=null; }
  get id(){return this.attrs.id||'';} set id(v){this.attrs.id=v;}
  get className(){return this.attrs.class||'';} set className(v){this.attrs.class=v;}
  get dataset(){ const d={}; for(const k in this.attrs) if(k.startsWith('data-')) d[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=this.attrs[k]; return d; }
  get classList(){ const s=this; return { toggle:(c,f)=>{ const l=(s.attrs.class||'').split(/\s+/).filter(Boolean); const has=l.includes(c); const want=f===undefined?!has:f; const n=l.filter(x=>x!==c); if(want)n.push(c); s.attrs.class=n.join(' '); }, add:c=>{ s.classList.toggle(c,true); }, remove:c=>{ s.classList.toggle(c,false); }, contains:c=>(s.attrs.class||'').split(/\s+/).includes(c) }; }
  get type(){return this.attrs.type||(this.tag==='input'?'text':'');}
  get checked(){ return this._chk; } set checked(v){ this._chk=!!v; }
  get hidden(){ return 'hidden' in this.attrs; } set hidden(v){ if(v) this.attrs.hidden=''; else delete this.attrs.hidden; }
  get disabled(){ return 'disabled' in this.attrs; } set disabled(v){ if(v) this.attrs.disabled=''; else delete this.attrs.disabled; }
  get open(){return this._open;}
  get value(){
    if(this._v!==undefined) return this._v;
    if(this.tag==='select'){ const o=this.querySelectorAll('option'); const s=o.find(x=>'selected' in x.attrs)||o[0]; return s? (s.attrs.value!==undefined? s.attrs.value : s.textContent) : ''; }
    if(this.tag==='textarea') return this.textContent;
    return this.attrs.value!==undefined? this.attrs.value : '';
  }
  set value(v){ this._v=String(v); }
  get textContent(){ if(this._text!==null) return this._text; return this.children.map(c=>c.nodeText!==undefined? c.nodeText : c.textContent).join(''); }
  set textContent(v){ this.children=[]; this._text=String(v); }
  set innerHTML(h){ this._text=null; this.children=[]; parseInto(this,String(h)); }
  get innerHTML(){ return this.children.map(c=>c.nodeText!==undefined? c.nodeText : c.outer()).join(''); }
  outer(){ return `<${this.tag}${Object.entries(this.attrs).map(([k,v])=>` ${k}="${v}"`).join('')}>`+(VOID.has(this.tag)?'':this.innerHTML+`</${this.tag}>`); }
  appendChild(c){ c.parent=this; this.children.push(c); this._text=null; return c; }
  insertAdjacentHTML(pos,h){ parseInto(this,h); }
  remove(){ if(this.parent) this.parent.children=this.parent.children.filter(x=>x!==this); }
  getAttribute(k){ return this.attrs[k]!==undefined? this.attrs[k]:null; }
  showModal(){ this._open=true; } close(){ this._open=false; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  click(){ fire('click',this); }
  closest(sel){ let e=this; while(e&&e.tag){ if(matchList(e,sel)) return e; e=e.parent; } return null; }
  querySelectorAll(sel){ const out=[]; const walk=n=>{ for(const c of n.children){ if(c.tag){ if(matchPath(c,sel,this)) out.push(c); walk(c);} } }; walk(this); return out; }
  querySelector(sel){ return this.querySelectorAll(sel)[0]||null; }
}
function parseInto(parent,html){
  const re=/<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g; let m, cur=parent; const stack=[];
  while((m=re.exec(html))){
    if(m[4]!==undefined){ cur.children.push({nodeText:unesc(m[4]),parent:cur}); continue; }
    const [, close, tag, at]=m; const t=tag.toLowerCase();
    if(close){ if(VOID.has(t)) continue; if(stack.length){ cur=stack.pop(); } continue; }
    const e=new El(t); e.parent=cur;
    at.replace(/\s+([^\s=>\/]+)(?:="([^"]*)")?/g,(_,k,v)=>{ e.attrs[k]=v===undefined?'':unesc(v); });
    if('checked' in e.attrs) e._chk=true;
    cur.children.push(e);
    if(!VOID.has(t)){ stack.push(cur); cur=e; }
  }
}
function matchSimple(e,s){
  s=s.trim(); if(!s) return false;
  const re=/(^[a-z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=([^\]]*))?\]/gi; let m, ok=true, any=false;
  while((m=re.exec(s))){ any=true;
    if(m[1]&&e.tag!==m[1].toLowerCase()) ok=false;
    if(m[2]&&e.id!==m[2]) ok=false;
    if(m[3]&&!(e.attrs.class||'').split(/\s+/).includes(m[3])) ok=false;
    if(m[4]){ const a=e.attrs[m[4]]; if(a===undefined) ok=false; else if(m[5]!==undefined&&a!==m[5].replace(/^["']|["']$/g,'')) ok=false; }
  }
  return any&&ok;
}
const matchList=(e,sel)=>sel.split(',').some(s=>matchSimple(e,s));
function matchPath(e,sel,root){
  return sel.split(',').some(one=>{ const parts=one.trim().split(/\s+/); if(!matchSimple(e,parts[parts.length-1])) return false;
    let i=parts.length-2, p=e.parent; while(i>=0&&p&&p!==root.parent){ if(p.tag&&matchSimple(p,parts[i])) i--; p=p.parent; } return i<0; });
}
const docListeners={};
function fire(type,target,extra){ const ev=Object.assign({type,target,preventDefault(){}},extra||{}); for(const f of (docListeners[type]||[])) f(ev); }
function makeDocument(bodyHtml){
  const root=new El('body'); parseInto(root,bodyHtml);
  const byId=id=>{ const w=n=>{ for(const c of n.children){ if(c.tag){ if(c.id===id) return c; const r=w(c); if(r) return r; } } return null; }; return w(root); };
  const doc={ body:root, readyState:'complete', visibilityState:'visible', title:'',
    getElementById:byId, querySelector:s=>root.querySelector(s), querySelectorAll:s=>root.querySelectorAll(s),
    createElement:t=>new El(t), addEventListener:(t,f)=>{ (docListeners[t]=docListeners[t]||[]).push(f); } };
  return doc;
}
module.exports={El,parseInto,makeDocument,fire,docListeners};
