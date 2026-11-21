
// ============================ ARAYÜZ BAŞLA ============================
const ui = { sayfa: 'panel', tab: {}, f: { hr: { bas: '', bit: '', tip: '', kart: '' }, stok: { donem: 'ay', bas: '', bit: '', gizle: true, uyari: false }, analiz: { bas: '', bit: '' }, seg: {}, ham: false, stoklu: true, log: { bas: '', bit: '', kadi: '', islem: '' } } };
const $ = id => document.getElementById(id);
const val = id => { const e = $(id); return e ? e.value : ''; };
const SAYFALAR = [['panel', '🏠', 'Panel'], ['alis', '📥', 'Alış'], ['uretim', '⚙️', 'Üretim'], ['satis', '💰', 'Satış'], ['zayiat', '🗑️', 'Zayiat'],
  ['stok', '📦', 'Stok'], ['hareket', '📝', 'Hareketler'], ['sayim', '🧮', 'Sayım'], ['analiz', '📈', 'Analiz'], ['kartlar', '🗂️', 'Kartlar'], ['ayar', '🔧', 'Ayarlar']];

// ---------- küçük HTML yardımcıları ----------
const chip = (t, k) => `<span class="chip ${k || ''}">${t}</span>`;
const durumChip = d => chip(DURUM_AD[d], { eksi: 'er', bitti: 'mut', dusuk: 'wr', var: 'ok' }[d]);
const takribiEt = '<span class="tk" title="Takribi: girilmeyen satış fiyatları ortalama maliyet × (1 + kâr oranı) ile tahmin edilir">takribi</span>';
function tablo(kol, satirlar, opt = {}) {
  return `<div class="tw"><table class="tbl"${opt.id ? ` id="${opt.id}"` : ''}><thead><tr>${kol.map(k => `<th class="${k.c || ''}">${k.b}</th>`).join('')}</tr></thead><tbody>` +
    satirlar.map(r => `<tr ${opt.attr ? opt.attr(r) : ''}>${kol.map(k => `<td class="${k.c || ''}">${k.f(r)}</td>`).join('')}</tr>`).join('') +
    `</tbody>${opt.alt ? `<tfoot>${opt.alt}</tfoot>` : ''}</table></div>`;
}
const bos = m => `<div class="bos">${m}</div>`;
const kpi = (b, d, alt, ek) => `<div class="kpi"><div class="kb">${b}${ek || ''}</div><div class="kd">${d}</div><div class="ka">${alt || ''}</div></div>`;
const baslik = (ikon, ad, alt) => `<h1>${ikon} ${ad}</h1><p class="sub">${alt || ''}</p>`;
const secenek = (liste, secili) => liste.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(secili) ? ' selected' : ''}>${esc(t)}</option>`).join('');
const sekmeler = (id, liste) => { const a = ui.tab[id] || liste[0][0]; return `<div class="tabs">${liste.map(([k, t]) => `<button class="tab${k === a ? ' on' : ''}" data-act="sekme" data-g="${id}" data-k="${k}">${t}</button>`).join('')}</div>`; };
const aktifSekme = (id, ilk) => ui.tab[id] || ilk;
const sagBtn = (act, id, ikon, baslikT) => `<button class="ib" data-act="${act}" data-id="${esc(id)}" title="${baslikT}">${ikon}</button>`;
const bar = (p, k) => `<div class="bar"><span class="${k || ''}" style="width:${Math.max(0, Math.min(100, p || 0))}%"></span></div>`;
const kartEtiket = k => `${esc(k.ad)}${k.kat ? `<div class="alt">${esc(k.kat)}</div>` : ''}`;
const gSeg = (id, ek) => { const a = ui.f.seg[id] || 'all'; return `<div class="seg" id="seg-${id}">${[['all', 'Tümü'], ...GRUPLAR.filter(g => !ek || ek.includes(g)).map(g => [g, GRUP_KISA[g]])].map(([v, t]) => `<button data-act="seg" data-t="${id}" data-v="${v}" class="${a === v ? 'on' : ''}">${t}</button>`).join('')}</div>`; };
const sonAlisFiyat = () => memoize('sonalis', () => { const m = new Map(); for (const r of sirali(aktif())) if (r.tip === 'ALIS' && r.bm > 0) m.set(r.kart, r.bm); return m; });
const sonSatisFiyat = () => memoize('sonsatis', () => { const m = new Map(); for (const r of sirali(aktif())) if (r.tip === 'SATIS' && r.fiyat > 0) m.set(r.kart, r.fiyat); return m; });
const kartSecim = (gruplar, sec) => secenek([['', '— seçin —'], ...kartlarSirali().filter(k => gruplar.includes(k.grup)).map(k => [k.id, `${k.ad} (${k.birim}) · stok ${mikF(canli(k.id).net)}`])], sec);

function filtreUygula(tid) {
  const t = $('tb-' + tid); if (!t) return;
  const q = trLower(val('ara-' + tid)), g = ui.f.seg[tid] || 'all';
  t.querySelectorAll('tbody tr').forEach(tr => { tr.hidden = !((!q || (tr.dataset.ad || '').includes(q)) && (g === 'all' || tr.dataset.grup === g)); });
}
const girisUst = (tid, ek) => `<div class="satir"><label class="ara">Ara<input id="ara-${tid}" data-filtre="${tid}" placeholder="Ürün ara…" autocomplete="off"></label>${ek || ''}</div>`;

// ============================ SAYFALAR ============================
const SAYFA = {};

// ---------- PANEL ----------
function bosPanel() {
  return baslik('👋', 'Hoş geldiniz', 'Stok, üretim ve satışınızı kolayca takip edin.') + `<div class="card">
<ol class="adim"><li><b>Kartlar</b> sayfasında stok kartlarınızı açın: <i>Ham</i> (üretime giren), <i>Mamül</i> (ürettiğiniz), <i>Ticari</i> (aynen alıp sattığınız).</li>
<li><b>Alış</b> ile gelen malı girin (isterseniz birim fiyatıyla — maliyet ve takribi kâr hesabı için).</li>
<li><b>Üretim</b> ile ham maddeyi mamüle çevirin (yan ürün ve fire dahil), <b>Satış</b> ile satılanı girin.</li>
<li><b>Stok</b> sayfasında Devir + Gelen − Giden = Kalan'ı görün.</li></ol>
<p class="mut">Verileriniz bu bilgisayarın tarayıcısında saklanır ve <b>Ayarlar → Yedekleme</b>'den seçeceğiniz klasöre her değişiklikte otomatik yedeklenir. Önce yedek klasörünü seçmenizi öneririm.</p>
<div class="satir"><button class="btn pri" data-act="git" data-p="kartlar">Kart oluşturmaya başla</button><button class="btn" data-act="ayar-git">Yedek klasörü seç</button><button class="btn gh" data-act="ornek">Örnek veriyle dene</button><button class="btn gh" data-act="yedek-ac">Yedekten aç…</button></div></div>`;
}
function panelYedekSatiri() {
  if (!izin('ayar')) return '';
  const d = Kayit.yedekDurumu(), el = Kayit.sonIndirme ? ` · son elle indirilen yedek: ${saatMetni(Kayit.sonIndirme)}` : '';
  const t = d.kod === 'tamam' ? `💾 Yedek ${Klasor.tur === 'dosya' ? '📄 dosyası' : '📁 klasörü'} “${esc(Klasor.ad)}” — son yazım: <b>${saatMetni(Klasor.sonYazma)}</b>${el}`
    : `⚠️ Yedek konumu hazır değil — veriler yalnızca bu tarayıcıda${el}. <a href="#ayar" data-act="ayar-git">Ayarlar → Yedekleme</a>`;
  return `<p class="${d.kod === 'tamam' ? 'mut' : ''} kucuk" style="margin:-6px 0 10px">${t}</p>`;
}
SAYFA.panel = () => {
  if (!db.kartlar.length) return bosPanel();
  const sd = stokDegerleri(), bu = bugun(), m = maliOzet(gunEkle(bu, -29), bu);
  const top = GRUPLAR.reduce((a, g) => a + sd[g].deger, 0), pot = sd.TICARI.takribi + sd.MAMUL.takribi;
  const ky = uyarilar(), ms = maliyetsizKartlar();
  const bd = [...defter(bu, bu).values()].filter(x => x.kart.aktif !== false && (x.gelen || x.satilan || x.kullanilan || x.diger));
  const satirlar = [
    ['Satın alma (alış) tutarı', tl(m.alis), ''], ['Satılan malın maliyeti', tl(m.satisMal), ''],
    ['Ciro — girilen fiyatlarla', tl(m.ciroG), 'gerçek'], ['Ciro — girilmeyenler (takribi)', tl(m.ciroT), 'takribi'],
    ['Toplam ciro', tl(m.ciro), 'b'], ['Brüt kâr', tl(m.kar), 'b'], ['Kâr oranı', yuzde(m.marj), ''],
    ['Zayiat / ikram maliyeti', '− ' + tl(m.zay), ''], ['Sayım farkı (net)', (m.sayFaz - m.sayEks >= 0 ? '+ ' : '− ') + tl(Math.abs(m.sayFaz - m.sayEks)), ''],
    ['Kayıplar sonrası takribi kâr', tl(m.net), 'b']];
  return baslik('🏠', esc(db.firma), 'Bugünün durumu ve takribi mali özet.') + panelYedekSatiri() +
    `<div class="grid g4">${kpi('Stok değeri', tl(top), `Ticari ${tl(sd.TICARI.deger)} · Ham ${tl(sd.HAM.deger)} · Mamül ${tl(sd.MAMUL.deger)}`, ' <small>(maliyet)</small>')}
${kpi('Potansiyel satış değeri', tl(pot), `Mamül + ticari stok, %${nf0.format(+db.ayar.kar || 0)} genel kâr oranıyla`, ' ' + takribiEt)}
${kpi('Son 30 gün ciro', tl(m.ciro), `girilen ${tl(m.ciroG)} · takribi ${tl(m.ciroT)}`)}
${kpi('Son 30 gün brüt kâr', tl(m.kar), 'Kâr oranı ' + yuzde(m.marj), ' ' + takribiEt)}</div>
<div class="cols"><div class="card"><h3>Son 30 gün — mali özet ${takribiEt}</h3>
<table class="tbl mali"><tbody>${satirlar.map(([a, b, c]) => `<tr class="${c === 'b' ? 'kalin' : ''}"><td>${a}${c === 'takribi' ? ' ' + takribiEt : ''}</td><td class="sag">${b}</td></tr>`).join('')}</tbody></table>
<p class="mut kucuk">Satış fiyatı girilen kalemler gerçek ciro sayılır. Girilmeyenler <i>ortalama maliyet × (1 + kâr oranı)</i> ile tahmin edilir; oran Ayarlar'dan (genel) veya Kartlar'dan (ürün bazında) değiştirilir.</p></div>
<div class="card"><h3>⚠️ Dikkat edilecekler</h3>${(!ky.length && !ms.length) ? '<p class="mut">Asgari seviyenin altında, eksi stoklu veya maliyeti girilmemiş kart yok. ✅</p>' :
      `<ul class="uyl">${ky.map(({ d, x }) => `<li>${durumChip(d)} <b>${esc(x.kart.ad)}</b> — kalan ${mikF(x.kalan)} ${esc(x.kart.birim)}${d === 'dusuk' ? ` (asgari ${mikF(x.kart.asgari)})` : ''}</li>`).join('')}
${ms.length ? `<li>${chip('Maliyet yok', 'wr')} ${ms.slice(0, 6).map(k => esc(k.ad)).join(', ')}${ms.length > 6 ? '…' : ''} — alış fiyatı girilmediği için maliyet/kâr hesapları eksik kalır.</li>` : ''}</ul>`}</div></div>
<div class="card"><h3>Bugün (${trTarih(bu)}) — gelen / giden / kalan</h3>${bd.length ? tablo([
      { b: 'Ürün', f: x => kartEtiket(x.kart) }, { b: 'Birim', f: x => esc(x.kart.birim) }, { b: 'Devir', c: 'sag', f: x => mikF(x.devir) },
      { b: 'Gelen', c: 'sag', f: x => mikF(x.gelen) }, { b: 'Satılan', c: 'sag', f: x => mikF(x.satilan) }, { b: 'Üretimde kullanılan', c: 'sag', f: x => mikF(x.kullanilan) },
      { b: 'Diğer çıkış', c: 'sag', f: x => mikF(x.diger) }, { b: 'Kalan', c: 'sag kalin', f: x => mikF(x.kalan) }], bd) : bos('Bugün henüz hareket yok. Alış, Üretim veya Satış sayfasından kayıt girin.')}</div>
<details class="card"><summary>Nasıl çalışır?</summary><div class="yardim">
<p><b>Ticari:</b> Alış (gelen) → Satış (giden) → Kalan. &nbsp; <b>Ham:</b> Alış (gelen) → Üretimde kullanılan (giden) → Kalan. &nbsp; <b>Mamül:</b> Üretilen (gelen) → Satılan (giden) → Kalan.</p>
<p><b>Maliyet:</b> Alışta birim fiyat girerseniz hareketli ortalama maliyet hesaplanır. Üretimde girdi maliyeti mamüle ve yan ürüne dağıtılır. <b>Takribi kâr:</b> satış fiyatı girmezseniz ortalama maliyete kâr oranı eklenerek tahmin edilir.</p>
<p><b>Hata yaparsam?</b> Hareketler → satırı düzenleyin/silin (silinenler Arşiv'den geri alınır); yanlış üretimi Üretim → Geçmiş'ten iptal edin; raf farkını Sayım ile düzeltin.</p></div></details>`;
};

// ---------- ALIŞ ----------
SAYFA.alis = () => {
  const kk = kartlarSirali().filter(k => k.grup !== 'MAMUL');
  if (!kk.length) return baslik('📥', 'Alış / Gelen', 'Satın aldığınız ham madde ve ticari ürünleri stoğa ekleyin.') + bos('Önce <b>Kartlar</b> sayfasından Ham veya Ticari kart açın.');
  const d = defter(null, null), sf = sonAlisFiyat();
  const sat = k => { const x = d.get(k.id), son = sf.get(k.id) || 0;
    return `<tr data-kart="${k.id}" data-grup="${k.grup}" data-ad="${esc(trLower(k.ad + ' ' + k.kat))}" data-ort="${x.ort}">
<td>${kartEtiket(k)}</td><td>${esc(k.birim)}</td><td class="sag">${mikF(x.kalan)}</td><td class="sag">${x.ort > 0 ? tl(x.ort) : '—'}</td>
<td class="sag"><input class="in sag" data-f="mik" inputmode="decimal" placeholder="0" autocomplete="off"></td>
<td class="sag"><input class="in sag" data-f="fy" inputmode="decimal" placeholder="0,00" value="${son && izin('mali') ? String(son).replace('.', ',') : ''}" autocomplete="off"></td>
<td class="sag" data-f="tut"></td><td class="uy" data-f="uy"></td></tr>`; };
  return baslik('📥', 'Alış / Gelen', 'Gelen malın miktarını (ve varsa birim fiyatını) yazın; boş satırlar kaydedilmez. Birim fiyat maliyeti ve takribi kârı hesaplar.') +
    `<div class="card" data-live="alis"><div class="satir"><label>Tarih<input type="date" id="al-t" value="${bugun()}"></label>
<label class="gen">Tedarikçi / fatura no<input id="al-not" placeholder="isteğe bağlı" autocomplete="off"></label>
<label class="ara">Ara<input id="ara-al" data-filtre="al" placeholder="Ürün ara…" autocomplete="off"></label>${gSeg('al', ['HAM', 'TICARI'])}</div>
<div class="tw"><table class="tbl" id="tb-al"><thead><tr><th>Ürün</th><th>Birim</th><th class="sag">Mevcut</th><th class="sag">Ort. maliyet</th><th class="sag">Miktar</th><th class="sag">Birim fiyat (₺)</th><th class="sag">Tutar</th><th></th></tr></thead><tbody>${kk.map(sat).join('')}</tbody></table></div>
<div class="altbar"><span id="al-ozet" class="mut">Henüz miktar girilmedi.</span><button class="btn pri" data-act="alis-kaydet">Stoğa ekle</button></div></div>`;
};
function liveAlis() {
  const m = izin('mali'); let n = 0, top = 0;
  document.querySelectorAll('#tb-al tbody tr').forEach(tr => {
    const fyEl = tr.querySelector('[data-f=fy]'), tut = tr.querySelector('[data-f=tut]'), uy = tr.querySelector('[data-f=uy]');
    const mik = sayiOku(tr.querySelector('[data-f=mik]').value), fy = fyEl ? sayiOku(fyEl.value) : NaN, ort = +tr.dataset.ort;
    if (gecerli(mik)) {
      n++; const t = gecerli(fy) ? mik * fy : 0; top += t;
      if (tut) tut.textContent = gecerli(fy) ? tl(t) : '—';
      if (uy) uy.textContent = (gecerli(fy) && ort > 0 && Math.abs(fy / ort - 1) > 0.2) ? `ort.'a göre ${fy > ort ? '+' : '−'}%${nf0.format(Math.abs(fy / ort - 1) * 100)}` : (!gecerli(fy) ? 'fiyat yok → ort. kullanılır' : '');
    } else { if (tut) tut.textContent = ''; if (uy) uy.textContent = ''; }
  });
  $('al-ozet').innerHTML = n ? `<b>${n}</b> kalem${m ? ` · toplam alış <b>${tl(top)}</b>` : ''}` : 'Henüz miktar girilmedi.';
}

// ---------- SATIŞ ----------
SAYFA.satis = () => {
  const gr = ['MAMUL', 'TICARI'].concat(ui.f.ham ? ['HAM'] : []);
  const d = defter(null, null), sf = sonSatisFiyat();
  const kk = kartlarSirali().filter(k => gr.includes(k.grup) && (!ui.f.stoklu || d.get(k.id).kalan > 0.0009));
  const ust = baslik('💰', 'Satış / Giden', 'Satılan miktarı yazın. Satış fiyatı girmezseniz takribi fiyat (ortalama maliyet + kâr oranı) kullanılır.');
  if (!kartlarSirali().some(k => ['MAMUL', 'TICARI'].includes(k.grup))) return ust + bos('Satılacak <b>Mamül</b> veya <b>Ticari</b> kart yok. Önce Kartlar sayfasından açın.');
  const sat = k => { const x = d.get(k.id), tk = takribiFiyat(x.ort, k), son = sf.get(k.id);
    return `<tr data-kart="${k.id}" data-grup="${k.grup}" data-ad="${esc(trLower(k.ad + ' ' + k.kat))}" data-net="${x.kalan}" data-ort="${x.ort}" data-tk="${tk}">
<td>${kartEtiket(k)}</td><td>${esc(k.birim)}</td><td class="sag">${mikF(x.kalan)}</td><td class="sag">${x.ort > 0 ? tl(x.ort) : '—'}</td>
<td class="sag mut">${x.ort > 0 ? tl(tk) : '—'}</td>
<td class="sag"><input class="in sag" data-f="mik" inputmode="decimal" placeholder="0" autocomplete="off"></td>
<td class="sag"><input class="in sag" data-f="fy" inputmode="decimal" placeholder="${x.ort > 0 && izin('mali') ? fmt(tk) : '0,00'}" value="${son ? String(son).replace('.', ',') : ''}" autocomplete="off"></td>
<td class="sag" data-f="tut"></td><td class="uy" data-f="uy"></td></tr>`; };
  return ust + `<div class="card" data-live="satis"><div class="satir"><label>Tarih<input type="date" id="sa-t" value="${bugun()}"></label>
<label class="gen">Not<input id="sa-not" placeholder="müşteri, şube… (isteğe bağlı)" autocomplete="off"></label>
<label class="ara">Ara<input id="ara-sa" data-filtre="sa" placeholder="Ürün ara…" autocomplete="off"></label>${gSeg('sa', gr)}
<label class="chk"><input type="checkbox" data-set="ham" ${ui.f.ham ? 'checked' : ''}> Ham ürünleri de göster</label><label class="chk"><input type="checkbox" data-set="stoklu" ${ui.f.stoklu ? 'checked' : ''}> Sadece stoğu olanlar</label></div>
${kk.length ? `<div class="tw"><table class="tbl" id="tb-sa"><thead><tr><th>Ürün</th><th>Birim</th><th class="sag">Stok</th><th class="sag">Ort. maliyet</th><th class="sag">Takribi fiyat</th><th class="sag">Miktar</th><th class="sag">Satış fiyatı (₺)</th><th class="sag">Tutar</th><th></th></tr></thead><tbody>${kk.map(sat).join('')}</tbody></table></div>` : bos('Satılabilecek stoklu ürün yok. Alış veya Üretim yapın; ya da "Sadece stoğu olanlar"ı kapatın.')}
<div class="altbar"><span id="sa-ozet" class="mut">Henüz miktar girilmedi.</span><button class="btn pri" data-act="satis-kaydet" id="sa-btn">Satışları kaydet</button></div></div>`;
};
function liveSatis() {
  const m = izin('mali'); let n = 0, ciro = 0, mal = 0, tk = 0, hata = 0;
  document.querySelectorAll('#tb-sa tbody tr').forEach(tr => {
    const mik = sayiOku(tr.querySelector('[data-f=mik]').value), fy = sayiOku(tr.querySelector('[data-f=fy]').value);
    const net = +tr.dataset.net, ort = +tr.dataset.ort, tkf = +tr.dataset.tk;
    const tut = tr.querySelector('[data-f=tut]'), uy = tr.querySelector('[data-f=uy]');
    if (gecerli(mik)) {
      n++; const gercek = gecerli(fy), t = gercek ? mik * fy : (m ? mik * tkf : 0);
      ciro += t; mal += mik * ort; if (!gercek) tk += t;
      if (tut) tut.innerHTML = gercek ? tl(t) : (m ? '<span class="tk">~</span> ' + tl(t) : '—');
      const yet = mik > net + 0.001; if (yet) hata++;
      if (uy) { uy.textContent = yet ? 'stok yetersiz' : ''; uy.className = yet ? 'uy er' : 'uy'; }
    } else { if (tut) tut.textContent = ''; if (uy) { uy.textContent = ''; uy.className = 'uy'; } }
  });
  const el = $('sa-ozet'); if (!el) return;
  el.innerHTML = n ? (m ? `<b>${n}</b> kalem · ciro <b>${tl(ciro)}</b>${tk > 0 ? ` (${tl(tk)} takribi)` : ''} · maliyet ${tl(mal)} · kâr <b>${tl(ciro - mal)}</b> ${tk > 0 ? takribiEt : ''}` : `<b>${n}</b> kalem satılacak`) : 'Henüz miktar girilmedi.';
  const b = $('sa-btn'); if (b) b.disabled = hata > 0;
}

