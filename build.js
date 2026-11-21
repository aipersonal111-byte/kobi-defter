// src/ altındaki parçaları tek dosyalık index.html'e birleştirir.
//   node build.js          -> index.html üretir
//   node build.js --check  -> index.html'in güncel olup olmadığını denetler (CI için)
const fs = require('fs'), path = require('path');
const parcalar = ['head.html', 'surum.js', 'motor.js', 'kimlik.js', 'depo.js', 'aktar.js', 'ui.js', 'tail.html'];
const cikti = parcalar.map(p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8')).join('');
const betik = cikti.match(/<script>([\s\S]*)<\/script>/);
try { new Function(betik[1]); } catch (e) { console.error('JavaScript sözdizimi hatası:', e.message); process.exit(1); }
// version.json: uygulamanın "yeni sürüm var mı?" denetimi bunu okur (depoya commit edilir)
const vm = require('vm'), bag = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'src', 'surum.js'), 'utf8') + '\nglobalThis.R = { SURUM, DB_SEMA, DEGISIKLIKLER };', bag);
const R = bag.R;
const surumJson = JSON.stringify({ surum: R.SURUM, tarih: R.DEGISIKLIKLER[0].t, dbSema: R.DB_SEMA, notlar: R.DEGISIKLIKLER[0].n, indir: 'index.html' }, null, 2) + '\n';
const hedef = path.join(__dirname, 'index.html'), hedefJson = path.join(__dirname, 'version.json');
const oku = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
if (process.argv.includes('--check')) {
  if (oku(hedef) !== cikti || oku(hedefJson) !== surumJson) { console.error('index.html / version.json güncel değil: "node build.js" çalıştırıp ikisini de commit edin.'); process.exit(1); }
  const pj = JSON.parse(oku(path.join(__dirname, 'package.json')));
  if (pj.version !== R.SURUM) { console.error(`package.json sürümü (${pj.version}) src/surum.js sürümüyle (${R.SURUM}) aynı olmalı.`); process.exit(1); }
  console.log('index.html ve version.json güncel (sürüm ' + R.SURUM + ').');
} else {
  fs.writeFileSync(hedef, cikti); fs.writeFileSync(hedefJson, surumJson);
  // package.json sürümü src/surum.js ile otomatik eşitlenir (elle değiştirmeye gerek yok)
  const pjYol = path.join(__dirname, 'package.json'), pjMetin = oku(pjYol), pjYeni = pjMetin.replace(/("version"\s*:\s*")[^"]*(")/, `$1${R.SURUM}$2`);
  if (pjYeni !== pjMetin) { fs.writeFileSync(pjYol, pjYeni); console.log('package.json sürümü ' + R.SURUM + ' olarak eşitlendi'); }
  console.log('index.html üretildi (' + cikti.length + ' karakter), version.json sürüm ' + R.SURUM);
}
