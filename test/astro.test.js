// Çalıştır: node test/astro.test.js
// Referans değerler astronomy-engine 2.1.19 (yüksek hassasiyetli) ile üretildi.
const assert = require('assert');
let A;
const durumlar = [
  { tz: 'Europe/Istanbul', enl: 41.0082, boy: 28.9784, gun: '2026-11-12T00:00:00+03:00',
    gunesDogus: '2026-11-12T04:47:46.938Z', gunesBatis: '2026-11-12T14:48:12.589Z',
    ayDogus: '2026-11-12T07:59:36.736Z', ayBatis: '2026-11-12T16:39:21.587Z' },
  { tz: 'Europe/Istanbul', enl: 41.0082, boy: 28.9784, gun: '2026-06-21T00:00:00+03:00',
    gunesDogus: '2026-06-21T02:32:03.168Z', gunesBatis: '2026-06-21T17:39:42.858Z',
    ayDogus: '2026-06-21T09:38:48.164Z', ayBatis: '2026-06-20T21:31:21.433Z' },
  { tz: 'Australia/Sydney', enl: -33.87, boy: 151.21, gun: '2026-03-20T00:00:00+11:00',
    gunesDogus: '2026-03-19T19:57:57.282Z', gunesBatis: '2026-03-20T08:06:56.751Z',
    ayDogus: '2026-03-19T20:55:41.225Z', ayBatis: '2026-03-20T08:33:47.176Z' }
];
let gecti = 0;
const yakin = (bizim, ref, dk, ad) => {
  const fark = Math.abs(bizim - new Date(ref)) / 60000;
  assert.ok(fark <= dk, `${ad}: ${fark.toFixed(2)} dk fark (sınır ${dk})`); gecti++;
};
for (const d of durumlar) {
  process.env.TZ = d.tz;
  delete require.cache[require.resolve('../astro.js')];
  A = require('../astro.js');
  const gun = new Date(d.gun);
  assert.strictEqual(A.gunBasi(gun), +gun, 'gün başı ' + d.gun);
  const s = A.gunesGunu(gun, d.enl, d.boy), m = A.ayGunu(gun, d.enl, d.boy);
  yakin(s.dogus, d.gunesDogus, 1, d.gun + ' güneş doğuş');
  yakin(s.batis, d.gunesBatis, 1, d.gun + ' güneş batış');
  yakin(m.dogus, d.ayDogus, 5, d.gun + ' ay doğuş');
  yakin(m.batis, d.ayBatis, 5, d.gun + ' ay batış');
  // Olay sırası mantıklı mı
  const sira = [s.astroSafak, s.denizciSafak, s.maviSabahBas, s.altinSabahBas, s.dogus, s.altinSabahSon, s.tepe, s.altinAksamBas, s.batis, s.altinAksamSon, s.maviAksamSon, s.denizciAksam, s.astroAksam];
  for (let i = 1; i < sira.length; i++) assert.ok(sira[i] > sira[i - 1], d.gun + ' olay sırası ' + i);
  gecti++;
}
process.env.TZ = 'Europe/Oslo';
delete require.cache[require.resolve('../astro.js')];
A = require('../astro.js');
assert.strictEqual(A.gunesGunu(new Date('2026-12-21T12:00:00+01:00'), 69.65, 18.96).durum, 'dogmuyor'); gecti++;
assert.strictEqual(A.gunesGunu(new Date('2026-06-21T12:00:00+02:00'), 69.65, 18.96).durum, 'batmiyor'); gecti++;
// Ay evresi: 12 Kasım 2026 ≈ %6 büyüyen hilal; dolunay 24 Kasım ~14:54 UTC
const e = A.ayEvre(new Date('2026-11-11T21:00:00Z'));
assert.ok(e.buyuyen && Math.abs(e.aydinlik - 0.06) < 0.02, 'ay evresi'); gecti++;
yakin(A.sonrakiEvre(new Date('2026-11-11T21:00:00Z'), 180), '2026-11-24T14:54:04Z', 30, 'dolunay');
// Galaktik merkez: 41° K'de en fazla ≈ 90 - 41 - 28,9 = 20,1° yükselir
process.env.TZ = 'Europe/Istanbul';
delete require.cache[require.resolve('../astro.js')];
A = require('../astro.js');
const gcYol = A.gunlukYol(A.galaktikKonum, new Date('2026-07-15T12:00:00+03:00'), 41.0082, 28.9784, 5);
const gcMax = Math.max(...gcYol.map(p => p.alt));
assert.ok(gcMax > 19.5 && gcMax < 21, 'galaktik merkez en yüksek ' + gcMax); gecti++;
// Temmuz yeni ayına yakın gece (14 Tem 2026): İstanbul'da Samanyolu iyi görünmeli; Kasım'da neredeyse hiç
const yaz = A.geceAnalizi(new Date('2026-07-14T12:00:00+03:00'), 41.0082, 28.9784);
const kis = A.geceAnalizi(new Date('2026-11-12T12:00:00+03:00'), 41.0082, 28.9784);
assert.ok(yaz.gmDk > 120 && yaz.puan >= 2, 'yaz gecesi Samanyolu ' + JSON.stringify({ dk: yaz.gmDk, aysiz: yaz.aysizGmDk, p: yaz.puan })); gecti++;
assert.ok(kis.gmDk < 60, 'kasım gecesi Samanyolu ' + kis.gmDk); gecti++;
assert.ok(yaz.karanlikBas && yaz.karanlikSon > yaz.karanlikBas, 'karanlık aralığı'); gecti++;
// Tromsø'da yazın astronomik karanlık yok
assert.strictEqual(A.geceAnalizi(new Date('2026-06-21T12:00:00+02:00'), 69.65, 18.96).karanlikBas, null); gecti++;
assert.strictEqual(A.yonAdi(0), 'K'); assert.strictEqual(A.yonAdi(247), 'BGB'); gecti++;
console.log(`astro: ${gecti} kontrol geçti`);