// ---------- ZAYİAT ----------
SAYFA.zayiat = () => {
  const d = defter(null, null);
  const kk = kartlarSirali().filter(k => d.get(k.id).kalan > 0.0009);
  const t1 = `<div class="card" data-live="zayiat"><div class="satir"><label>Tarih<input type="date" id="za-t" value="${bugun()}"></label>
<label>Neden<select id="za-neden">${secenek(ZAYIAT_NEDEN.map(x => [x, x]))}</select></label><label class="gen">Not<input id="za-not" placeholder="isteğe bağlı" autocomplete="off"></label>
<label class="ara">Ara<input id="ara-za" data-filtre="za" placeholder="Ürün ara…" autocomplete="off"></label></div>
${kk.length ? `<div class="tw"><table class="tbl" id="tb-za"><thead><tr><th>Ürün</th><th>Grup</th><th>Birim</th><th class="sag">Stok</th><th class="sag">Ort. maliyet</th><th class="sag">Miktar</th><th class="sag">Kayıp değeri</th><th></th></tr></thead><tbody>${kk.map(k => { const x = d.get(k.id);
    return `<tr data-kart="${k.id}" data-grup="${k.grup}" data-ad="${esc(trLower(k.ad + ' ' + k.kat))}" data-net="${x.kalan}" data-ort="${x.ort}"><td>${kartEtiket(k)}</td><td>${GRUP_KISA[k.grup]}</td><td>${esc(k.birim)}</td><td class="sag">${mikF(x.kalan)}</td><td class="sag">${x.ort > 0 ? tl(x.ort) : '—'}</td>
<td class="sag"><input class="in sag" data-f="mik" inputmode="decimal" placeholder="0" autocomplete="off"></td><td class="sag" data-f="tut"></td><td class="uy" data-f="uy"></td></tr>`; }).join('')}</tbody></table></div>` : bos('Stoğu olan kart yok.')}
<div class="altbar"><span id="za-ozet" class="mut">Henüz miktar girilmedi.</span><button class="btn pri" data-act="zayiat-kaydet" id="za-btn">Stoktan düş</button></div></div>`;
  const ay = ui.f.analiz; const bu = bugun();
  const z = aktif().filter(r => r.tip === 'ZAYIAT').sort((a, b) => (a.t < b.t ? 1 : -1) || b.id - a.id).slice(0, 200);
  const t2 = z.length ? tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Ürün', f: r => esc(kartAd(r.kart)) }, { b: 'Miktar', c: 'sag', f: r => `${mikF(r.mik)} ${esc(kartBirim(r.kart))}` },
    { b: 'Değer', c: 'sag', f: r => tl(r.mik * r.bm) }, { b: 'Neden', f: r => esc(r.neden) }, { b: 'Not', f: r => esc(r.not) },
    { b: '', f: r => izin('duzelt') ? sagBtn('hr-sil', r.id, '🗑️', 'Sil') : '' }], z) : bos('Henüz zayiat kaydı yok.');
  return baslik('🗑️', 'Zayiat / İkram', 'Satış dışı çıkışlar: bozulan, dökülen, ikram, personel yemeği. Stoktan düşer, kayıp olarak raporlanır.') +
    sekmeler('za', [['kayit', '➕ Kayıt'], ['gecmis', '📋 Geçmiş']]) + (aktifSekme('za', 'kayit') === 'kayit' ? t1 : `<div class="card">${t2}</div>`);
};
function liveZayiat() {
  const m = izin('mali'); let n = 0, top = 0, hata = 0;
  document.querySelectorAll('#tb-za tbody tr').forEach(tr => {
    const mik = sayiOku(tr.querySelector('[data-f=mik]').value), net = +tr.dataset.net, ort = +tr.dataset.ort;
    const tut = tr.querySelector('[data-f=tut]'), uy = tr.querySelector('[data-f=uy]');
    if (gecerli(mik)) { n++; top += mik * ort; if (tut) tut.textContent = tl(mik * ort); const yet = mik > net + 0.001; if (yet) hata++; if (uy) { uy.textContent = yet ? 'stok yetersiz' : ''; uy.className = yet ? 'uy er' : 'uy'; } }
    else { if (tut) tut.textContent = ''; if (uy) { uy.textContent = ''; uy.className = 'uy'; } }
  });
  const el = $('za-ozet'); if (!el) return;
  el.innerHTML = n ? `<b>${n}</b> kalem${m ? ` · kayıp değeri <b>${tl(top)}</b>` : ''}` : 'Henüz miktar girilmedi.';
  const b = $('za-btn'); if (b) b.disabled = hata > 0;
}

// ---------- ÜRETİM ----------
function uretimSatiri(tur, secili) {
  const gr = tur === 'c' ? ['MAMUL'] : ['HAM', 'MAMUL'];
  return `<div class="dr"><select data-f="kart">${kartSecim(gr, secili)}</select><input class="in sag" data-f="mik" inputmode="decimal" placeholder="Miktar" autocomplete="off">
${tur === 'y' && izin('mali') ? '<input class="in sag" data-f="deger" inputmode="decimal" placeholder="Birim değer ₺ (ops.)" autocomplete="off">' : ''}<button class="ib" data-act="ur-sil" title="Satırı kaldır">✕</button></div>`;
}
SAYFA.uretim = () => {
  const ust = baslik('⚙️', 'Üretim', 'Ham maddeyi işleyip mamül üretin. Birden çok girdi, yan ürün ve fire aynı ekranda; ham stok düşer, mamül stok artar.');
  const sek = sekmeler('ur', [['yeni', '🚀 Yeni üretim'], ['gecmis', '📋 Geçmiş / iptal']]);
  if (aktifSekme('ur', 'yeni') === 'gecmis') {
    const s = uretimSeanslari();
    return ust + sek + `<div class="card">${s.length ? tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Girdi', f: r => esc(r.girdi) }, { b: 'Mamül', f: r => esc(r.cikti) }, { b: 'Yan ürün', f: r => esc(r.yan) || '—' },
      { b: 'Girdi', c: 'sag', f: r => mikF(r.G) }, { b: 'Mamül', c: 'sag', f: r => mikF(r.M) }, { b: 'Yan', c: 'sag', f: r => mikF(r.Y) }, { b: 'Fire', c: 'sag', f: r => mikF(r.F) },
      { b: 'Randıman', c: 'sag', f: r => isNaN(r.randiman) ? '—' : yuzde(r.randiman) }, { b: 'Girdi maliyeti', c: 'sag', f: r => tl(r.maliyet) },
      { b: '', f: r => !izin('duzelt') ? '' : `<button class="btn kucuk dng" data-act="seans-iptal" data-id="${esc(r.kod)}">İptal et</button>` }], s) : bos('Henüz üretim kaydı yok.')}
<p class="mut kucuk">İptal edilen üretimin tüm hareketleri (ham çıkış, mamül, yan ürün, fire) arşive taşınır ve stoklar eski haline döner. Üretilen mamül satıldıysa iptal edilemez.</p></div>`;
  }
  const hamVar = kartlarSirali().some(k => k.grup === 'HAM'), mamVar = kartlarSirali().some(k => k.grup === 'MAMUL');
  if (!hamVar || !mamVar) return ust + sek + bos('Üretim için en az bir <b>Ham</b> ve bir <b>Mamül</b> kartı gerekir (Kartlar sayfası).');
  return ust + sek + `<div class="card" data-live="uretim"><div class="satir"><label>Tarih<input type="date" id="ur-t" value="${bugun()}"></label><label class="gen">Not<input id="ur-not" placeholder="vardiya, parti… (isteğe bağlı)" autocomplete="off"></label></div>
<h3>1) Girdiler <small>— üretime giren ham madde</small></h3><div id="ur-g" class="dyn">${uretimSatiri('g')}</div><button class="btn kucuk" data-act="ur-ekle" data-s="g">＋ Girdi ekle</button>
<h3>2) Çıkan mamül</h3><div id="ur-c" class="dyn">${uretimSatiri('c')}</div><button class="btn kucuk" data-act="ur-ekle" data-s="c">＋ Mamül ekle</button>
<h3>3) Yan ürün <small>— isteğe bağlı (kırpıntı, kemik, yağ…)</small></h3>
<p class="mut kucuk">Ham kartı seçerseniz ham stoğa girer ve sonraki üretimde girdi olabilir; mamül kartı seçerseniz satılabilir stok olur. Birim değer girerseniz mamülün maliyetinden düşülür.</p>
<div id="ur-y" class="dyn"></div><button class="btn kucuk" data-act="ur-ekle" data-s="y">＋ Yan ürün ekle</button>
<div id="ur-firebox" class="satir" style="display:none"><label>Fire (elle) <input class="in sag" id="ur-fire" inputmode="decimal" placeholder="0"></label><span class="mut kucuk">Girdi ve çıktıların birimleri farklı olduğu için fire otomatik hesaplanamadı.</span></div>
<div id="ur-onizle" class="onizle"></div><div class="altbar"><span></span><button class="btn pri" data-act="uretim-kaydet" id="ur-btn" disabled>Üretimi kaydet</button></div></div>`;
};
function okuSatirlar(secId, yan) {
  return [...document.querySelectorAll(`#${secId} .dr`)].map(r => ({ kart: +r.querySelector('[data-f=kart]').value || 0, mik: sayiOku(r.querySelector('[data-f=mik]').value),
    deger: yan && r.querySelector('[data-f=deger]') ? sayiOku(r.querySelector('[data-f=deger]').value) : undefined }));
}
function liveUretim() {
  const el = $('ur-onizle'); if (!el) return;
  const mm = izin('mali');
  const g = okuSatirlar('ur-g'), c = okuSatirlar('ur-c'), y = okuSatirlar('ur-y', true);
  const o = uretimOnizle(g, c, y, sayiOku(val('ur-fire')));
  $('ur-firebox').style.display = (o.girdiler.length && o.ciktilar.length && !o.ayni) ? 'flex' : 'none';
  const btn = $('ur-btn');
  if (!o.girdiler.length || !o.ciktilar.length) { el.innerHTML = '<span class="mut">Önizleme için en az bir girdi ve bir mamül satırı doldurun.</span>'; btn.disabled = true; return; }
  const b = o.ayni ? ' ' + o.birimler[0] : '', sd = d => `<span class="oz"><small>${d[0]}</small><b>${d[1]}</b></span>`;
  const mamTk = o.ciktilar.map(x => `${esc(kartAd(x.kart))}: maliyet ${tl(o.birimMaliyet)}/${esc(kartBirim(x.kart))} · takribi satış ${tl(takribiFiyat(o.birimMaliyet, K(x.kart)))}`).join(' &nbsp;|&nbsp; ');
  el.innerHTML = `<div class="ozs">${sd(['Girdi', o.ayni ? mikF(o.G) + b : '—'])}${sd(['Mamül', o.ayni ? mikF(o.M) + b : '—'])}${sd(['Yan ürün', o.ayni ? mikF(o.Y) + b : '—'])}${sd(['Fire', mikF(o.fire) + b])}${sd(['Randıman', isNaN(o.randiman) ? '—' : yuzde(o.randiman)])}</div>
${mm ? `<div class="ozs">${sd(['Girdi maliyeti', tl(o.maliyet)])}${sd(['− Yan ürün değeri', tl(o.kredi)])}${sd(['Mamülün net maliyeti', tl(o.net)])}</div><div class="mut kucuk">${mamTk} ${takribiEt}</div>` : ''}
${o.fazla > 0 ? `<div class="not">Çıkan toplam girdiden ${mikF(o.fazla)}${b} fazla (su/katkı eklendiyse normaldir). Fire 0 kabul edilir.</div>` : ''}
${mm && o.maliyet <= 0 ? '<div class="not">Girdilerin maliyeti 0 ₺ görünüyor (alışlarda fiyat girilmemiş). Mamül maliyeti de 0 ₺ olacak.</div>' : ''}
${o.stokHata.length ? `<div class="not er">Stok yetersiz: ${o.stokHata.map(esc).join(' | ')}</div>` : ''}`;
  btn.disabled = o.stokHata.length > 0;
}

// ---------- STOK ----------
SAYFA.stok = () => {
  const bu = bugun(), S = ui.f.stok;
  let bas = null, bit = null;
  if (S.donem === 'bugun') { bas = bit = bu; } else if (S.donem === 'hafta') { bas = gunEkle(bu, -6); bit = bu; } else if (S.donem === 'ay') { bas = bu.slice(0, 8) + '01'; bit = bu; }
  else if (S.donem === 'aralik') { bas = S.bas || bu.slice(0, 8) + '01'; bit = S.bit || bu; }
  const ust = baslik('📦', 'Stok durumu', 'Devir + Gelen − Giden = Kalan. Maliyet ve takribi satış değeriyle birlikte.');
  if (!db.kartlar.length) return ust + bos('Henüz stok kartı yok. <b>Kartlar</b> sayfasından ekleyin.');
  const d = defter(bas, bit);
  const liste = kartlarSirali().map(k => d.get(k.id)).filter(x => !S.gizle || [x.devir, x.gelen, x.satilan, x.kullanilan, x.diger, x.kalan].some(v => Math.abs(v) > 0.0009))
    .filter(x => !S.uyari || ['eksi', 'dusuk'].includes(durumKodu(x)));
  const donemSec = `<div class="satir"><label>Dönem<select data-set="stok.donem">${secenek([['bugun', 'Bugün'], ['hafta', 'Son 7 gün'], ['ay', 'Bu ay'], ['tum', 'Tümü'], ['aralik', 'Tarih aralığı']], S.donem)}</select></label>
${S.donem === 'aralik' ? `<label>Başlangıç<input type="date" data-set="stok.bas" value="${bas}"></label><label>Bitiş<input type="date" data-set="stok.bit" value="${bit}"></label>` : ''}
<label class="ara">Ara<input id="ara-st" data-filtre="st" placeholder="Ürün ara…" autocomplete="off"></label>
<label class="chk"><input type="checkbox" data-set="stok.gizle" ${S.gizle ? 'checked' : ''}> Hareketsiz ve stoğu 0 olanları gizle</label><label class="chk"><input type="checkbox" data-set="stok.uyari" ${S.uyari ? 'checked' : ''}> Sadece uyarılılar</label>
<button class="btn" data-act="csv-stok">⬇ Excel (CSV)</button></div>`;
  const sd = stokDegerleri();
  const kpis = `<div class="grid g4">${GRUPLAR.map(g => kpi(`${GRUP_IKON[g]} ${GRUP_AD[g]}`, `${sd[g].n} kalem stokta`, (izin('mali') ? `Değer ${tl(sd[g].deger)}${g !== 'HAM' ? ` · takribi satış ${tl(sd[g].takribi)}` : ''}` : ''))).join('')}${kpi('⚠️ Dikkat', uyarilar().length + ' kart', 'asgari altı veya eksi stok')}</div>`;
  const tabId = aktifSekme('st', 'TICARI');
  const sek = sekmeler('st', [['TICARI', `${GRUP_IKON.TICARI} Ticari`], ['HAM', `${GRUP_IKON.HAM} Ham`], ['MAMUL', `${GRUP_IKON.MAMUL} Mamül`], ['TUM', '📋 Tümü'], ['SIP', '🛍️ Sipariş listesi']]);
  let govde;
  if (tabId === 'SIP') {
    const sp = siparisListesi();
    govde = sp.length ? tablo([{ b: 'Ürün', f: r => kartEtiket(r.kart) }, { b: 'Grup', f: r => GRUP_KISA[r.kart.grup] }, { b: 'Birim', f: r => esc(r.kart.birim) },
      { b: 'Mevcut', c: 'sag', f: r => mikF(r.kalan) }, { b: 'Asgari', c: 'sag', f: r => mikF(r.asgari) }, { b: 'Önerilen miktar', c: 'sag kalin', f: r => mikF(r.oner) },
      { b: 'Son ort. maliyet', c: 'sag', f: r => r.ort > 0 ? tl(r.ort) : '—' }, { b: 'Tahmini tutar', c: 'sag', f: r => r.ort > 0 ? tl(r.tutar) : '—' }], sp,
      { alt: `<tr><td colspan="7" class="sag kalin">Tahmini toplam (satın alınacaklar)</td><td class="sag kalin">${tl(sp.filter(r => r.kart.grup !== 'MAMUL').reduce((a, r) => a + r.tutar, 0))}</td></tr>` }) +
      '<p class="mut kucuk">Asgari stoğu olan kartlardan, stoğu asgariye eşit/altına inenler. Önerilen miktar = stoğu asgarinin 2 katına tamamlamak için gereken. Asgari stok Kartlar sayfasından girilir. Mamül için "önerilen" üretilecek miktardır.</p>'
      : bos('Asgari seviyenin altında kart yok; sipariş gerekmiyor. ✅');
  } else {
    const gr = tabId === 'TUM' ? GRUPLAR : [tabId], satirlar = liste.filter(x => gr.includes(x.kart.grup));
    const topla = f => satirlar.reduce((a, x) => a + f(x), 0), varMi = f => satirlar.some(x => Math.abs(f(x)) > 0.0009);
    const kol = [{ b: 'Durum', f: x => durumChip(durumKodu(x)) }, { b: 'Ürün', f: x => kartEtiket(x.kart) }];
    if (tabId === 'TUM') kol.push({ b: 'Grup', f: x => GRUP_KISA[x.kart.grup] });
    kol.push({ b: 'Birim', f: x => esc(x.kart.birim) }, { b: 'Devir', c: 'sag', f: x => mikF(x.devir) }, { b: tabId === 'MAMUL' ? 'Üretilen' : 'Gelen', c: 'sag', f: x => mikF(x.gelen) });
    if (tabId !== 'HAM' || varMi(x => x.satilan)) kol.push({ b: 'Satılan', c: 'sag', f: x => mikF(x.satilan) });
    if (tabId === 'HAM' || tabId === 'TUM' || varMi(x => x.kullanilan)) kol.push({ b: 'Üretimde kullanılan', c: 'sag', f: x => mikF(x.kullanilan) });
    if (varMi(x => x.diger)) kol.push({ b: 'Diğer çıkış', c: 'sag', f: x => mikF(x.diger) });
    kol.push({ b: 'Kalan', c: 'sag kalin', f: x => mikF(x.kalan) }, { b: 'Ort. maliyet', c: 'sag', f: x => x.ort > 0 ? tl(x.ort) : '—' }, { b: 'Stok değeri', c: 'sag', f: x => tl(x.deger) });
    if (tabId !== 'HAM') kol.push({ b: 'Takribi satış değeri', c: 'sag', f: x => x.kart.grup === 'HAM' ? '—' : tl(x.takribi) });
    kol.push({ b: 'Asgari', c: 'sag', f: x => x.kart.asgari > 0 ? mikF(x.kart.asgari) : '' });
    const alt = `<tr><td colspan="${kol.length - (tabId !== 'HAM' ? 3 : 2)}" class="sag kalin">Toplam</td><td class="sag kalin">${tl(topla(x => x.deger))}</td>${tabId !== 'HAM' ? `<td class="sag kalin">${tl(topla(x => x.takribi))}</td>` : ''}<td></td></tr>`;
    govde = (tabId === 'MAMUL' ? '<p class="mut kucuk">Kalan = Devir + Üretilen − Satılan. Mamülde biriken stok burada görünür.</p>' : '') +
      (satirlar.length ? tablo(kol, satirlar, { id: 'tb-st', attr: x => `data-ad="${esc(trLower(x.kart.ad + ' ' + x.kart.kat))}" data-grup="${x.kart.grup}"`, alt }) : bos('Gösterilecek kayıt yok.'));
  }
  return ust + donemSec + kpis + sek + `<div class="card">${govde}</div>`;
};

// ---------- HAREKETLER ----------
const hrAciklama = r => { const g = r.tip === 'SATIS' ? satisGeliri(r) : null;
  return r.tip === 'SATIS' ? (g.gercek ? `${fmt(r.fiyat)} ₺` : `<span class="mut">~${fmt(r.mik > 0 ? g.tut / r.mik : 0)} ₺</span>`) : ''; };
SAYFA.hareket = () => {
  const H = ui.f.hr, sek = aktifSekme('hr', 'liste');
  const ust = baslik('📝', 'Hareketler', 'Tüm stok hareketleri. Yanlış girilen kaydı düzenleyin veya silin; silinenler arşive gider ve geri alınabilir.') +
    sekmeler('hr', [['liste', '📝 Hareket listesi'], ['arsiv', `🗃️ Silinenler (${db.hr.filter(r => r.sil).length})`]]);
  if (sek === 'arsiv') {
    const s = db.hr.filter(r => r.sil).sort((a, b) => (a.silTs < b.silTs ? 1 : -1)).slice(0, 400);
    return ust + `<div class="card">${s.length ? tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Ürün', f: r => esc(kartAd(r.kart)) }, { b: 'Hareket', f: r => TIP_AD[r.tip] },
      { b: 'Miktar', c: 'sag', f: r => `${mikF(r.mik)} ${esc(kartBirim(r.kart))}` }, { b: 'Silinme', f: r => trTarih((r.silTs || '').slice(0, 10)) }, { b: 'Neden', f: r => esc(r.silNeden) },
      { b: '', f: r => izin('duzelt') ? sagBtn('hr-geri', r.id, '♻️', 'Geri al') : '' }], s) + '<p class="mut kucuk">Üretim kayıtları bütün olarak geri gelir.</p>' : bos('Silinmiş kayıt yok.')}</div>`;
  }
  let rows = aktif().filter(r => (!H.bas || r.t >= H.bas) && (!H.bit || r.t <= H.bit) && (!H.tip || r.tip === H.tip) && (!H.kart || String(r.kart) === String(H.kart)));
  rows = rows.slice().sort((a, b) => (a.t < b.t ? 1 : a.t > b.t ? -1 : b.id - a.id));
  const gos = rows.slice(0, 500);
  const filt = `<div class="satir"><label>Başlangıç<input type="date" data-set="hr.bas" value="${H.bas}"></label><label>Bitiş<input type="date" data-set="hr.bit" value="${H.bit}"></label>
<label>Hareket<select data-set="hr.tip">${secenek([['', 'Tümü'], ...Object.entries(TIP_AD)], H.tip)}</select></label>
<label>Ürün<select data-set="hr.kart">${secenek([['', 'Tümü'], ...db.kartlar.slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(k => [k.id, k.ad])], H.kart)}</select></label>
<label class="ara">Ara<input id="ara-hr" data-filtre="hr" placeholder="ürün, not, neden…" autocomplete="off"></label><button class="btn" data-act="csv-hr">⬇ Excel (CSV)</button></div>`;
  return ust + filt + `<div class="card">${gos.length ? tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Ürün', f: r => esc(kartAd(r.kart)) }, { b: 'Hareket', f: r => TIP_AD[r.tip] },
    { b: 'Yön', f: r => r.yon === 'G' ? '<span class="g">▲ gelen</span>' : r.yon === 'C' ? '<span class="c">▼ giden</span>' : '<span class="mut">• fire</span>' },
    { b: 'Miktar', c: 'sag', f: r => `${mikF(r.mik)} ${esc(kartBirim(r.kart))}` }, { b: 'Birim maliyet', c: 'sag', f: r => r.bm > 0 ? tl(r.bm) : '—' }, { b: 'Satış fiyatı', c: 'sag', f: hrAciklama },
    { b: 'Kullanıcı', f: r => esc(r.kul || '—') }, { b: 'Not / neden', f: r => esc([r.neden, r.not].filter(Boolean).join(' · ')) },
    { b: '', c: 'sag nowrap', f: r => !izin('duzelt') ? '' : (duzenlenebilir(r) ? sagBtn('hr-duzenle', r.id, '✏️', 'Düzenle') : '') + (r.kod ? (r.kod.startsWith('SYM-') ? sagBtn('sayim-iptal', r.kod, '↩️', 'Sayımı iptal et') : sagBtn('seans-iptal', r.kod, '↩️', 'Üretimi iptal et')) : sagBtn('hr-sil', r.id, '🗑️', 'Sil')) }],
    gos, { id: 'tb-hr', attr: r => `data-ad="${esc(trLower(kartAd(r.kart) + ' ' + r.not + ' ' + r.neden + ' ' + TIP_AD[r.tip]))}" data-grup="all"` }) +
    (rows.length > 500 ? `<p class="mut kucuk">En yeni 500 kayıt gösteriliyor (${rows.length}). Süzgeçleri daraltın veya CSV'ye aktarın.</p>` : '') : bos('Filtreye uyan hareket yok.')}</div>`;
};

// ---------- SAYIM ----------
const izahatKutusu = zorunlu => `<label class="gen blk">Açıklama / izahat ${zorunlu ? '<b class="c">(zorunlu)</b>' : '<span class="mut">(isteğe bağlı)</span>'}
<textarea id="md-izahat" rows="7" placeholder="Farkların nedenini rapor gibi yazın: ne sayıldı, fark neden oluşmuş olabilir, hangi kayıt eksik/hatalı, alınacak önlem…"></textarea></label>
<div class="mut kucuk" id="md-say">${zorunlu ? `En az ${IZAHAT_MIN} karakter` : ''}</div>`;
function sayimRaporHtml(s) {
  const L = s.satirlar, fl = L.filter(l => l.fark !== 0);
  const eks = fl.filter(l => l.fark < 0).reduce((a, l) => a - l.fark * l.bm, 0), faz = fl.filter(l => l.fark > 0).reduce((a, l) => a + l.fark * l.bm, 0);
  const t = (kol, satirlar) => tablo(kol, satirlar);
  const kol = [{ b: 'Ürün', f: l => esc(kartAd(l.kart)) }, { b: 'Birim', f: l => esc(kartBirim(l.kart)) }, { b: 'Sistem', c: 'sag', f: l => mikF(l.sis) }, { b: 'Sayılan', c: 'sag', f: l => mikF(l.say) },
    { b: 'Fark', c: 'sag', f: l => l.fark ? (l.fark > 0 ? '+' : '') + mikF(l.fark) : '✓' }, { b: 'Değer', c: 'sag', f: l => l.fark ? tl(l.fark * l.bm) : '' }, { b: 'Neden', f: l => esc(l.neden) }];
  return `<h1>${esc(db.firma)} — Stok Sayım Raporu</h1>
<p><b>Tarih:</b> ${trTarih(s.t)} &nbsp; <b>Sayım fişi:</b> ${esc(s.kod)}${s.not ? ` &nbsp; <b>Not:</b> ${esc(s.not)}` : ''}</p>
<p><b>Sayılan kalem:</b> ${L.length} &nbsp; <b>Farklı kalem:</b> ${fl.length} &nbsp; <b>Eksik değeri:</b> ${tl(eks)} &nbsp; <b>Fazla değeri:</b> ${tl(faz)} &nbsp; <b>Net:</b> ${tl(faz - eks)}</p>
<p class="mut kucuk">Değerler sayım anındaki ortalama maliyetle hesaplanmıştır (takribi).</p>
${fl.length ? `<h3>Farklar</h3>${t(kol, fl)}` : '<p>Sistemle fark bulunmamıştır.</p>'}
<h3>Açıklama / izahat</h3><div class="izahat">${s.izahat ? esc(s.izahat) : '<span class="mut">(açıklama girilmemiş)</span>'}</div>
<h3>Sayılan tüm kalemler</h3>${t(kol, L)}
<div class="imza"><div>Sayımı yapan<br><br>____________________</div><div>Onaylayan<br><br>____________________</div></div>`;
}
const nedenSecenek = (sec, bosEtiket) => secenek([['', bosEtiket], ...SAYIM_NEDEN.map(x => [x, x])], sec);
SAYFA.sayim = () => {
  const ust = baslik('🧮', 'Stok sayımı', 'Raftaki/depodaki gerçek miktarı sayıp sistemle karşılaştırın. Farklar silinmez: nedenle birlikte "sayım fişi" ve düzeltme hareketi olarak kayıtlı kalır.') +
    sekmeler('sy', [['yeni', '🧮 Yeni sayım'], ['gecmis', '🕘 Sayım geçmişi']]);
  if (aktifSekme('sy', 'yeni') === 'gecmis') {
    const s = sayimSeanslari();
    return ust + `<div class="card">${s.length ? tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Sayım fişi', f: r => `<span class="mut kucuk">${esc(r.kod)}</span>` }, { b: 'Sayılan kalem', c: 'sag', f: r => r.n },
      { b: 'Farklı kalem', c: 'sag', f: r => r.nf }, { b: 'Eksik değeri', c: 'sag', f: r => r.eks > 0 ? '<span class="c">− ' + tl(r.eks) + '</span>' : '—' }, { b: 'Fazla değeri', c: 'sag', f: r => r.faz > 0 ? '<span class="g">+ ' + tl(r.faz) + '</span>' : '—' },
      { b: 'Net', c: 'sag kalin', f: r => tl(r.net) }, { b: 'Not', f: r => esc(r.not) }, { b: 'Durum', f: r => r.iptal ? chip('iptal edildi', 'mut') : (r.nf ? chip('düzeltme uygulandı', 'ok') : chip('fark yok', '')) },
      { b: '', c: 'sag nowrap', f: r => sagBtn('sayim-detay', r.kod, '🔍', 'Detay') + sagBtn('sayim-rapor', r.kod, '🖨️', 'Rapor yazdır / PDF') + (r.nf && !r.iptal ? sagBtn('sayim-iptal', r.kod, '↩️', 'Sayımı iptal et') : '') }], s) +
      '<p class="mut kucuk">Sayım iptal edilirse düzeltme hareketleri arşive taşınır ve stoklar sayımdan önceki haline döner (Hareketler → Silinenler\'den geri alınabilir).</p>' : bos('Henüz sayım yapılmamış.')}</div>`;
  }
  const d = defter(null, null), kk = kartlarSirali();
  if (!kk.length) return ust + bos('Sayılacak kart yok.');
  return ust + `<div class="card" data-live="sayim"><div class="satir"><label>Tarih<input type="date" id="sy-t" value="${bugun()}"></label><label class="gen">Sayım notu<input id="sy-not" placeholder="isteğe bağlı (örn. ay sonu sayımı)" autocomplete="off"></label>
<label>Fark nedeni (genel)<select id="sy-genel">${nedenSecenek('', '— seçin —')}</select></label>
<label class="ara">Ara<input id="ara-sy" data-filtre="sy" placeholder="Ürün ara…" autocomplete="off"></label>${gSeg('sy')}</div>
<p class="mut kucuk">Sadece <b>saydığınız</b> ürünlerin "Sayılan" hücresini doldurun; boş bırakılanlar sayıma dahil edilmez. Farklı çıkan satırlarda neden için <b>genel nedeni</b> kullanabilir veya satır bazında ayrı neden seçebilirsiniz. Onaylamadan önce tüm farkları gözden geçirecek ve farkların <b>genel açıklamasını (izahat)</b> yazacaksınız; fark varsa izahat zorunludur.</p>
<div class="tw"><table class="tbl" id="tb-sy"><thead><tr><th>Ürün</th><th>Grup</th><th>Birim</th><th class="sag">Sistem</th><th class="sag">Sayılan</th><th class="sag">Fark</th><th class="sag">Fark değeri</th><th>Neden (ürün bazında)</th></tr></thead><tbody>${kk.map(k => { const x = d.get(k.id);
    return `<tr data-kart="${k.id}" data-grup="${k.grup}" data-ad="${esc(trLower(k.ad + ' ' + k.kat))}" data-net="${x.kalan}" data-ort="${x.ort}"><td>${kartEtiket(k)}</td><td>${GRUP_KISA[k.grup]}</td><td>${esc(k.birim)}</td><td class="sag">${mikF(x.kalan)}</td>
<td class="sag"><input class="in sag" data-f="say" inputmode="decimal" placeholder="${mikF(x.kalan)}" autocomplete="off"></td><td class="sag" data-f="fark"></td><td class="sag" data-f="deger"></td>
<td><select data-f="neden" hidden>${nedenSecenek('', '(genel neden)')}</select></td></tr>`; }).join('')}</tbody></table></div>
<div class="altbar"><span id="sy-ozet" class="mut">Henüz sayım girilmedi.</span><button class="btn pri" data-act="sayim-incele">İncele ve onayla…</button></div></div>`;
};
function liveSayim() {
  if (!$('sy-ozet')) return;                      // 'Sayım geçmişi' sekmesinde bu alan yoktur
  let n = 0, say = 0, eks = 0, faz = 0;
  document.querySelectorAll('#tb-sy tbody tr').forEach(tr => {
    const s = sayiOku(tr.querySelector('[data-f=say]').value), net = +tr.dataset.net, ort = +tr.dataset.ort;
    const f = tr.querySelector('[data-f=fark]'), dg = tr.querySelector('[data-f=deger]'), ne = tr.querySelector('[data-f=neden]');
    if (isFinite(s) && s >= 0) {
      say++;
      if (Math.abs(s - net) > 0.001) {
        n++; const fark = s - net; if (fark < 0) eks += -fark * ort; else faz += fark * ort;
        f.textContent = (fark > 0 ? '+' : '') + mikF(fark); f.className = 'sag ' + (fark > 0 ? 'g' : 'c'); dg.textContent = tl(fark * ort); ne.hidden = false;
        tr.classList.toggle('fz', net > 0 && Math.abs(fark) / net >= 0.1);
      } else { f.textContent = '✓'; f.className = 'sag g'; dg.textContent = ''; ne.hidden = true; tr.classList.remove('fz'); }
    } else { f.textContent = ''; f.className = 'sag'; dg.textContent = ''; ne.hidden = true; tr.classList.remove('fz'); }
  });
  $('sy-ozet').innerHTML = say ? `<b>${say}</b> kalem sayıldı · <b>${n}</b> farklı${n ? ` · eksik <span class="c">${tl(eks)}</span> · fazla <span class="g">${tl(faz)}</span> · net <b>${tl(faz - eks)}</b>` : ''}` : 'Henüz sayım girilmedi.';
}
function sayimOku() {
  const satirlar = [...document.querySelectorAll('#tb-sy tbody tr')].map(tr => ({ kart: +tr.dataset.kart, sayilan: sayiOku(tr.querySelector('[data-f=say]').value), neden: tr.querySelector('[data-f=neden]').value }))
    .filter(x => isFinite(x.sayilan) && x.sayilan >= 0);
  return { t: val('sy-t') || bugun(), not: val('sy-not'), genel: val('sy-genel'), satirlar };
}

// ---------- ANALİZ ----------
function analizAralik() {
  const A = ui.f.analiz, bu = bugun();
  if (A.bas === '' && A.bit === '' && !A.tum) { A.bas = gunEkle(bu, -29); A.bit = bu; }
  return [A.tum ? '' : A.bas, A.tum ? '' : A.bit];
}
SAYFA.analiz = () => {
  const [bas, bit] = analizAralik(), A = ui.f.analiz, bu = bugun();
  const ust = baslik('📈', 'Analiz', 'Takribi mali özet, üretim randımanı ve kayıplar.') +
    `<div class="satir"><label>Başlangıç<input type="date" data-set="analiz.bas" value="${bas}"></label><label>Bitiş<input type="date" data-set="analiz.bit" value="${bit}"></label>
<button class="btn kucuk" data-act="aralik" data-n="0">Bugün</button><button class="btn kucuk" data-act="aralik" data-n="6">7 gün</button><button class="btn kucuk" data-act="aralik" data-n="29">30 gün</button><button class="btn kucuk" data-act="aralik" data-n="ay">Bu ay</button><button class="btn kucuk" data-act="aralik" data-n="tum">Tümü</button></div>` +
    sekmeler('an', [['mali', '💰 Mali özet (takribi)'], ['uretim', '⚙️ Üretim'], ['kayip', '📉 Kayıplar']]);
  const t = aktifSekme('an', 'mali');
  if (t === 'mali') {
    const m = maliOzet(bas, bit), mx = Math.max(1, ...m.gun.map(([, v]) => v.ciro));
    const satirlar = [['Satın alma (alış) tutarı', tl(m.alis), ''], ['Satılan malın maliyeti', tl(m.satisMal), ''], ['Ciro — girilen satış fiyatları', tl(m.ciroG), ''], ['Ciro — takribi (fiyat girilmeyenler)', tl(m.ciroT), 'tk'],
      ['Toplam ciro', tl(m.ciro), 'b'], ['Brüt kâr', tl(m.kar), 'b'], ['Kâr oranı', yuzde(m.marj), ''], ['Zayiat / ikram maliyeti', '− ' + tl(m.zay), ''], ['Üretim firesi (bilgi, değer)', tl(m.fire), ''],
      ['Sayım eksiği / fazlası', `− ${tl(m.sayEks)} / + ${tl(m.sayFaz)}`, ''], ['Kayıplar sonrası takribi kâr', tl(m.net), 'b']];
    return ust + `<div class="cols"><div class="card"><h3>Mali özet ${takribiEt}</h3><table class="tbl mali"><tbody>${satirlar.map(([a, b, c]) => `<tr class="${c === 'b' ? 'kalin' : ''}"><td>${a}${c === 'tk' ? ' ' + takribiEt : ''}</td><td class="sag">${b}</td></tr>`).join('')}</tbody></table>
<p class="mut kucuk">Girilen fiyatlar gerçektir; girilmeyenler <i>satış anındaki ortalama maliyet × (1 + kâr oranı)</i> ile tahmin edilmiştir. Üretim firesi mamül maliyetine zaten yansır, ayrıca düşülmez.</p></div>
<div class="card"><h3>Günlük ciro</h3>${m.gun.length ? m.gun.slice(-31).map(([g, v]) => `<div class="gb"><span>${trTarih(g).slice(0, 5)}</span>${bar(v.ciro / mx * 100)}<b>${tl(v.ciro)}</b></div>`).join('') : '<p class="mut">Bu aralıkta satış yok.</p>'}</div></div>
<div class="card"><h3>Ürün bazında satış</h3>${m.kalem.length ? tablo([{ b: 'Ürün', f: e => esc(kartAd(e.kart)) }, { b: 'Satılan', c: 'sag', f: e => `${mikF(e.mik)} ${esc(kartBirim(e.kart))}` },
      { b: 'Ciro', c: 'sag', f: e => (e.takribi ? '<span class="tk">~</span> ' : '') + tl(e.ciro) }, { b: 'Maliyet', c: 'sag', f: e => tl(e.mal) }, { b: 'Kâr', c: 'sag kalin', f: e => tl(e.ciro - e.mal) },
      { b: 'Kâr oranı', c: 'sag', f: e => yuzde(e.ciro > 0 ? (e.ciro - e.mal) / e.ciro * 100 : NaN) }], m.kalem) + '<p class="mut kucuk">~ işareti: ciro tamamen veya kısmen takribidir.</p>' : bos('Bu aralıkta satış yok.')}</div>`;
  }
  if (t === 'uretim') {
    const s = uretimSeanslari().filter(r => (!bas || r.t >= bas) && (!bit || r.t <= bit)), k = s.filter(r => r.birim !== 'karışık');
    if (!s.length) return ust + `<div class="card">${bos('Bu aralıkta üretim yok.')}</div>`;
    const gb = new Map(); for (const r of k) { const e = gb.get(r.ana + '|' + r.birim) || { ana: r.ana, birim: r.birim, n: 0, G: 0, M: 0, Y: 0, F: 0 }; e.n++; e.G += r.G; e.M += r.M; e.Y += r.Y; e.F += r.F; gb.set(r.ana + '|' + r.birim, e); }
    return ust + `<div class="card"><h3>Ana girdi bazında randıman</h3>${tablo([{ b: 'Ana girdi', f: e => esc(e.ana) }, { b: 'Seans', c: 'sag', f: e => e.n }, { b: 'Girdi', c: 'sag', f: e => `${mikF(e.G)} ${esc(e.birim)}` }, { b: 'Mamül', c: 'sag', f: e => mikF(e.M) },
      { b: 'Yan ürün', c: 'sag', f: e => mikF(e.Y) }, { b: 'Fire', c: 'sag', f: e => mikF(e.F) }, { b: 'Randıman', c: 'sag kalin', f: e => yuzde(e.G > 0 ? e.M / e.G * 100 : NaN) },
      { b: '', f: e => bar(e.G > 0 ? e.M / e.G * 100 : 0, 'ok') }], [...gb.values()])}</div>
<div class="card"><h3>Üretim seansları</h3>${tablo([{ b: 'Tarih', f: r => trTarih(r.t) }, { b: 'Girdi', f: r => esc(r.girdi) }, { b: 'Mamül', f: r => esc(r.cikti) }, { b: 'Yan ürün', f: r => esc(r.yan) || '—' },
      { b: 'Randıman', c: 'sag', f: r => isNaN(r.randiman) ? '—' : yuzde(r.randiman) }, { b: 'Fire', c: 'sag', f: r => `${mikF(r.F)}` }, { b: 'Girdi maliyeti', c: 'sag', f: r => tl(r.maliyet) }], s)}</div>`;
  }
  const m = maliOzet(bas, bit), rows = aktif().filter(r => (!bas || r.t >= bas) && (!bit || r.t <= bit));
  const grp = (liste, kf) => { const g = new Map(); for (const r of liste) { const k = kf(r); const e = g.get(k) || { k, n: 0, mik: new Map(), deger: 0 }; e.n++; e.deger += r.mik * r.bm; e.mik.set(kartBirim(r.kart), (e.mik.get(kartBirim(r.kart)) || 0) + r.mik); g.set(k, e); } return [...g.values()].sort((a, b) => b.deger - a.deger); };
  const miktarMetni = e => [...e.mik.entries()].map(([b, v]) => `${mikF(v)} ${esc(b)}`).join(' + ');
  const zay = rows.filter(r => r.tip === 'ZAYIAT'), fire = rows.filter(r => r.tip === 'FIRE'), eks = rows.filter(r => r.tip === 'SAYIM' && r.yon === 'C'), faz = rows.filter(r => r.tip === 'SAYIM' && r.yon === 'G');
  const blok = (b, l, kf, kb) => l.length ? `<div class="card"><h3>${b}</h3>${tablo([{ b: kb, f: e => esc(e.k) || '(belirtilmemiş)' }, { b: 'Kayıt', c: 'sag', f: e => e.n }, { b: 'Miktar', c: 'sag', f: miktarMetni }, { b: 'Değer (maliyet)', c: 'sag kalin', f: e => tl(e.deger) }], grp(l, kf))}</div>` : '';
  return ust + `<div class="grid g4">${kpi('Zayiat / ikram', tl(m.zay), `${zay.length} kayıt`)}${kpi('Üretim firesi (değer)', tl(m.fire), `${fire.length} üretimde`)}${kpi('Sayım eksiği', tl(m.sayEks), 'sistemde var, rafta yok')}${kpi('Sayım fazlası', tl(m.sayFaz), 'rafta var, sistemde yok')}</div>` +
    (zay.length || fire.length || eks.length || faz.length ? blok('Zayiat / ikram — neden bazında', zay, r => r.neden, 'Neden') + blok('Zayiat / ikram — ürün bazında', zay, r => kartAd(r.kart), 'Ürün') + blok('Üretim firesi — ürün bazında', fire, r => kartAd(r.kart), 'Ana girdi') +
      blok('Sayım eksiği — neden bazında', eks, r => r.neden, 'Neden') + blok('Sayım eksiği — ürün bazında', eks, r => kartAd(r.kart), 'Ürün') + blok('Sayım fazlası — neden bazında', faz, r => r.neden, 'Neden') + blok('Sayım fazlası — ürün bazında', faz, r => kartAd(r.kart), 'Ürün') : `<div class="card">${bos('Bu aralıkta kayıp kaydı yok.')}</div>`);
};

// ---------- KARTLAR ----------
const kartForm = (k, p) => `<div class="satir"><label class="gen">Ürün adı<input id="${p}ad" value="${esc(k.ad || '')}" autocomplete="off"></label><label>Kategori<input id="${p}kat" value="${esc(k.kat || '')}" placeholder="ops." autocomplete="off" list="kat-l"></label>
<label>Grup<select id="${p}grup">${secenek(GRUPLAR.map(g => [g, `${GRUP_IKON[g]} ${GRUP_AD[g]}`]), k.grup || 'TICARI')}</select></label>
<label>Birim<input id="${p}birim" value="${esc(k.birim || 'KG')}" list="birim-l" autocomplete="off" style="width:90px"></label>
<label>Asgari stok<input id="${p}asgari" inputmode="decimal" value="${k.asgari ? String(k.asgari).replace('.', ',') : ''}" placeholder="0" style="width:90px"></label>
<label>Kâr oranı %<input id="${p}kar" inputmode="decimal" value="${k.kar != null ? String(k.kar).replace('.', ',') : ''}" placeholder="genel: ${nf0.format(+db.ayar.kar || 0)}" style="width:100px" title="Boş = genel oran. Takribi satış fiyatı için."></label></div>`;
SAYFA.kartlar = () => {
  const d = defter(null, null), ara = '';
  const katlar = [...new Set(db.kartlar.map(k => k.kat).filter(Boolean))];
  return baslik('🗂️', 'Stok kartları', 'Her kalem bir karttır: Ürün + Kategori + Grup. Adı, grubu, birimi istediğiniz zaman değiştirebilirsiniz; geçmiş hareketler kartı takip eder.') +
    `<datalist id="kat-l">${katlar.map(k => `<option value="${esc(k)}">`).join('')}</datalist><datalist id="birim-l">${BIRIMLER.map(b => `<option value="${b}">`).join('')}</datalist>
<div class="card"><h3>➕ Yeni kart</h3>${kartForm({}, 'nk-')}<div class="satir"><button class="btn pri" data-act="kart-ekle">Kart ekle</button></div>
<div class="satir"><button class="btn" data-act="aktar-sec">📥 Excel / CSV'den içe aktar</button><span class="mut kucuk">Sütunları kendisi tanır; ürün listesi ve açılış stoğunu tek seferde alır.</span></div>
<details><summary>Toplu ekle (her satıra bir kart)</summary><p class="mut kucuk">Biçim: <code>Ad; Kategori; Grup; Birim; Asgari</code> — Grup: Ham, Mamül veya Ticari. Kategori ve sonrası isteğe bağlı.</p>
<textarea id="toplu" rows="5" placeholder="Dana 5'li set; Kırmızı et; Ham; KG; 50&#10;Et döner; Döner; Mamül; KG&#10;Ayran; İçecek; Ticari; Adet; 100"></textarea><div class="satir"><button class="btn" data-act="kart-toplu">Toplu ekle</button></div></details></div>
<div class="card"><div class="satir"><label class="ara">Ara<input id="ara-kt" data-filtre="kt" placeholder="Kart ara…" autocomplete="off"></label>${gSeg('kt')}</div>
${db.kartlar.length ? tablo([{ b: 'Ürün', f: k => kartEtiket(k) + (k.aktif === false ? ' ' + chip('pasif', 'mut') : '') }, { b: 'Grup', f: k => `${GRUP_IKON[k.grup]} ${GRUP_KISA[k.grup]}` }, { b: 'Birim', f: k => esc(k.birim) },
      { b: 'Stok', c: 'sag', f: k => mikF(d.get(k.id).kalan) }, { b: 'Ort. maliyet', c: 'sag', f: k => d.get(k.id).ort > 0 ? tl(d.get(k.id).ort) : '—' }, { b: 'Asgari', c: 'sag', f: k => k.asgari > 0 ? mikF(k.asgari) : '' },
      { b: 'Kâr %', c: 'sag', f: k => k.kar != null ? nf0.format(k.kar) : `<span class="mut">${nf0.format(+db.ayar.kar || 0)}</span>` },
      { b: '', c: 'sag nowrap', f: k => sagBtn('kart-duzenle', k.id, '✏️', 'Düzenle') + sagBtn('kart-pasif', k.id, k.aktif === false ? '▶️' : '⏸️', k.aktif === false ? 'Aktif yap' : 'Pasif yap') + sagBtn('kart-sil', k.id, '🗑️', 'Sil') }],
      db.kartlar.slice().sort((a, b) => GRUPLAR.indexOf(a.grup) - GRUPLAR.indexOf(b.grup) || a.ad.localeCompare(b.ad, 'tr')),
      { id: 'tb-kt', attr: k => `data-ad="${esc(trLower(k.ad + ' ' + k.kat))}" data-grup="${k.grup}"` }) : bos('Henüz kart yok.')}</div>`;
};

// ---------- AYARLAR ----------
const klasorDurumMetni = () => {
  if (!Klasor.secilebilir) return chip('Bu tarayıcı desteklemiyor', 'er');
  return { tamam: chip('Aktif', 'ok'), izin: chip('İzin gerekiyor', 'wr'), kayip: chip('BULUNAMADI', 'er'), hata: chip('Hata', 'er'), yok: chip('Seçilmedi', 'er') }[Klasor.durum];
};
const LOG_AD = { GIRIS: 'Giriş', GIRIS_HATA: 'Hatalı giriş', CIKIS: 'Çıkış', KILIT: 'Oturum kilidi', ALIS: 'Alış', URETIM: 'Üretim', SATIS: 'Satış', ZAYIAT: 'Zayiat / ikram', SAYIM: 'Sayım',
  DUZENLE: 'Düzenleme', SIL: 'Silme', GERI: 'Geri alma', KART: 'Kart', AYAR: 'Ayar', KULLANICI: 'Kullanıcı', YEDEK: 'Yedek', SURUM: 'Sürüm' };
const rolSecenek = sec => secenek(Object.entries(ROLLER).map(([k, r]) => [k, r.ad]), sec);
const saatMetni = ts => (ts ? new Date(ts).toLocaleString('tr-TR') : '—');

/** Yedek durumuna göre kullanıcıya gösterilecek uyarı (null = sorun yok). */
function yedekMesaj() {
  const d = Kayit.yedekDurumu(); if (d.kod === 'tamam') return null;
  const ad = esc(Klasor.ad || ''), yet = izin('ayar');
  const indir = yet ? '<button class="btn kucuk" data-act="yedek-indir">⬇ Yedeği indir</button>' : '';
  const sec = yet ? `${Klasor.destek ? '<button class="btn kucuk pri" data-act="klasor-sec">📁 Klasör seç</button>' : ''}${Klasor.dosyaDestek ? '<button class="btn kucuk" data-act="dosya-sec">📄 Dosya seç</button>' : ''}` : '';
  const ek = Kayit.sonIndirme ? ` Son elle indirilen yedek: ${saatMetni(Kayit.sonIndirme)}.` : ' Henüz elle yedek indirilmemiş.';
  const kimeye = yet ? '' : ' Lütfen yöneticinize bildirin.';
  switch (d.kod) {
    case 'yok': return { s: d.seviye === 'hata' ? 'er' : 'wr', t: `⚠️ <b>Yedek konumu seçilmedi.</b> Verileriniz şu anda <b>yalnızca bu tarayıcıda</b> tutuluyor; tarayıcı verisi silinirse veya bozulursa geri getirilemez. Bir klasör (önerilen) veya tek yedek dosyası seçince her değişiklik anında oraya yedeklenir.${ek}${kimeye}`, b: sec + indir };
    case 'kayip': return { s: 'er', t: `⚠️ <b>Yedek konumu bulunamadı</b> (“${ad}” silinmiş, taşınmış veya sürücüsü takılı değil). Veriler tarayıcıda tutuluyor ama <b>yedek alınmıyor</b>. Konumu geri getirirseniz otomatik yeniden bağlanılır; aksi halde yeni konum seçin veya yedeği indirin.${ek}${kimeye}`, b: sec + indir };
    case 'izin': return { s: 'wr', t: `📁 “${ad}” yedek konumuna yazmak için tarayıcı izni gerekiyor; izin verilene kadar yedek yazılmıyor (veriler tarayıcıda tutuluyor).${kimeye}`, b: (yet ? '<button class="btn kucuk pri" data-act="klasor-izin">İzin ver</button>' : '') + indir };
    case 'hata': return { s: 'er', t: `⚠️ Yedek konumuna yazılamadı: ${esc(Klasor.hata || 'bilinmeyen hata')}. Veriler tarayıcıda tutuluyor; yedeği indirin veya konumu yeniden seçin.${ek}${kimeye}`, b: sec + indir };
    default: return { s: d.seviye === 'hata' ? 'er' : 'wr', t: `⚠️ Bu tarayıcı yedek konumuna otomatik yazamaz (Chrome veya Edge gerekir). Veriler yalnızca bu tarayıcıda tutuluyor; düzenli olarak yedeği indirin.${ek}${kimeye}`, b: indir };
  }
}

function ayarSekmeleri() {
  const l = [];
  if (izin('ayar')) l.push(['genel', '⚙️ Genel'], ['yedek', '💾 Yedekleme'], ['surum', '🆕 Sürüm']);
  if (izin('kullanici')) l.push(['kullanici', '👥 Kullanıcılar']);
  if (izin('log')) l.push(['gunluk', '📜 Günlük']);
  return l;
}
SAYFA.ayar = () => {
  const sek = ayarSekmeleri(); if (!sek.length) return baslik('🔧', 'Ayarlar', '') + bos('Bu sayfa için yetkiniz yok.');
  const t = sek.some(([k]) => k === aktifSekme('ay', sek[0][0])) ? aktifSekme('ay', sek[0][0]) : sek[0][0]; ui.tab.ay = t;
  return baslik('🔧', 'Ayarlar', 'İşletme, yedekleme, sürüm, kullanıcılar ve kayıt günlüğü.') + sekmeler('ay', sek) + ({ genel: ayarGenel, yedek: ayarYedek, surum: ayarSurum, kullanici: ayarKullanici, gunluk: ayarGunluk })[t]();
};

function ayarGenel() {
  return `<div class="card"><h3>İşletme</h3><div class="satir"><label class="gen">İşletme adı<input id="ay-firma" value="${esc(db.firma)}" autocomplete="off"></label>
<label>Genel takribi kâr oranı %<input id="ay-kar" inputmode="decimal" value="${String(+db.ayar.kar || 0).replace('.', ',')}" style="width:110px"></label>
<label>Hareketsizlikte oturum kilidi (dk)<input id="ay-kilit" inputmode="numeric" value="${+db.ayar.kilitDk || 15}" style="width:110px" title="Giriş koruması açıksa, bu süre işlem yapılmazsa oturum kilitlenir"></label><button class="btn pri" data-act="ayar-kaydet">Kaydet</button></div>
<p class="mut kucuk">Kâr oranı: satış fiyatı girilmeyen satışlarda ve "takribi satış değeri"nde <i>ortalama maliyet × (1 + oran)</i> olarak kullanılır. Ürün bazında farklı oran için Kartlar sayfasında "Kâr oranı %" girin. Sonradan değiştirmek geçmiş satışların kaydedilmiş oranını değiştirmez.</p></div>
<div class="card"><h3>⬇ Dışa aktar</h3><div class="satir"><button class="btn" data-act="csv-stok">Stok durumu (CSV)</button><button class="btn" data-act="csv-hr">Tüm hareketler (CSV)</button></div><p class="mut kucuk">CSV dosyaları Excel'de doğrudan açılır (noktalı virgül ayırıcı).</p></div>
<div class="card"><h3>🧪 Diğer</h3><div class="satir">${db.kartlar.length ? '' : '<button class="btn" data-act="ornek">Örnek veri yükle</button>'}<button class="btn dng" data-act="sifirla">Tüm verileri sil…</button></div><p class="mut kucuk">Stok Portal sürüm ${SURUM} · veri biçimi v${db.v}</p></div>`;
}

function ayarYedek() {
  const m = yedekMesaj();
  const konum = Klasor.h ? `${Klasor.tur === 'dosya' ? '📄 Dosya' : '📁 Klasör'}: <b>${esc(Klasor.ad)}</b>` : '<span class="c">seçilmedi</span>';
  return `<div class="card"><h3>💾 Yedek konumu</h3>
${m ? `<div class="ban ${m.s}"><span>${m.t}</span></div>` : `<div class="ban ok"><span>✅ Her değişiklik anında ${Klasor.tur === 'dosya' ? 'seçilen dosyaya' : 'seçilen klasöre'} yazılıyor.</span></div>`}
<table class="tbl mali"><tbody>
<tr><td>Tarayıcı kaydı (her değişiklikte)</td><td class="sag">${Depo.ok ? chip('Aktif', 'ok') : chip('Kullanılamıyor', 'er')}</td></tr>
<tr><td>Yedek konumu</td><td class="sag">${konum} ${klasorDurumMetni()}</td></tr>
<tr><td>Son yedek konumuna yazma</td><td class="sag">${saatMetni(Klasor.sonYazma)}</td></tr>
<tr><td>Son elle indirilen yedek</td><td class="sag">${saatMetni(Kayit.sonIndirme)}</td></tr>
<tr><td>Kayıtlar</td><td class="sag">${db.kartlar.length} kart · ${db.hr.length} hareket · ${db.log.length} günlük satırı</td></tr></tbody></table>
<div class="satir">${Klasor.destek ? `<button class="btn pri" data-act="klasor-sec">📁 ${Klasor.h && Klasor.tur === 'klasor' ? 'Yedek klasörünü değiştir' : 'Yedek klasörü seç'}</button>` : ''}${Klasor.dosyaDestek ? '<button class="btn" data-act="dosya-sec">📄 Tek yedek dosyası seç</button>' : ''}${Klasor.durum === 'izin' ? '<button class="btn wr" data-act="klasor-izin">🔓 Konum iznini ver</button>' : ''}
<button class="btn" data-act="yedek-simdi">💾 Şimdi yedekle</button><button class="btn" data-act="yedek-indir">⬇ Yedeği indir (JSON)</button><button class="btn" data-act="yedek-ac">⬆ Yedekten aç…</button></div>
<ul class="yardim"><li><b>Anlık yedek nedir?</b> O ana ait bir <i>fotoğraftır</i>: dosyadaki "İçerik" sütunu o andaki kart/hareket sayısını gösterir. En güncel veri <code>stok_portal_guncel.json</code> dosyasındadır; anlık/günlük dosyalar eski bir ana dönmek içindir. Geri yüklemeden önce İçerik sütununa bakın.</li><li><b>Klasör (önerilen):</b> seçince <code>stok_portal_guncel.json</code> her değişiklikte güncellenir; ayrıca <code>gunluk_*.json</code> (son 90 gün) ve <code>anlik_*.json</code> (saatlik, son 48) tutulur. <b>Tek dosya:</b> seçilen .json dosyası her değişiklikte üzerine yazılır (geçmiş tutulmaz).</li>
<li>Konum bulunamazsa veya izin düşerse <b>veriler tarayıcıda tutulmaya devam eder</b>; üstte uyarı çıkar. Konum geri gelince (sürücü takılınca vb.) otomatik yeniden bağlanılır ve güncel yedek yazılır. Bu sırada "Yedeği indir" ile elle yedek alın.</li>
<li>Windows/Chrome Masaüstü, Belgeler veya İndirilenler'in kendisini klasör olarak seçtirmez: içinde yeni bir klasör (ör. <code>StokYedek</code>) oluşturup onu seçin. Bulut senkronize klasör (OneDrive, Google Drive) veya USB iyi bir seçimdir.</li>
<li>Chrome yeniden açıldığında konum iznini yeniden isteyebilir; bu durumda "İzin ver" düğmesi çıkar.</li>
<li>Yedek dosyaları <b>şifrelenmez</b> (kullanıcı şifre özetleri ve günlük de içindedir); güvenli bir konumda tutun.</li></ul>
<div id="yedek-liste"><p class="mut">Yedek listesi yükleniyor…</p></div></div>`;
}

function ayarSurum() {
  const g = db.ayar.guncelleme || {}, y = SurumDenetim.yeni;
  return `<div class="card"><h3>🆕 Sürüm</h3><table class="tbl mali"><tbody>
<tr><td>Bu dosyanın sürümü</td><td class="sag"><b>${SURUM}</b></td></tr><tr><td>Verinin en son kullanıldığı sürüm</td><td class="sag">${esc(db.app || '—')}</td></tr><tr><td>Veri biçimi</td><td class="sag">v${db.v} (bu dosya: v${DB_SEMA})</td></tr>
<tr><td>Son sürüm denetimi</td><td class="sag">${SurumDenetim.son ? saatMetni(SurumDenetim.son) : '—'}</td></tr></tbody></table>
${y ? `<div class="ban wr"><span>🆕 Yeni sürüm: <b>${esc(y.surum)}</b>${y.tarih ? ' (' + esc(y.tarih) + ')' : ''}</span><button class="btn kucuk pri" data-act="surum-yeni">Ayrıntı ve güncelleme adımları</button></div>` : (SurumDenetim.son ? '<div class="ban ok"><span>✅ Güncel sürümü kullanıyorsunuz.</span></div>' : '')}
${SurumDenetim.hata && !y ? `<p class="mut kucuk">${esc(SurumDenetim.hata)}</p>` : ''}
<h3>Güncelleme kaynağı (gelişmiş)</h3><div class="satir"><label>GitHub deposu (boşsa varsayılan: ${VARSAYILAN_REPO})<input id="ay-repo" value="${esc(g.repo || '')}" placeholder="${VARSAYILAN_REPO}" style="width:260px" autocomplete="off"></label>
<label>Dal<input id="ay-dal" value="${esc(g.dal || 'main')}" style="width:90px"></label><button class="btn" data-act="guncelleme-kaydet">Kaydet</button><button class="btn pri" data-act="guncelleme-kontrol">Şimdi denetle</button></div>
<p class="mut kucuk">Depo yazılırsa uygulama, internet varken açılışta depodaki <code>version.json</code> dosyasını okuyup yeni sürüm olup olmadığını bildirir. Çevrimdışıyken sessizce atlanır. Uygulama GitHub Pages'te yayınlanıyorsa aynı adresteki <code>version.json</code> da denetlenir.</p></div>
<div class="card"><h3>Neler yeni?</h3>${DEGISIKLIKLER.map(d => `<h4>Sürüm ${d.s} <span class="mut">(${esc(d.t)})</span></h4><ul class="yardim">${d.n.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div>`;
}

function rolMatrisi() {
  return tablo([{ b: 'İzin', f: p => esc(IZIN_AD[p]) }, ...Object.entries(ROLLER).map(([k, r]) => ({ b: r.ad, c: 'sag', f: p => (r.izin.includes(p) ? '<span class="g">✓</span>' : '<span class="mut">—</span>') }))], Object.keys(IZIN_AD));
}
function ayarKullanici() {
  const roller = `<div class="card"><h3>Roller ve yetkiler</h3>${rolMatrisi()}</div>`;
  const uyari = '<div class="ban wr"><span>ℹ️ Bu uygulama sunucusuz çalışır: kullanıcı girişi, <b>aynı bilgisayarı paylaşan kişiler</b> için işlem takibi ve yetki ayrımıdır (kim ne yaptı, kim neyi görür). Teknik bilgisi olan biri yedek dosyasını açarak veya tarayıcı konsolundan verilere ulaşabilir; yedek dosyaları şifrelenmez. Gerçek güvenlik için bilgisayarın kendi kullanıcı hesabını ve disk şifrelemeyi de kullanın.</span></div>';
  if (!authAktif()) {
    const var_ = db.kullanicilar.length > 0;
    return uyari + `<div class="card"><h3>🔒 Giriş koruması kapalı</h3><p>Şu an herkes uygulamayı kullanabilir ve işlemler "kullanıcısız" kaydedilir. ${var_ ? 'Daha önce tanımlı kullanıcılar var: yönetici bilgileriyle korumayı yeniden açabilirsiniz.' : 'Koruma açılınca ilk <b>yönetici</b> hesabı oluşturulur; sonra diğer kullanıcılar eklenir.'}</p>
${var_ ? `<div class="satir"><label>Yönetici kullanıcı adı<input id="kg-kadi" autocomplete="off"></label><label>Şifre<input id="kg-sifre" type="password" autocomplete="off"></label><button class="btn pri" data-act="koruma-yeniden">Korumayı yeniden aç</button></div>` :
      `<div class="satir"><label>Ad soyad<input id="kg-ad" autocomplete="off"></label><label>Kullanıcı adı<input id="kg-kadi" placeholder="ör. ahmet.y" autocomplete="off"></label><label>Şifre (en az ${SIFRE_MIN})<input id="kg-sifre" type="password" autocomplete="new-password"></label><label>Şifre (tekrar)<input id="kg-sifre2" type="password" autocomplete="new-password"></label><button class="btn pri" data-act="koruma-ac">Korumayı aç ve yönetici oluştur</button></div>
<p class="mut kucuk">Oluşturma sonunda bir <b>kurtarma kodu</b> gösterilir (yalnızca bir kez). Yönetici şifresi unutulursa tek yol budur; güvenli bir yere yazın.</p>`}</div>` + roller;
  }
  const liste = db.kullanicilar.slice().sort((a, b) => a.kadi.localeCompare(b.kadi, 'tr'));
  return uyari + `<div class="card"><h3>👥 Kullanıcılar</h3>${tablo([{ b: 'Kullanıcı', f: u => `<b>${esc(u.ad)}</b><div class="alt">${esc(u.kadi)}</div>` }, { b: 'Rol', f: u => esc(ROLLER[u.rol].ad) },
    { b: 'Durum', f: u => (u.aktif === false ? chip('pasif', 'mut') : chip('aktif', 'ok')) + (u.zorla ? ' ' + chip('şifre değiştirecek', 'wr') : '') }, { b: 'Son giriş', f: u => saatMetni(u.sonGiris) },
    { b: '', c: 'sag nowrap', f: u => sagBtn('kul-duzenle', u.id, '✏️', 'Düzenle') + sagBtn('kul-sifre', u.id, '🔑', 'Şifre sıfırla') }], liste)}</div>
<div class="card"><h3>➕ Yeni kullanıcı</h3><div class="satir"><label>Ad soyad<input id="ku-ad" autocomplete="off"></label><label>Kullanıcı adı<input id="ku-kadi" placeholder="ör. ayse.k" autocomplete="off"></label>
<label>Rol<select id="ku-rol">${rolSecenek('personel')}</select></label><label>Geçici şifre (en az ${SIFRE_MIN})<input id="ku-sifre" autocomplete="off"></label><button class="btn pri" data-act="kul-ekle">Ekle</button></div>
<p class="mut kucuk">Kullanıcı ilk girişinde şifresini kendisi belirler. Kullanıcılar silinmez, pasifleştirilir (günlük ve kayıtlardaki izleri korunsun diye).</p></div>${roller}
<div class="card"><h3>Giriş koruması</h3><div class="satir"><button class="btn dng" data-act="koruma-kapat">Korumayı kapat…</button></div><p class="mut kucuk">Kapatılırsa herkes her işlemi yapabilir; kullanıcı tanımları saklanır ve şifreyle yeniden açılabilir.</p></div>`;
}

function ayarGunluk() {
  const L = ui.f.log, kadilar = [...new Set(db.log.map(l => l.kadi))].sort();
  let rows = db.log.filter(l => (!L.bas || iso(new Date(l.ts)) >= L.bas) && (!L.bit || iso(new Date(l.ts)) <= L.bit) && (!L.kadi || l.kadi === L.kadi) && (!L.islem || l.islem === L.islem));
  rows = rows.slice().sort((a, b) => b.ts - a.ts);
  const filt = `<div class="satir"><label>Başlangıç<input type="date" data-set="log.bas" value="${L.bas}"></label><label>Bitiş<input type="date" data-set="log.bit" value="${L.bit}"></label>
<label>Kullanıcı<select data-set="log.kadi">${secenek([['', 'Tümü'], ...kadilar.map(k => [k, k || '(kullanıcısız)'])], L.kadi)}</select></label>
<label>İşlem<select data-set="log.islem">${secenek([['', 'Tümü'], ...Object.entries(LOG_AD)], L.islem)}</select></label>
<label class="ara">Ara<input id="ara-lg" data-filtre="lg" placeholder="açıklamada ara…" autocomplete="off"></label><button class="btn" data-act="csv-log">⬇ Excel (CSV)</button></div>`;
  return filt + `<div class="card">${rows.length ? tablo([{ b: 'Zaman', f: l => `<span class="nowrap">${saatMetni(l.ts)}</span>` }, { b: 'Kullanıcı', f: l => l.kadi ? `${esc(l.ad)}<div class="alt">${esc(l.kadi)} · ${esc(ROLLER[l.rol] ? ROLLER[l.rol].ad : l.rol)}</div>` : '<span class="mut">(kullanıcısız)</span>' },
    { b: 'İşlem', f: l => chip(LOG_AD[l.islem] || l.islem, ['GIRIS_HATA', 'SIL'].includes(l.islem) ? 'wr' : '') }, { b: 'Açıklama', f: l => esc(l.aciklama) }], rows.slice(0, 500),
    { id: 'tb-lg', attr: l => `data-ad="${esc(trLower(l.aciklama + ' ' + l.kadi + ' ' + (LOG_AD[l.islem] || l.islem)))}" data-grup="all"` }) +
    (rows.length > 500 ? `<p class="mut kucuk">En yeni 500 satır gösteriliyor (${rows.length}). Süzgeçleri daraltın veya CSV'ye aktarın.</p>` : '') : bos('Bu süzgeçle günlük kaydı yok.')}
<p class="mut kucuk">Günlük en fazla ${nf0.format(LOG_MAX)} satır tutulur${db.logKirpilan ? ` (şimdiye kadar ${nf0.format(db.logKirpilan)} eski satır kırpıldı)` : ''}. Günlük uygulama içinde silinemez; yedekler günlüğü de içerir. Günlük bir işlem takip kaydıdır; teknik olarak yedek dosyası düzenlenerek değiştirilebileceği için hukuki/güvenlik kanıtı olarak görülmemelidir.</p></div>`;
}

async function yedekListesiDoldur() {
  const el = $('yedek-liste'); if (!el) return;
  let html = '';
  try {
    if (Klasor.durum === 'tamam') {
      const l = await Klasor.listele();
      for (const x of l.slice(0, 15)) { try { const c = yedekCoz(await Klasor.oku(x.ad)); x.ic = c.hata ? '—' : `${c.kart} kart · ${c.hr} hareket`; } catch (e) { x.ic = '—'; } }
      html += `<h4>${Klasor.tur === 'dosya' ? '📄 Yedek dosyası' : '📁 Klasördeki yedekler'}</h4>${l.length ? tablo([{ b: 'Dosya', f: x => esc(x.ad) }, { b: 'Tarih', f: x => new Date(x.degisim).toLocaleString('tr-TR') }, { b: 'İçerik', f: x => esc(x.ic || '—') }, { b: 'Boyut', c: 'sag', f: x => nf0.format(x.boyut / 1024) + ' KB' },
        { b: '', f: x => `<button class="btn kucuk" data-act="yedek-klasor-yukle" data-id="${esc(x.ad)}">Geri yükle</button>` }], l.slice(0, 40)) : '<p class="mut">Konumda yedek yok.</p>'}`;
    }
    if (Depo.ok) {
      const l = await Depo.snapListe();
      html += `<h4>🌐 Tarayıcı içi anlık görüntüler</h4>${l.length ? tablo([{ b: 'Zaman', f: x => new Date(x.ts).toLocaleString('tr-TR') }, { b: 'Tür', f: x => esc(x.etiket) }, { b: 'İçerik', f: x => { try { const c = yedekCoz(x.json); return c.hata ? '—' : `${c.kart} kart · ${c.hr} hareket`; } catch (e) { return '—'; } } }, { b: 'Boyut', c: 'sag', f: x => nf0.format(x.boyut / 1024) + ' KB' },
        { b: '', f: x => `<button class="btn kucuk" data-act="yedek-snap-yukle" data-id="${x.ts}">Geri yükle</button>` }], l.slice(0, 30)) : '<p class="mut">Henüz görüntü yok (ilk değişiklikten sonra oluşur).</p>'}`;
    }
  } catch (e) { html += `<p class="mut">Liste okunamadı: ${esc(e.message || e)}</p>`; }
  el.innerHTML = html || '<p class="mut">Yedek listesi için yedek konumu seçin.</p>';
}

// ============================ DURUM / BANNER / BİLDİRİM ============================
function durumGuncelle() {
  const el = $('kayit-durum'); if (!el) return;
  let t, k = 'ok';
  const y = Kayit.yedekDurumu();
  if (db._yeni) { t = '⛔ Salt okunur'; k = 'er'; }
  else if (Kayit.eskiSekme) { t = '⚠️ Başka sekmede değişti'; k = 'er'; }
  else if (Kayit.bekleyen) { t = '⏳ Kaydediliyor…'; k = 'wr'; }
  else {
    const z = Kayit.sonKayit || db.gun; const s = z ? new Date(z).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    t = '💾 Kaydedildi' + (s ? ' ' + s : '');
    if (y.kod === 'tamam') t += ` · ${Klasor.tur === 'dosya' ? '📄' : '📁'} yedek ✓`;
    else { t += y.kod === 'kayip' ? ' · ⚠ yedek konumu yok' : ' · ⚠ yedek yok'; k = y.seviye === 'hata' ? 'er' : 'wr'; }
    if (Kayit.hata) k = 'er';
  }
  el.textContent = t; el.className = 'durum ' + k; el.title = Kayit.hata || Klasor.hata || '';
  const ky = $('kul'); if (ky) { if (authAktif() && oturum) { ky.hidden = false; ky.textContent = `👤 ${oturum.ad} · ${ROLLER[oturum.rol] ? ROLLER[oturum.rol].ad : ''}`; } else ky.hidden = true; }
}
function bannerGuncelle() {
  const el = $('banner'); if (!el) return;
  const m = [];
  if (db._yeni) m.push(['er', `⛔ Bu veri daha yeni bir sürümle kaydedilmiş (veri biçimi v${db.v}); bu dosya v${DB_SEMA} biçimini destekler. Verinizi bozmamak için kayıt kapatıldı. Güncel <code>index.html</code> dosyasını kullanın.`, '']);
  if (Kayit.eskiSekme) m.push(['er', 'Bu uygulama başka bir sekmede/pencerede de açık ve orada değişiklik yapıldı. Verilerin üzerine yazmamak için bu sekmede kayıt durduruldu.', '<button class="btn kucuk" data-act="yenile">Sayfayı yenile</button>']);
  if (!Depo.ok && !Kayit.eskiSekme) m.push(['er', 'Tarayıcı veritabanı kullanılamıyor (' + esc(Depo.hata || 'bilinmeyen neden') + '). Veriler yalnızca geçici kopyada ve yedek konumunda tutuluyor.', '']);
  const ym = yedekMesaj(); if (ym && !db._yeni) m.push([ym.s, ym.t, ym.b]);
  if (SurumDenetim.yeni && izin('ayar')) m.push(['wr', `🆕 Yeni sürüm var: <b>${esc(SurumDenetim.yeni.surum)}</b> (sizde ${SURUM}).`, '<button class="btn kucuk pri" data-act="surum-yeni">Ayrıntı ve güncelleme</button>']);
  if (ui.eskiDosya) m.push(['wr', `Bu dosya (sürüm ${SURUM}), verinin en son kullanıldığı sürümden (${esc(ui.eskiDosya)}) daha eski. Yeni özellikler eksik olabilir; güncel <code>index.html</code>'e geçin.`, '']);
  el.innerHTML = m.map(([k, t, b]) => `<div class="ban ${k}"><span>${t}</span><span class="nowrap">${b}</span></div>`).join('');
}

function bildir(msg, tur) {
  const t = $('toast'); if (!t) return;
  const e = document.createElement('div'); e.className = 'ti ' + (tur || 'ok'); e.textContent = msg; t.appendChild(e);
  setTimeout(() => e.classList.add('go'), 20); setTimeout(() => e.remove(), tur === 'er' ? 7000 : 3800);
}
function modal(baslikT, govde, butonlar) {
  $('dlg').innerHTML = `<div class="mh"><h3>${baslikT}</h3><button class="ib" data-act="modal-kapat">✕</button></div><div class="mb">${govde}</div><div class="ma">${butonlar || '<button class="btn" data-act="modal-kapat">Kapat</button>'}</div>`;
  if (!$('dlg').open) $('dlg').showModal();
}
let modalGeri = null;
function onayla(baslikT, mesaj, neden, tamam, geri) {
  modalGeri = geri;
  modal(baslikT, `<p>${mesaj}</p>${neden ? `<label class="gen blk">${neden}<input id="md-neden" autocomplete="off"></label>` : ''}`,
    `<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="modal-tamam">${tamam}</button>`);
}
const sonuc = (r, ok) => { if (r.ok) { bildir(r.msg || ok || 'Tamam', 'ok'); } else bildir(r.msg || 'İşlem yapılamadı', 'er'); return r.ok; };

// ============================ OLAYLAR ============================
const ACT = {
  git: el => { location.hash = el.dataset.p; },
  'ayar-git': () => { location.hash = 'ayar'; },
  sekme: el => { ui.tab[el.dataset.g] = el.dataset.k; render(); },
  seg: el => { ui.f.seg[el.dataset.t] = el.dataset.v; document.querySelectorAll(`#seg-${el.dataset.t} button`).forEach(b => b.classList.toggle('on', b === el)); filtreUygula(el.dataset.t); },
  'modal-kapat': () => $('dlg').close(),
  'modal-tamam': () => { const n = val('md-neden'); const f = modalGeri; $('dlg').close(); if (f) f(n); },
  yenile: () => location.reload(),
  ornek: () => { if (sonuc(ornekVeri())) render(); },
  aralik: el => { const A = ui.f.analiz, bu = bugun(), n = el.dataset.n; A.tum = n === 'tum'; if (n === 'tum') { A.bas = A.bit = ''; } else if (n === 'ay') { A.bas = bu.slice(0, 8) + '01'; A.bit = bu; } else { A.bas = gunEkle(bu, -(+n)); A.bit = bu; } render(); },
  // --- alış / satış / zayiat / sayım ---
  'alis-kaydet': () => {
    const s = [...document.querySelectorAll('#tb-al tbody tr')].map(tr => ({ kart: +tr.dataset.kart, mik: sayiOku(tr.querySelector('[data-f=mik]').value), bm: tr.querySelector('[data-f=fy]') ? sayiOku(tr.querySelector('[data-f=fy]').value) : NaN }));
    if (sonuc(alisKaydet(val('al-t') || bugun(), s, val('al-not')))) render();
  },
  'satis-kaydet': () => {
    const s = [...document.querySelectorAll('#tb-sa tbody tr')].map(tr => ({ kart: +tr.dataset.kart, mik: sayiOku(tr.querySelector('[data-f=mik]').value), fiyat: sayiOku(tr.querySelector('[data-f=fy]').value) }));
    if (sonuc(satisKaydet(val('sa-t') || bugun(), s, val('sa-not')))) render();
  },
  'zayiat-kaydet': () => {
    const s = [...document.querySelectorAll('#tb-za tbody tr')].map(tr => ({ kart: +tr.dataset.kart, mik: sayiOku(tr.querySelector('[data-f=mik]').value) }));
    if (sonuc(zayiatKaydet(val('za-t') || bugun(), s, val('za-neden'), val('za-not')))) render();
  },
  'sayim-incele': () => {
    const o = sayimOku(); if (!o.satirlar.length) return bildir('Sayılan miktar girilmedi.', 'er');
    const lines = o.satirlar.map(x => { const c = canli(x.kart), fark = x.sayilan - c.net; return { kart: x.kart, sis: c.net, say: x.sayilan, fark: Math.abs(fark) > 0.001 ? fark : 0, ort: c.ort, neden: x.neden || o.genel }; });
    const fl = lines.filter(l => l.fark !== 0), eksik = fl.filter(l => !l.neden);
    if (eksik.length) return bildir('Fark nedeni seçin (genel neden veya satır bazında): ' + eksik.map(l => kartAd(l.kart)).join(', '), 'er');
    const eks = fl.filter(l => l.fark < 0).reduce((a, l) => a - l.fark * l.ort, 0), faz = fl.filter(l => l.fark > 0).reduce((a, l) => a + l.fark * l.ort, 0);
    modalGeri = () => {
      const iz = val('md-izahat');
      if (fl.length && iz.trim().length < IZAHAT_MIN) return bildir(`Açıklama (izahat) zorunlu: farkların nedenini en az ${IZAHAT_MIN} karakterle yazın.`, 'er');
      const r = sayimKaydet(o.t, o.satirlar, o.not, o.genel, iz); if (sonuc(r)) { $('dlg').close(); render(); }
    };
    modal('Sayımı onayla', `<p><b>${lines.length}</b> kalem sayıldı, <b>${fl.length}</b> kalemde fark var (${trTarih(o.t)}).</p>` +
      (fl.length ? tablo([{ b: 'Ürün', f: l => esc(kartAd(l.kart)) }, { b: 'Sistem', c: 'sag', f: l => mikF(l.sis) }, { b: 'Sayılan', c: 'sag', f: l => mikF(l.say) },
        { b: 'Fark', c: 'sag', f: l => `<span class="${l.fark > 0 ? 'g' : 'c'}">${l.fark > 0 ? '+' : ''}${mikF(l.fark)} ${esc(kartBirim(l.kart))}</span>` }, { b: 'Değer', c: 'sag', f: l => tl(l.fark * l.ort) }, { b: 'Neden', f: l => esc(l.neden) }], fl) +
        `<p>Eksik toplamı: <b class="c">− ${tl(eks)}</b> &nbsp; Fazla toplamı: <b class="g">+ ${tl(faz)}</b> &nbsp; Net: <b>${tl(faz - eks)}</b></p>` +
        '<p class="mut kucuk">Eksikler stoktan düşülür ve kayıp olarak raporlanır; fazlalar stoğa eklenir. Geçmiş hareketleriniz değişmez; sayım fişi "Sayım geçmişi"nde saklanır ve gerekirse iptal edilebilir.</p>'
        : '<p class="mut">Sistemle fark yok. Sayım fişi "fark yok" olarak kaydedilecek.</p>') + izahatKutusu(fl.length > 0),
      '<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="modal-kaydet">Onayla ve kaydet</button>');
  },
  'sayim-detay': el => {
    const s = db.sayimlar.find(x => x.kod === el.dataset.id); if (!s) return;
    modal(`Sayım fişi — ${trTarih(s.t)}`, `<p class="mut kucuk">${esc(s.kod)}${s.not ? ' · ' + esc(s.not) : ''}</p>` + tablo([{ b: 'Ürün', f: l => esc(kartAd(l.kart)) }, { b: 'Sistem', c: 'sag', f: l => mikF(l.sis) }, { b: 'Sayılan', c: 'sag', f: l => mikF(l.say) },
      { b: 'Fark', c: 'sag', f: l => l.fark ? `<span class="${l.fark > 0 ? 'g' : 'c'}">${l.fark > 0 ? '+' : ''}${mikF(l.fark)}</span>` : '✓' }, { b: 'Değer', c: 'sag', f: l => l.fark ? tl(l.fark * l.bm) : '' }, { b: 'Neden', f: l => esc(l.neden) }], s.satirlar) +
      `<h4>Açıklama / izahat</h4>${s.izahat ? `<div class="izahat">${esc(s.izahat)}</div>` : '<p class="mut">(açıklama girilmemiş)</p>'}`,
      `<button class="btn" data-act="sayim-rapor" data-id="${esc(s.kod)}">🖨️ Raporu yazdır / PDF</button><button class="btn" data-act="modal-kapat">Kapat</button>`);
  },
  'sayim-rapor': el => {
    const s = db.sayimlar.find(x => x.kod === el.dataset.id); if (!s) return;
    $('rapor').innerHTML = sayimRaporHtml(s);
    document.body.classList.add('rp');
    if (typeof window.print === 'function') window.print();
    setTimeout(() => document.body.classList.remove('rp'), 1500);
  },
  'sayim-iptal': el => {
    const kod = el.dataset.id;
    onayla('Sayımı iptal et', `<b>${esc(kod)}</b> sayımının düzeltme hareketleri arşive taşınacak; stoklar sayımdan önceki haline dönecek.`, 'İptal nedeni (zorunlu)', 'Sayımı iptal et',
      n => { const ids = db.hr.filter(r => r.kod === kod && !r.sil).map(r => r.id); if (sonuc(kayitSil(ids, n || ''))) render(); });
  },
  // --- üretim ---
  'ur-ekle': el => { const s = el.dataset.s; $('ur-' + s).insertAdjacentHTML('beforeend', uretimSatiri(s)); },
  'ur-sil': el => { el.closest('.dr').remove(); liveUretim(); },
  'uretim-kaydet': () => {
    const r = uretimKaydet(val('ur-t') || bugun(), okuSatirlar('ur-g'), okuSatirlar('ur-c'), okuSatirlar('ur-y', true), sayiOku(val('ur-fire')), val('ur-not'));
    if (sonuc(r)) { ui.tab.ur = 'yeni'; render(); }
  },
  'seans-iptal': el => {
    const kod = el.dataset.id;
    onayla('Üretimi iptal et', `<b>${esc(kod)}</b> üretiminin tüm hareketleri (ham çıkış, mamül, yan ürün, fire) arşive taşınacak ve stoklar eski haline dönecek.`, 'İptal nedeni (zorunlu)', 'Üretimi iptal et',
      n => { const ids = db.hr.filter(r => r.kod === kod && !r.sil).map(r => r.id); if (sonuc(kayitSil(ids, n || ''))) render(); });
  },
  // --- hareketler ---
  'hr-sil': el => {
    const id = +el.dataset.id, r = db.hr.find(x => x.id === id); if (!r) return;
    onayla('Kaydı sil', `<b>${esc(kartAd(r.kart))}</b> · ${esc(TIP_AD[r.tip])} · ${mikF(r.mik)} ${esc(kartBirim(r.kart))} kaydı arşive taşınacak, stok buna göre değişecek.`, 'Silme nedeni (zorunlu)', 'Sil', n => { if (sonuc(kayitSil([id], n || ''))) render(); });
  },
  'hr-geri': el => { if (sonuc(kayitGeriAl([+el.dataset.id]))) render(); },
  'hr-duzenle': el => {
    const id = +el.dataset.id, r = db.hr.find(x => x.id === id); if (!r) return;
    const alan = r.tip === 'ALIS' ? `<label>Birim fiyat (₺)<input id="md-bm" inputmode="decimal" value="${String(r.bm).replace('.', ',')}"></label>` :
      r.tip === 'SATIS' ? `<label>Satış fiyatı (₺) <small>(boş = takribi)</small><input id="md-fy" inputmode="decimal" value="${r.fiyat != null ? String(r.fiyat).replace('.', ',') : ''}"></label>` :
        `<label>Neden<select id="md-ne">${secenek(ZAYIAT_NEDEN.map(x => [x, x]), r.neden)}</select></label>`;
    modalGeri = () => {
      const o = { t: val('md-t'), mik: sayiOku(val('md-mik')), not: val('md-not'), bm: sayiOku(val('md-bm')), fiyat: sayiOku(val('md-fy')), neden: val('md-ne') };
      if (sonuc(kayitDuzenle(id, o))) { $('dlg').close(); render(); }
    };
    modal(`Düzenle — ${esc(kartAd(r.kart))} (${TIP_AD[r.tip]})`, `<div class="mform"><label>Tarih<input type="date" id="md-t" value="${r.t}"></label><label>Miktar (${esc(kartBirim(r.kart))})<input id="md-mik" inputmode="decimal" value="${String(r.mik).replace('.', ',')}"></label>${alan}<label class="gen">Not<input id="md-not" value="${esc(r.not)}"></label></div>`,
      '<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="modal-kaydet">Kaydet</button>');
  },
  'modal-kaydet': () => { if (modalGeri) modalGeri(); },
  'csv-hr': () => {
    const l = db.hr.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id - b.id));
    dosyaIndir(`hareketler_${zamanDamga()}.csv`, csvMaliMetni(['Tarih', 'Ürün', 'Grup', 'Hareket', 'Yön', 'Miktar', 'Birim', 'Birim maliyet', 'Satış fiyatı', 'Neden', 'Not', 'Üretim kodu', 'Durum'],
      l.map(r => [r.t, kartAd(r.kart), K(r.kart) ? GRUP_KISA[K(r.kart).grup] : '', TIP_AD[r.tip], r.yon === 'G' ? 'gelen' : r.yon === 'C' ? 'giden' : 'fire', r.mik, kartBirim(r.kart), r.bm, r.fiyat ?? '', r.neden, r.not, r.kod, r.sil ? 'silindi' : ''])), 'text/csv;charset=utf-8');
  },
  'csv-stok': () => {
    const S = ui.f.stok, bu = bugun(); const bas = S.donem === 'bugun' ? bu : S.donem === 'hafta' ? gunEkle(bu, -6) : S.donem === 'ay' ? bu.slice(0, 8) + '01' : S.donem === 'aralik' ? S.bas : null, bit = S.donem === 'aralik' ? S.bit : (S.donem === 'tum' ? null : bu);
    const d = defter(bas || null, bit || null);
    dosyaIndir(`stok_${zamanDamga()}.csv`, csvMaliMetni(['Ürün', 'Kategori', 'Grup', 'Birim', 'Devir', 'Gelen', 'Satılan', 'Üretimde kullanılan', 'Diğer çıkış', 'Kalan', 'Ort. maliyet', 'Stok değeri', 'Takribi satış değeri', 'Asgari'],
      kartlarSirali().map(k => d.get(k.id)).map(x => [x.kart.ad, x.kart.kat, GRUP_KISA[x.kart.grup], x.kart.birim, x.devir, x.gelen, x.satilan, x.kullanilan, x.diger, x.kalan, x.ort, x.deger, x.takribi, x.kart.asgari])), 'text/csv;charset=utf-8');
  },
  // --- kartlar ---
  'kart-ekle': () => {
    const o = { ad: val('nk-ad'), kat: val('nk-kat'), grup: val('nk-grup'), birim: val('nk-birim'), asgari: sayiOku(val('nk-asgari')), kar: val('nk-kar') === '' ? '' : sayiOku(val('nk-kar')) };
    if (sonuc(kartEkle(o), 'Kart eklendi.')) render();
  },
  'aktar-sec': () => { if (!izin('kart')) return bildir('Bu işlem için yetkiniz yok.', 'er'); $('aktar-dosya').click(); },
  'aktar-uygula': () => {
    const a = ui.aktar; if (!a) return; aktarFormOku();
    const r = aktarUygula(aktarSatirlar(), { acilis: ui.aktar.acilis, tarih: ui.aktar.tarih || bugun(), dosya: a.ad });
    if (!r.ok) return bildir(r.msg, 'er');
    ui.aktar = null; $('dlg').close(); bildir(r.msg, 'ok'); render();
  },
  'kart-toplu': () => {
    const gm = { ham: 'HAM', mamül: 'MAMUL', mamul: 'MAMUL', ticari: 'TICARI' };
    let ok = 0; const hata = [];
    val('toplu').split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((s, i) => {
      const p = s.split(';').map(x => x.trim()); const g = gm[trLower(p[2] || '')];
      if (!p[0] || !g) { hata.push(`Satır ${i + 1}: grup (Ham/Mamül/Ticari) eksik`); return; }
      const r = kartEkle({ ad: p[0], kat: p[1] || '', grup: g, birim: p[3] || (g === 'TICARI' ? 'Adet' : 'KG'), asgari: sayiOku(p[4]) });
      if (r.ok) ok++; else hata.push(`Satır ${i + 1}: ${r.msg}`);
    });
    bildir(`${ok} kart eklendi.` + (hata.length ? ' ' + hata.join(' | ') : ''), hata.length ? 'er' : 'ok'); render();
  },
  'kart-duzenle': el => {
    const id = +el.dataset.id, k = K(id); if (!k) return;
    modalGeri = () => {
      const o = { ad: val('ek-ad'), kat: val('ek-kat'), grup: val('ek-grup'), birim: val('ek-birim'), asgari: sayiOku(val('ek-asgari')), kar: val('ek-kar') === '' ? '' : sayiOku(val('ek-kar')) };
      if (sonuc(kartGuncelle(id, o), 'Kart güncellendi.')) { $('dlg').close(); render(); }
    };
    modal('Kartı düzenle', kartForm(k, 'ek-') + (kartHareketVar(id) ? '<p class="mut kucuk">Bu kartın hareketleri var: ad, grup veya birim değişince geçmiş kayıtlar yeni haliyle görünür (miktarlar dönüştürülmez).</p>' : ''),
      '<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="modal-kaydet">Kaydet</button>');
  },
  'kart-pasif': el => { const id = +el.dataset.id, k = K(id); kartPasif(id, k.aktif !== false); render(); },
  'kart-sil': el => { const id = +el.dataset.id; onayla('Kartı sil', `<b>${esc(kartAd(id))}</b> kartı silinecek.`, '', 'Sil', () => { if (sonuc(kartSil(id), 'Kart silindi.')) render(); }); },
  // --- ayarlar / yedek ---
  'ayar-kaydet': () => {
    const kar = sayiOku(val('ay-kar')); if (!isFinite(kar) || kar < 0) return bildir('Kâr oranı 0 veya daha büyük bir sayı olmalı.', 'er');
    db.firma = val('ay-firma').trim() || 'İşletmem'; db.ayar.kar = kar; degisti(); bildir('Ayarlar kaydedildi.'); render();
  },
  'klasor-sec': async () => {
    try { await Klasor.sec(); await Kayit.flush('zorla'); bildir('Yedek klasörü seçildi; ilk yedek yazıldı.'); } catch (e) { if (e.name !== 'AbortError') bildir('Klasör seçilemedi: ' + (e.message || e), 'er'); }
    bannerGuncelle(); durumGuncelle(); render();
  },
  'klasor-izin': async () => { await Klasor.izinVer(); if (Klasor.durum === 'tamam') { await Kayit.flush('zorla'); bildir('İzin verildi, yedek yazıldı.'); } bannerGuncelle(); durumGuncelle(); render(); },
  'yedek-simdi': async () => { Kayit.bekleyen = true; await Kayit.flush('zorla'); bildir(Kayit.hata ? Kayit.hata : (Klasor.durum === 'tamam' ? 'Yedek klasöre ve tarayıcıya yazıldı.' : 'Tarayıcı kaydı alındı (klasör seçilmedi).'), Kayit.hata ? 'er' : 'ok'); render(); },
  'yedek-indir': () => { dosyaIndir(`stok_portal_yedek_${zamanDamga()}.json`, JSON.stringify(db)); Kayit.sonIndirme = Date.now(); bildir('Yedek dosyası indirildi.'); },
  'yedek-ac': () => $('dosya').click(),
  'yedek-klasor-yukle': async el => { const m = await Klasor.oku(el.dataset.id); yedekOnay(m, el.dataset.id); },
  'yedek-snap-yukle': async el => { const l = await Depo.snapListe(); const x = l.find(s => s.ts === +el.dataset.id); if (x) yedekOnay(x.json, new Date(x.ts).toLocaleString('tr-TR')); },
  sifirla: () => !izin('ayar') ? bildir('Bu işlem için yetkiniz yok.', 'er') : onayla('Tüm verileri sil', 'Bütün kartlar ve hareketler silinecek. İşlemden hemen önce bir anlık görüntü alınır (Ayarlar → yedek listesinden geri yüklenebilir). Devam etmek için kutuya <b>SİL</b> yazın.', 'Onay', 'Hepsini sil',
    async n => { if ((n || '').trim() !== 'SİL') return bildir('Onay metni yanlış; işlem yapılmadı.', 'er'); await Kayit.oncesi('Silme öncesi'); const eskiDb = db; db = bosDb(); db.firma = eskiDb.firma; db.ayar = eskiDb.ayar; db.kullanicilar = eskiDb.kullanicilar; db.guvenlik = eskiDb.guvenlik; db.log = eskiDb.log; db.logKirpilan = eskiDb.logKirpilan; db.app = eskiDb.app; logYaz('YEDEK', 'Tüm stok verileri silindi'); degisti(); await Kayit.flush('zorla'); bildir('Tüm veriler silindi.'); render(); }),
};
function yedekOnay(metin, kaynak) {
  if (!izin('ayar')) return bildir('Bu işlem için yetkiniz yok.', 'er');
  const c = yedekCoz(metin); if (c.hata) return bildir(c.hata, 'er');
  const bos_ = c.kart === 0 && c.hr === 0;
  onayla('Yedekten geri yükle', `<b>${esc(kaynak)}</b><br>${c.kart} kart · ${c.hr} hareket · son değişiklik ${c.gun ? new Date(c.gun).toLocaleString('tr-TR') : '—'} · sürüm ${esc(c.surum)}<br>${bos_ ? '<div class="ban er"><span>⚠️ <b>Bu yedek boş</b> (0 kart, 0 hareket). Geri yüklerseniz mevcut kartlarınız ve hareketleriniz bu boş yedekle değişir. Doğru dosyayı seçtiğinizden emin olun; Vazgeç demeniz önerilir.</span></div>' : ''}<br>Mevcut verilerin yerine geçecek (kullanıcı tanımları ve günlük de yedektekiyle değişir). İşlemden önce mevcut durumun anlık görüntüsü alınır.`, '', bos_ ? 'Yine de geri yükle' : 'Geri yükle',
    async () => { await yedekUygula(c.o, kaynak); bildir('Yedek geri yüklendi.'); render(); });
}

// ---------- yetkiye göre gizleme (personel / izleyici maliyet, kâr, ciro görmez) ----------
const MALI_BASLIK = ['Ort. maliyet', 'Son ort. maliyet', 'Stok değeri', 'Takribi satış değeri', 'Birim maliyet', 'Satış fiyatı', 'Değer', 'Girdi maliyeti', 'Tahmini tutar', 'Değer (maliyet)'];
const MALI_TABLO = { 'tb-al': ['Ort. maliyet', 'Birim fiyat (₺)', 'Tutar'], 'tb-sa': ['Ort. maliyet', 'Takribi fiyat'], 'tb-za': ['Ort. maliyet', 'Kayıp değeri'] };
function maskele() {
  if (izin('mali')) return;
  document.querySelectorAll('#app table.tbl').forEach(t => {
    const liste = (t.id && MALI_TABLO[t.id]) || MALI_BASLIK;
    t.querySelectorAll('tfoot').forEach(f => f.remove());
    const idx = []; [...t.querySelectorAll('thead th')].forEach((th, i) => { if (liste.includes(th.textContent.trim())) idx.push(i); });
    if (!idx.length) return;
    t.querySelectorAll('tr').forEach(tr => { const c = [...tr.children].filter(x => x.tagName); idx.slice().reverse().forEach(i => { if (c[i]) c[i].remove(); }); });
  });
}
const MALI_CSV = ['Birim maliyet', 'Satış fiyatı', 'Ort. maliyet', 'Stok değeri', 'Takribi satış değeri'];
function csvMaliMetni(basliklar, satirlar) {
  if (izin('mali')) return csvMetni(basliklar, satirlar);
  const at = new Set(basliklar.map((b, i) => (MALI_CSV.includes(b) ? i : -1)).filter(i => i >= 0));
  return csvMetni(basliklar.filter((_, i) => !at.has(i)), satirlar.map(s => s.filter((_, i) => !at.has(i))));
}
function panelBasit() {
  const bu = bugun(), sd = stokDegerleri(), ky = uyarilar();
  const bd = [...defter(bu, bu).values()].filter(x => x.kart.aktif !== false && (x.gelen || x.satilan || x.kullanilan || x.diger));
  return baslik('🏠', esc(db.firma), 'Bugünün stok durumu.') +
    `<div class="grid g4">${GRUPLAR.map(g => kpi(`${GRUP_IKON[g]} ${GRUP_AD[g]}`, `${sd[g].n} kalem stokta`, '')).join('')}${kpi('⚠️ Dikkat', ky.length + ' kart', 'asgari altı veya eksi stok')}</div>
<div class="card"><h3>⚠️ Dikkat edilecekler</h3>${ky.length ? `<ul class="uyl">${ky.map(({ d, x }) => `<li>${durumChip(d)} <b>${esc(x.kart.ad)}</b> — kalan ${mikF(x.kalan)} ${esc(x.kart.birim)}${d === 'dusuk' ? ` (asgari ${mikF(x.kart.asgari)})` : ''}</li>`).join('')}</ul>` : '<p class="mut">Asgari seviyenin altında veya eksi stoklu kart yok. ✅</p>'}</div>
<div class="card"><h3>Bugün (${trTarih(bu)}) — gelen / giden / kalan</h3>${bd.length ? tablo([{ b: 'Ürün', f: x => kartEtiket(x.kart) }, { b: 'Birim', f: x => esc(x.kart.birim) }, { b: 'Devir', c: 'sag', f: x => mikF(x.devir) },
      { b: 'Gelen', c: 'sag', f: x => mikF(x.gelen) }, { b: 'Satılan', c: 'sag', f: x => mikF(x.satilan) }, { b: 'Üretimde kullanılan', c: 'sag', f: x => mikF(x.kullanilan) },
      { b: 'Diğer çıkış', c: 'sag', f: x => mikF(x.diger) }, { b: 'Kalan', c: 'sag kalin', f: x => mikF(x.kalan) }], bd) : bos('Bugün henüz hareket yok.')}</div>`;
}

// ---------- sayfa yetkileri ----------
const SAYFA_IZIN = { panel: 'gor', alis: 'giris', uretim: 'giris', satis: 'giris', zayiat: 'giris', stok: 'gor', hareket: 'gor', sayim: 'sayim', analiz: 'mali', kartlar: 'kart' };
const sayfaIzni = k => (k === 'ayar' ? (izin('ayar') || izin('kullanici') || izin('log')) : izin(SAYFA_IZIN[k] || 'gor'));

// ---------- kilit / giriş ekranı ----------
function kilitGoster(mod, ek) {
  const el = $('kilit'); if (!el) return;
  $('app').innerHTML = ''; $('nav').innerHTML = ''; const k = $('kul'); if (k) k.hidden = true;
  const ad = esc(db.firma), mesaj = '<div id="kg-msg" class="not er" hidden></div>';
  let g = '';
  if (mod === 'giris') g = `<h2>🔒 ${ad}</h2><p class="mut">Devam etmek için giriş yapın.</p><label>Kullanıcı adı<input id="kg-kadi" autocomplete="username"></label><label>Şifre<input id="kg-sifre" type="password" autocomplete="current-password"></label>${mesaj}
<button class="btn pri blok" data-act="giris-yap">Giriş yap</button><button class="btn gh blok" data-act="kurtarma-ac">Şifremi unuttum (kurtarma kodu)</button>${ek || ''}`;
  else if (mod === 'kurtarma') g = `<h2>🔑 Yönetici şifresini kurtar</h2><p class="mut">Giriş korumasını ilk açtığınızda gösterilen kurtarma kodunu girin.</p><label>Kurtarma kodu<input id="kr-kod" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autocomplete="off"></label>
<label>Yönetici kullanıcı adı<input id="kr-kadi" autocomplete="off"></label><label>Yeni şifre (en az ${SIFRE_MIN})<input id="kr-s1" type="password" autocomplete="new-password"></label><label>Yeni şifre (tekrar)<input id="kr-s2" type="password" autocomplete="new-password"></label>${mesaj}
<button class="btn pri blok" data-act="kurtarma-yap">Şifreyi sıfırla</button><button class="btn gh blok" data-act="giris-geri">← Girişe dön</button>`;
  else if (mod === 'zorla') g = `<h2>🔑 Yeni şifre belirleyin</h2><p class="mut">Geçici şifreyle girdiniz; devam etmeden önce kendi şifrenizi belirleyin.</p><label>Yeni şifre (en az ${SIFRE_MIN})<input id="zs-1" type="password" autocomplete="new-password"></label><label>Yeni şifre (tekrar)<input id="zs-2" type="password" autocomplete="new-password"></label>${mesaj}<button class="btn pri blok" data-act="zorla-kaydet">Şifreyi kaydet</button>`;
  else if (mod === 'kod') g = `<h2>🧾 Kurtarma kodunuz</h2><p>Yönetici şifresi unutulursa <b>tek kurtarma yolu</b> bu koddur. <b>Yalnızca bir kez gösterilir.</b> Yazdırın veya güvenli bir yere not edin.</p><div class="kod">${esc(ek.kod)}</div>
<button class="btn blok" data-act="kod-yazdir">🖨️ Yazdır</button><button class="btn pri blok" data-act="kod-tamam">Kodu kaydettim, devam</button>`;
  else if (mod === 'yeniSurum') g = `<h2>⛔ Daha yeni sürümle kaydedilmiş veri</h2><p>Verileriniz <b>veri biçimi v${db.v}</b> ile kaydedilmiş; bu dosya yalnızca v${DB_SEMA} biçimini destekler (sürüm ${SURUM}). Verinizi bozmamak için bu dosya <b>veriye dokunmaz ve kayıt yapmaz</b>.</p><p>Çözüm: güncel <code>index.html</code> dosyasını indirip onunla açın.</p>`;
  el.innerHTML = `<div class="kutu">${g}</div>`; el.hidden = false;
  const ilk = el.querySelector('input'); if (ilk && ilk.focus) ilk.focus();
}
function kilitGizle() { const el = $('kilit'); if (el) { el.hidden = true; el.innerHTML = ''; } }
const kilitMesaj = m => { const e = $('kg-msg'); if (e) { e.textContent = m; e.hidden = false; } };
function girisSonrasi() { render(); if (ui.surumNotu) surumNotuGoster(); else yedekKapisi(); }
function surumNotuGoster() {
  const n = ui.surumNotu; ui.surumNotu = null; if (!n) return yedekKapisi();
  const l = DEGISIKLIKLER.filter(d => surumKarsilastir(d.s, n.eski) > 0 && surumKarsilastir(d.s, n.yeni) <= 0);
  modalGeri = null;
  modal('🆕 Uygulama güncellendi', `<p>Sürüm <b>${esc(n.eski)}</b> → <b>${esc(n.yeni)}</b>. Verileriniz korundu; güncellemeden önce otomatik yedek (anlık görüntü) alındı.</p><h4>Neler yeni?</h4>${l.map(d => `<b>${esc(d.s)}</b><ul class="yardim">${d.n.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') || '<p class="mut">Ayrıntı yok.</p>'}`,
    '<button class="btn pri" data-act="surum-tamam">Tamam</button>');
}
/** Yedek konumu seçilmemiş/bulunamadıysa açılışta (oturum başına bir kez) seçim penceresi. */
function yedekKapisi() {
  if (db._yeni) return;
  const d = Kayit.yedekDurumu(); let atla = false; try { atla = !!sessionStorage.getItem('sos_gate'); } catch (e) { /* yoksay */ }
  if (atla || d.kod === 'tamam' || d.kod === 'izin' || !izin('ayar')) return;
  if (d.kod === 'desteklenmiyor' && !(db.hr.length + db.kartlar.length)) return;
  const kayip = d.kod === 'kayip', hata = d.kod === 'hata', yok = d.kod === 'yok';
  const baslikT = kayip ? '⚠️ Yedek konumu bulunamadı' : hata ? '⚠️ Yedek konumuna yazılamıyor' : yok ? '💾 Yedek konumu seçin' : '⚠️ Yedek alınamıyor';
  const metin = kayip ? `Seçtiğiniz yedek konumu (“${esc(Klasor.ad)}”) silinmiş, taşınmış veya sürücüsü takılı değil. Verileriniz şu anda <b>yalnızca bu tarayıcıda</b> tutuluyor; yedek alınmıyor.`
    : hata ? `Yedek konumuna yazılamadı: ${esc(Klasor.hata)}. Veriler şu an <b>yalnızca bu tarayıcıda</b>.`
      : yok ? 'Verileriniz bu tarayıcıda saklanır; tarayıcı verisi silinirse veya bozulursa geri getirilemez. Bir <b>yedek klasörü</b> (önerilen) veya <b>tek yedek dosyası</b> seçin: seçtikten sonra <b>her değişiklik anında oraya yedeklenir</b>.'
        : 'Bu tarayıcı yedek konumuna otomatik yazamaz (Chrome veya Edge gerekir). Verileriniz yalnızca bu tarayıcıda; düzenli olarak yedeği indirin.';
  modalGeri = null;
  modal(baslikT, `<p>${metin}</p><p class="mut kucuk">Konum seçilmezse veri tarayıcıda tutulmaya devam eder, ancak üstte uyarı görünür ve yedeksiz sekme kapatırken onay istenir.</p>`,
    `${Klasor.destek ? '<button class="btn pri" data-act="klasor-sec">📁 Yedek klasörü seç</button>' : ''}${Klasor.dosyaDestek ? '<button class="btn" data-act="dosya-sec">📄 Tek dosya seç</button>' : ''}<button class="btn" data-act="yedek-indir">⬇ Yedeği indir</button><button class="btn gh" data-act="gate-atla">Şimdilik tarayıcıda tut</button>`);
}
function hesabimGoster() {
  const u = oturum && db.kullanicilar.find(x => x.id === oturum.id); if (!u) return;
  modalGeri = null;
  modal('👤 Hesabım', `<table class="tbl mali"><tbody><tr><td>Ad</td><td class="sag">${esc(u.ad)}</td></tr><tr><td>Kullanıcı adı</td><td class="sag">${esc(u.kadi)}</td></tr><tr><td>Rol</td><td class="sag">${esc(ROLLER[u.rol].ad)}</td></tr><tr><td>Son giriş</td><td class="sag">${saatMetni(u.sonGiris)}</td></tr><tr><td>Sürüm</td><td class="sag">${SURUM}</td></tr></tbody></table>
<h4>Şifre değiştir</h4><div class="mform"><label>Mevcut şifre<input id="hs-eski" type="password" autocomplete="current-password"></label><span></span><label>Yeni şifre (en az ${SIFRE_MIN})<input id="hs-yeni" type="password" autocomplete="new-password"></label><label>Yeni şifre (tekrar)<input id="hs-yeni2" type="password" autocomplete="new-password"></label></div>`,
    '<button class="btn" data-act="modal-kapat">Kapat</button><button class="btn" data-act="sifre-degistir">Şifreyi değiştir</button><button class="btn dng" data-act="cikis">Çıkış yap</button>');
}

Object.assign(ACT, {
  'giris-yap': async () => {
    const r = await girisYap(val('kg-kadi'), val('kg-sifre')); if (!r.ok) return kilitMesaj(r.msg);
    kilitGizle(); ui.sonEtkinlik = Date.now(); if (r.zorla) return kilitGoster('zorla'); girisSonrasi();
  },
  'kurtarma-ac': () => kilitGoster('kurtarma'), 'giris-geri': () => kilitGoster('giris'),
  'kurtarma-yap': async () => {
    if (val('kr-s1') !== val('kr-s2')) return kilitMesaj('Şifreler aynı değil.');
    const r = await kurtarmaIleSifirla(val('kr-kod'), val('kr-kadi'), val('kr-s1')); if (!r.ok) return kilitMesaj(r.msg);
    ui.yeniKod = r.kod; kilitGoster('kod', { kod: r.kod }); ui.kodSonra = 'giris';
  },
  'zorla-kaydet': async () => {
    if (val('zs-1') !== val('zs-2')) return kilitMesaj('Şifreler aynı değil.');
    const r = await sifreBelirle(val('zs-1'), ''); if (!r.ok) return kilitMesaj(r.msg); kilitGizle(); girisSonrasi();
  },
  'kod-yazdir': () => { $('rapor').innerHTML = `<h1>${esc(db.firma)} — Kurtarma kodu</h1><p>Yönetici şifresi unutulursa bu kod gerekir. Güvenli bir yerde saklayın.</p><p style="font-size:22px;letter-spacing:2px"><b>${esc(ui.yeniKod || '')}</b></p>`; document.body.classList.add('rp'); if (typeof window.print === 'function') window.print(); setTimeout(() => document.body.classList.remove('rp'), 1500); },
  'kod-tamam': () => { ui.yeniKod = ''; if (ui.kodSonra === 'giris') { ui.kodSonra = ''; kilitGoster('giris'); } else { kilitGizle(); girisSonrasi(); } },
  hesabim: () => hesabimGoster(),
  'sifre-degistir': async () => {
    if (val('hs-yeni') !== val('hs-yeni2')) return bildir('Yeni şifreler aynı değil.', 'er');
    const r = await sifreDegistir(val('hs-eski'), val('hs-yeni')); if (sonuc(r)) $('dlg').close();
  },
  cikis: () => { $('dlg').close(); cikisYap(); ui.sayfa = 'panel'; kilitGoster('giris'); },
  'koruma-ac': async () => {
    if (val('kg-sifre') !== val('kg-sifre2')) return bildir('Şifreler aynı değil.', 'er');
    const r = await korumayiEtkinlestir({ kadi: val('kg-kadi'), ad: val('kg-ad'), sifre: val('kg-sifre') }); if (!r.ok) return bildir(r.msg, 'er');
    ui.yeniKod = r.kod; ui.kodSonra = ''; kilitGoster('kod', { kod: r.kod });
  },
  'koruma-yeniden': async () => { const r = await korumayiAc(val('kg-kadi'), val('kg-sifre')); if (sonuc(r, 'Giriş koruması açıldı.')) render(); },
  'koruma-kapat': () => onayla('Giriş korumasını kapat', 'Kapatılırsa herkes her işlemi yapabilir. Onay için kendi şifrenizi yazın.', 'Şifreniz', 'Korumayı kapat', async n => { const r = await korumayiKapat(n || ''); if (sonuc(r, 'Giriş koruması kapatıldı.')) render(); }),
  'kul-ekle': async () => { const r = await kullaniciEkle({ kadi: val('ku-kadi'), ad: val('ku-ad'), rol: val('ku-rol'), sifre: val('ku-sifre') }); if (sonuc(r)) render(); },
  'kul-duzenle': el => {
    const id = +el.dataset.id, u = db.kullanicilar.find(x => x.id === id); if (!u) return;
    modalGeri = () => { const r = kullaniciGuncelle(id, { ad: val('kd-ad'), rol: val('kd-rol'), aktif: val('kd-aktif') === '1' }); if (sonuc(r)) { $('dlg').close(); render(); } };
    modal(`Kullanıcıyı düzenle — ${esc(u.kadi)}`, `<div class="mform"><label>Ad soyad<input id="kd-ad" value="${esc(u.ad)}"></label><label>Rol<select id="kd-rol">${rolSecenek(u.rol)}</select></label><label>Durum<select id="kd-aktif">${secenek([['1', 'Aktif'], ['0', 'Pasif (giriş yapamaz)']], u.aktif === false ? '0' : '1')}</select></label></div>`,
      '<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="modal-kaydet">Kaydet</button>');
  },
  'kul-sifre': el => {
    const id = +el.dataset.id, u = db.kullanicilar.find(x => x.id === id); if (!u) return;
    onayla('Şifre sıfırla', `<b>${esc(u.kadi)}</b> için yeni bir <b>geçici şifre</b> belirleyin; kullanıcı ilk girişte kendi şifresini belirleyecek.`, `Geçici şifre (en az ${SIFRE_MIN})`, 'Sıfırla', async n => { if (sonuc(await sifreSifirla(id, n || ''))) render(); });
  },
  'csv-log': () => {
    const L = ui.f.log; const rows = db.log.filter(l => (!L.bas || iso(new Date(l.ts)) >= L.bas) && (!L.bit || iso(new Date(l.ts)) <= L.bit) && (!L.kadi || l.kadi === L.kadi) && (!L.islem || l.islem === L.islem));
    dosyaIndir(`gunluk_${zamanDamga()}.csv`, csvMetni(['Zaman', 'Kullanıcı adı', 'Ad', 'Rol', 'İşlem', 'Açıklama'], rows.map(l => [new Date(l.ts).toLocaleString('tr-TR'), l.kadi, l.ad, l.rol, LOG_AD[l.islem] || l.islem, l.aciklama])), 'text/csv;charset=utf-8');
  },
  'ayar-kaydet': () => { if (sonuc(ayarKaydet(val('ay-firma'), sayiOku(val('ay-kar')), sayiOku(val('ay-kilit'))))) render(); },
  'klasor-sec': async () => {
    try { await Klasor.sec(); await Kayit.flush('zorla'); if ($('dlg').open) $('dlg').close(); logYaz('YEDEK', `Yedek klasörü seçildi: ${Klasor.ad}`); degisti(); bildir(`Yedek klasörü seçildi: ${Klasor.ad}. Her değişiklik artık anında oraya yazılacak.`); }
    catch (e) { if (e.name !== 'AbortError') bildir('Klasör seçilemedi: ' + (e.message || e), 'er'); }
    bannerGuncelle(); durumGuncelle(); render();
  },
  'dosya-sec': async () => {
    try { await Klasor.dosyaSec(); await Kayit.flush('zorla'); if ($('dlg').open) $('dlg').close(); logYaz('YEDEK', `Yedek dosyası seçildi: ${Klasor.ad}`); degisti(); bildir(`Yedek dosyası seçildi: ${Klasor.ad}. Her değişiklik artık anında bu dosyaya yazılacak.`); }
    catch (e) { if (e.name !== 'AbortError') bildir('Dosya seçilemedi: ' + (e.message || e), 'er'); }
    bannerGuncelle(); durumGuncelle(); render();
  },
  'klasor-izin': async () => { await Klasor.izinVer(); if (Klasor.durum === 'tamam') { await Kayit.flush('zorla'); bildir('İzin verildi, yedek yazıldı.'); } else bildir('Konum hâlâ erişilemiyor: ' + (Klasor.hata || Klasor.durum), 'er'); bannerGuncelle(); durumGuncelle(); render(); },
  'yedek-simdi': async () => {
    Kayit.bekleyen = true; await Kayit.flush('zorla');
    bildir(Kayit.hata ? Kayit.hata : (Klasor.durum === 'tamam' ? 'Yedek konuma ve tarayıcıya yazıldı.' : '⚠️ Yalnızca tarayıcı kaydı alındı; yedek konumu yok. Yedeği indirin.'), Kayit.hata || Klasor.durum !== 'tamam' ? 'er' : 'ok'); render();
  },
  'yedek-indir': () => { if (!izin('ayar')) return bildir('Bu işlem için yetkiniz yok.', 'er'); dosyaIndir(`stok_portal_yedek_${zamanDamga()}.json`, JSON.stringify(db)); Kayit.indirildi(); bildir('Yedek dosyası indirildi.'); bannerGuncelle(); durumGuncelle(); if (ui.sayfa === 'ayar') render(); },
  'gate-atla': () => { try { sessionStorage.setItem('sos_gate', '1'); } catch (e) { /* yoksay */ } $('dlg').close(); bildir('⚠️ Yedek konumu seçilmedi: veriler yalnızca bu tarayıcıda tutuluyor. Üstteki uyarıdan istediğiniz zaman seçebilirsiniz.', 'er'); },
  'surum-tamam': () => { $('dlg').close(); yedekKapisi(); },
  'guncelleme-kaydet': () => {
    if (!izin('ayar')) return bildir('Bu işlem için yetkiniz yok.', 'er');
    const repo = val('ay-repo').trim(); if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) return bildir('Depo "kullanıcı/depo" biçiminde olmalı.', 'er');
    db.ayar.guncelleme = { repo, dal: val('ay-dal').trim() || 'main' }; logYaz('AYAR', `Güncelleme kaynağı: ${repo || '(yok)'}`); degisti(); bildir('Güncelleme kaynağı kaydedildi.'); render();
  },
  'guncelleme-kontrol': async () => {
    bildir('Sürüm denetleniyor…'); const r = await guncellemeKontrol();
    bildir(r.ok ? (r.yeni ? `Yeni sürüm var: ${r.yeni.surum}` : 'Güncel sürümü kullanıyorsunuz.') : r.msg, r.ok ? 'ok' : 'er'); bannerGuncelle(); if (ui.sayfa === 'ayar') render();
  },
  'surum-yeni': () => {
    const y = SurumDenetim.yeni; if (!y) return;
    const g = { repo: (db.ayar.guncelleme || {}).repo || VARSAYILAN_REPO }, repoUrl = g.repo ? `https://github.com/${g.repo}` : '';
    modalGeri = null;
    modal(`🆕 Yeni sürüm ${esc(y.surum)}`, `<p>Sizde: <b>${SURUM}</b> → Yeni: <b>${esc(y.surum)}</b>${y.tarih ? ' (' + esc(y.tarih) + ')' : ''}</p>${(y.notlar && y.notlar.length) ? `<h4>Neler yeni?</h4><ul class="yardim">${y.notlar.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<h4>Güncelleme adımları</h4><ol class="adim"><li><b>Önce yedek alın</b> (Ayarlar → Yedekleme → "Yedeği indir" veya "Şimdi yedekle").</li><li>Yeni <code>index.html</code> dosyasını edinin${repoUrl ? ` (<a href="${esc(repoUrl)}" target="_blank" rel="noopener">${esc(g.repo)}</a> deposunda <i>index.html → Raw → Farklı kaydet</i>)` : ''} ve eskisinin <b>üzerine yazın</b> (aynı yerden/aynı adresten açın).</li><li>Açınca verileriniz korunur; "Uygulama güncellendi" bildirimi ve neler yeni listesi çıkar.</li></ol>
${(y.kaynak === 'site' || webAdresi()) ? '<p class="mut kucuk">Bu uygulama bir web adresinden açılıyor (yüklü uygulama da sayılır): aşağıdaki düğme yedek alıp sayfayı yeniler (yenilenmezse Ctrl+F5).</p>' : ''}`,
      `<button class="btn" data-act="modal-kapat">Kapat</button>${(y.kaynak === 'site' || webAdresi()) ? '<button class="btn pri" data-act="surum-yenile">Yedek al ve güncelle (sayfayı yenile)</button>' : '<button class="btn pri" data-act="surum-guncelle">⬇ Yeni sürümü indir ve güncelle</button>'}`);
  },
  'surum-guncelle': async () => {
    if (!izin('ayar')) return bildir('Bu işlem için yetkiniz yok.', 'er');
    bildir('Önce yedek alınıyor, yeni sürüm indiriliyor…'); Kayit.bekleyen = true; try { await Kayit.flush('zorla'); } catch (e) { /* yedek hatası uyarı olarak zaten görünür */ }
    const r = await yeniSurumDosyasiAl(); if (!r.ok) return bildir(r.msg, 'er');
    let yazildi = false;
    if (typeof window.showSaveFilePicker === 'function') {
      try { const h = await window.showSaveFilePicker({ suggestedName: 'index.html', types: [{ description: 'Stok Portal', accept: { 'text/html': ['.html'] } }] }); const w = await h.createWritable(); await w.write(r.metin); await w.close(); yazildi = true; } catch (e) { if (e && e.name === 'AbortError') return bildir('Güncelleme iptal edildi.', 'er'); }
    }
    if (!yazildi) dosyaIndir('index.html', r.metin, 'text/html');
    logYaz('SURUM', `Yeni sürüm dosyası alındı: ${r.surum}`); degisti();
    modalGeri = null;
    modal('✅ Yeni sürüm hazır', yazildi
      ? `<p><b>${esc(r.surum)}</b> sürümü seçtiğiniz dosyaya yazıldı. Şimdi <b>bu sekmeyi kapatıp</b> o dosyayı yeniden açın; verileriniz korunur ve "neler yeni" bildirimi çıkar.</p><p class="mut kucuk">Eski dosyanın üzerine yazdıysanız ve aynı yerden açarsanız veri aynı kalır.</p>`
      : `<p><b>${esc(r.surum)}</b> sürümü <code>index.html</code> adıyla indirildi (İndirilenler klasörü). Şimdi:</p><ol class="adim"><li>Bu sekmeyi kapatın.</li><li>İndirilen <code>index.html</code>'i eski dosyanın <b>üzerine kopyalayın</b> (aynı klasörde, "Değiştir" deyin).</li><li>Eski dosyayı açtığınız yerden yeniden açın.</li></ol>`,
      '<button class="btn pri" data-act="modal-kapat">Tamam</button>');
  },
  'surum-yenile': async () => { Kayit.bekleyen = true; await Kayit.flush('zorla'); location.reload(); },
});

function setPath(p, v) { const [a, b] = p.split('.'); if (b === undefined) ui.f[a] = v; else ui.f[a][b] = v; }
function render() {
  if (db._yeni) { kilitGoster('yeniSurum'); return; }
  if (authAktif()) { if (!oturum || !oturumTazele()) { kilitGoster('giris'); return; } kilitGizle(); }
  else { oturum = null; kilitGizle(); }
  const izinli = SAYFALAR.filter(([k]) => sayfaIzni(k));
  let p = SAYFA[ui.sayfa] && sayfaIzni(ui.sayfa) ? ui.sayfa : (izinli[0] ? izinli[0][0] : 'panel'); ui.sayfa = p;
  $('nav').innerHTML = izinli.map(([k, i, t]) => `<a href="#${k}" class="${k === p ? 'on' : ''}">${i} <span>${t}</span></a>`).join('');
  $('app').innerHTML = (p === 'panel' && !izin('mali') && db.kartlar.length) ? panelBasit() : SAYFA[p]();
  maskele();
  $('firma').textContent = db.firma;
  document.title = db.firma + ' — Stok';
  document.querySelectorAll('[data-filtre]').forEach(e => filtreUygula(e.dataset.filtre));
  ({ alis: liveAlis, satis: liveSatis, zayiat: liveZayiat, uretim: liveUretim, sayim: liveSayim })[p]?.();
  if (p === 'ayar' && ui.tab.ay === 'yedek') yedekListesiDoldur();
  durumGuncelle(); bannerGuncelle();
}
/** 20 sn'de bir: oturum kilidi, yedek konumu yeniden bağlanma/kayıp tespiti, yedeksiz çalışma hatırlatması. */
async function periyodikKontrol() {
  if (db._yeni) return;
  if (authAktif() && oturum && Date.now() - ui.sonEtkinlik > (+db.ayar.kilitDk || 15) * 60e3) { cikisYap('kilit'); render(); return; }
  if (Klasor.h) {
    const once = Klasor.durum; await Klasor.kontrol();
    if (once !== 'tamam' && Klasor.durum === 'tamam') { await Kayit.flush('zorla'); bildir('📁 Yedek konumuna yeniden bağlanıldı; güncel yedek yazıldı.'); }
    else if (once === 'tamam' && Klasor.durum !== 'tamam') bildir('⚠️ Yedek konumu artık erişilemiyor! Veriler tarayıcıda tutuluyor ama yedek alınmıyor — yedeği indirin.', 'er');
    if (once !== Klasor.durum) { bannerGuncelle(); durumGuncelle(); }
  }
  if (Kayit.yedeksizKapanis() && Date.now() - (ui.sonHatirlatma || 0) > 10 * 60e3) { ui.sonHatirlatma = Date.now(); bildir('⚠️ Verileriniz yalnızca bu tarayıcıda; yedek konumuna yazılmıyor. Ayarlar → Yedekleme veya "Yedeği indir" ile yedek alın.', 'er'); }
}
function olaylariBagla() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const f = ACT[el.dataset.act]; if (f) { e.preventDefault(); try { const r = f(el, e); if (r && r.catch) r.catch(x => bildir(String(x.message || x), 'er')); } catch (x) { bildir(String(x.message || x), 'er'); console.error(x); } }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'md-izahat') { const m = $('md-say'), n = t.value.trim().length; if (m) m.textContent = n >= IZAHAT_MIN ? `${n} karakter ✓` : `${n}/${IZAHAT_MIN} karakter`; return; }
    if (t.dataset && t.dataset.filtre) return filtreUygula(t.dataset.filtre);
    const c = t.closest && t.closest('[data-live]');
    if (c) ({ alis: liveAlis, satis: liveSatis, zayiat: liveZayiat, uretim: liveUretim, sayim: liveSayim })[c.dataset.live]?.();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.set) { const v = t.type === 'checkbox' ? t.checked : t.value; setPath(t.dataset.set, v); render(); return; }
    if (t.closest && t.closest('#ur-g,#ur-c,#ur-y')) liveUretim();
    if (t.id === 'aktar-dosya' && t.files && t.files[0]) { const f = t.files[0]; t.value = ''; aktarAc(f); return; }
    if (t.closest && t.closest('#aktar-form')) { aktarFormOku(); aktarOnizlemeYaz(); return; }
    if (t.id === 'dosya' && t.files && t.files[0]) { const f = t.files[0]; const rd = new FileReader(); rd.onload = () => yedekOnay(rd.result, f.name); rd.readAsText(f); t.value = ''; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('#kilit')) { const b = $('kilit').querySelector('.pri'); if (b) b.click(); } });
  ['click', 'keydown', 'input'].forEach(t => document.addEventListener(t, () => { ui.sonEtkinlik = Date.now(); }, true));
  window.addEventListener('hashchange', () => { ui.sayfa = (location.hash || '#panel').slice(1); render(); window.scrollTo(0, 0); });
  window.addEventListener('beforeunload', e => { Kayit.senkron(); if (Kayit.yedeksizKapanis()) { e.preventDefault(); e.returnValue = ''; return ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { Kayit.senkron(); Kayit.flush('kapanis'); } });
  setInterval(periyodikKontrol, 20000);
}
/** Başlangıçta beklenmedik hata olursa sonsuz "Yükleniyor" yerine nedeni gösterir. */
// ---------- Excel/CSV içe aktarma arayüzü ----------
async function aktarAc(f) {
  try {
    bildir('Dosya okunuyor…');
    const rows = await aktDosyaOku(f); if (!rows.some(r => r.length)) return bildir('Dosyada veri bulunamadı.', 'er');
    const t = sutunTani(rows);
    ui.aktar = { ad: f.name, rows, baslik: t.baslik, esleme: t.esleme, tahmin: t.tahmin, sutunlar: t.sutunlar, gen: t.gen, varsGrup: 'TICARI', acilis: true, tarih: bugun() };
    aktarModal();
  } catch (e) { bildir('Dosya okunamadı: ' + (e.message || e), 'er'); }
}
const aktarSatirlar = () => { const a = ui.aktar; return aktSatirlariCoz(a.rows, a.baslik, a.esleme, a.varsGrup); };
function aktarFormOku() {
  const a = ui.aktar; if (!a || !$('aktar-form')) return;
  for (const k of AKT_SIRA) { const e = $('ak-' + k); if (e) { const v = +e.value; if (v >= 0) a.esleme[k] = v; else delete a.esleme[k]; } }
  if ($('ak-baslik')) { const b = +$('ak-baslik').value; if (b !== a.baslik) { a.baslik = b; a.sutunlar = Array.from({ length: a.gen }, (_, c) => b >= 0 ? String(a.rows[b][c] ?? '').trim() : ''); } }
  if ($('ak-vg')) a.varsGrup = $('ak-vg').value;
  if ($('ak-acilis')) a.acilis = $('ak-acilis').checked;
  if ($('ak-tarih') && $('ak-tarih').value) a.tarih = $('ak-tarih').value;
}
function aktarModal() {
  const a = ui.aktar, secenek = (sec) => `<option value="-1"${sec == null ? ' selected' : ''}>(yok)</option>` + Array.from({ length: a.gen }, (_, c) => `<option value="${c}"${sec === c ? ' selected' : ''}>${esc(aktSutunAd(c, a.sutunlar[c]))}</option>`).join('');
  const bs = '<option value="-1">(başlık satırı yok)</option>' + a.rows.slice(0, 25).map((r, i) => `<option value="${i}"${a.baslik === i ? ' selected' : ''}>${i + 1}. satır: ${esc(r.filter(c => c !== '' && c != null).slice(0, 4).join(' · ')).slice(0, 60)}</option>`).join('');
  const govde = `<div id="aktar-form"><p><b>${esc(a.ad)}</b> — ${a.rows.length} satır okundu.${a.tahmin ? ' <span class="mut">Başlık bulunamadı, sütunlar içeriğe göre tahmin edildi; lütfen kontrol edin.</span>' : ''}</p>
<div class="satir"><label>Başlık satırı<select id="ak-baslik">${bs}</select></label><label>Grubu tanınmayan satırlar<select id="ak-vg"><option value="TICARI"${a.varsGrup === 'TICARI' ? ' selected' : ''}>Ticari</option><option value="HAM"${a.varsGrup === 'HAM' ? ' selected' : ''}>Ham madde</option><option value="MAMUL"${a.varsGrup === 'MAMUL' ? ' selected' : ''}>Mamül</option></select></label></div>
<h4>Sütun eşleme <span class="mut kucuk">(otomatik tanındı, gerekirse değiştirin)</span></h4>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px">${AKT_SIRA.map(k => `<label>${AKT_ALANLAR[k].ad}${AKT_ALANLAR[k].zorunlu ? ' *' : ''}<select id="ak-${k}">${secenek(a.esleme[k])}</select></label>`).join('')}</div>
<div class="satir"><label class="gen"><input type="checkbox" id="ak-acilis"${a.acilis ? ' checked' : ''}> Miktarı olanlara açılış stoğu gir (alış hareketi olarak)</label><label>Açılış tarihi<input type="date" id="ak-tarih" value="${esc(a.tarih)}"></label></div>
<div id="aktar-onizleme"></div></div>`;
  modalGeri = null; modal('📥 Excel / CSV\'den içe aktar', govde, '<button class="btn" data-act="modal-kapat">Vazgeç</button><button class="btn pri" data-act="aktar-uygula">İçe aktar</button>');
  aktarOnizlemeYaz();
}
function aktarOnizlemeYaz() {
  const el = $('aktar-onizleme'); if (!el || !ui.aktar) return; const a = ui.aktar;
  if (a.esleme.ad == null) { el.innerHTML = '<div class="ban er"><span>Ürün adı sütunu seçilmedi.</span></div>'; return; }
  const s = aktarSatirlar(), say = d => s.filter(x => x.durum === d).length;
  const chip_ = x => x.durum === 'yeni' ? chip('yeni', 'ok') : x.durum === 'hata' ? chip('hata', 'er') : chip(x.durum === 'var' ? 'var' : 'tekrar', 'mut');
  el.innerHTML = `<div class="satir"><b>${say('yeni')}</b> yeni kart · ${say('var') + say('tekrar')} atlanacak · <span ${say('hata') ? 'class="mut" style="color:var(--er)"' : ''}>${say('hata')} hatalı</span>${a.acilis ? ` · ${s.filter(x => x.durum === 'yeni' && x.miktar > 0).length} kaleme açılış stoğu` : ''}</div>
${tablo([{ b: 'Sat.', f: x => x.n }, { b: 'Durum', f: x => chip_(x) }, { b: 'Ürün', f: x => esc(x.ad) }, { b: 'Kategori', f: x => esc(x.kat || '') }, { b: 'Grup', f: x => x.grup ? GRUP_KISA[x.grup] : '' }, { b: 'Birim', f: x => esc(x.birim || '') },
    { b: 'Asgari', c: 'sag', f: x => isFinite(x.asgari) ? mikF(x.asgari) : '' }, { b: 'Miktar', c: 'sag', f: x => isFinite(x.miktar) ? mikF(x.miktar) : '' }, { b: 'Maliyet', c: 'sag', f: x => isFinite(x.fiyat) ? tl(x.fiyat) : '' }, { b: 'Not', f: x => esc(x.msg || '') }], s.slice(0, 15))}
${s.length > 15 ? `<p class="mut kucuk">İlk 15 satır gösteriliyor; toplam ${s.length} satır işlenecek.</p>` : ''}`;
}
const webAdresi = () => typeof location !== 'undefined' && /^https?:/.test(location.protocol);
function baslatHatasi(e) {
  const el = typeof document !== 'undefined' && document.getElementById('app'); if (!el) return;
  el.innerHTML = '<div class="card" style="max-width:640px;margin:30px auto"><h3>⚠️ Uygulama başlatılamadı</h3><p>Verileriniz silinmedi. Sayfayı <b>Ctrl+F5</b> ile yenileyin; sürerse aşağıdaki hata satırını geliştiriciye iletin.</p><pre style="white-space:pre-wrap;background:#f4f4f6;padding:10px;border-radius:6px">' + esc(String((e && (e.stack || e.message)) || e)).slice(0, 800) + '</pre><p class="mut kucuk">Sürüm ' + esc(typeof SURUM !== 'undefined' ? SURUM : '?') + '</p></div>';
}
async function baslat() {
  // Web uygulaması olarak yüklenebilirlik + çevrimdışı açılış (yalnızca http/https'te; dosyadan açılışta yoktur)
  try { if (typeof navigator !== 'undefined' && navigator.serviceWorker && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* yoksay */ }
  olaylariBagla();
  await yukle();
  ui.sonEtkinlik = Date.now();
  if (db._yeni) { render(); return; }
  if (db.app && surumKarsilastir(SURUM, db.app) > 0) {
    ui.surumNotu = { eski: db.app, yeni: SURUM };
    await Kayit.oncesi(`Sürüm güncellemesi öncesi (${db.app} → ${SURUM})`);
    const e = db.app; db.app = SURUM; logYaz('SURUM', `Uygulama güncellendi: ${e} → ${SURUM}`); degisti();
  } else if (db.app && surumKarsilastir(SURUM, db.app) < 0) ui.eskiDosya = db.app;
  else if (!db.app) db.app = SURUM;
  ui.sayfa = (location.hash || '#panel').slice(1);
  if (authAktif()) {
    if (!oturumGeriYukle()) { kilitGoster('giris'); }
    else { const u = db.kullanicilar.find(x => x.id === oturum.id); if (u && u.zorla) kilitGoster('zorla'); else girisSonrasi(); }
  } else girisSonrasi();
  try { if (!sessionStorage.getItem('sos_sk')) { sessionStorage.setItem('sos_sk', '1'); guncellemeKontrol().then(() => { bannerGuncelle(); }); } } catch (e) { /* yoksay */ }
}

// ============================ ARAYÜZ BİTİŞ ============================
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('app')) baslat().catch(baslatHatasi);
globalThis.SOS = { SAYFA, ui, ACT, periyodikKontrol, yedekMesaj, maskele, render, get db() { return db; }, set db(v) { db = v; } };
