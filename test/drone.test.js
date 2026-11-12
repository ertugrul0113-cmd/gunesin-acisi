// Çalıştır: node test/drone.test.js
const assert = require('assert');
const D = require('../drone.js');
let n = 0; const ok = (k, m) => { assert.ok(k, m); n++; };
const sakin = { ruzgar10: 2, ruzgar80: 3, ruzgar120: 3.5, ani10: 4, yagis: 0, yagisOlas: 5, gorus: 20000, sicaklik: 18, kod: 1, kp: 2 };

ok(D.karar(sakin).seviye === 0 && D.karar(sakin).nedenler.length === 0, 'sakin hava: uç');
// Yükseklikte rüzgâr: yerde 5, 120 m'de 11 -> 120 m'de uçma, 20 m'de değil
const yuksekteSert = Object.assign({}, sakin, { ruzgar10: 5, ruzgar80: 9, ruzgar120: 11, ani10: 6 });
ok(D.karar(yuksekteSert, { yukseklik: 120 }).seviye === 2, '120 m sert rüzgâr: uçma');
ok(D.karar(yuksekteSert, { yukseklik: 20 }).seviye === 0, '20 m: uç');
ok(D.karar(Object.assign({}, sakin, { ruzgar10: 8, ruzgar80: 8, ruzgar120: 8 }), { yukseklik: 50 }).seviye === 1, '8 m/s: dikkat');
ok(D.karar(Object.assign({}, sakin, { ani10: 11 })).seviye === 2, 'ani rüzgâr: uçma');
ok(D.karar(Object.assign({}, sakin, { yagis: 1.2 })).seviye === 2, 'yağmur: uçma');
ok(D.karar(Object.assign({}, sakin, { yagisOlas: 60 })).seviye === 1, 'yağış olasılığı: dikkat');
ok(D.karar(Object.assign({}, sakin, { gorus: 600 })).seviye === 2, 'sis: uçma');
ok(D.karar(Object.assign({}, sakin, { sicaklik: 2 })).seviye === 1, 'soğuk: dikkat');
ok(D.karar(Object.assign({}, sakin, { kod: 95 })).seviye === 2, 'fırtına: uçma');
ok(D.karar(Object.assign({}, sakin, { kp: 5.3 })).seviye === 1, 'Kp 5: dikkat');
ok(D.karar(Object.assign({}, sakin, { ruzgar10: 8, ruzgar80: 8, ruzgar120: 8 }), { ruzgarSinir: 15 }).seviye === 0, 'özel sınır');
// Ara değer
ok(Math.abs(D.yukseklikRuzgar(5, 9, 11, 10) - 5) < 1e-9 && Math.abs(D.yukseklikRuzgar(5, 9, 11, 120) - 11) < 1e-9, 'uç değerler');
const r40 = D.yukseklikRuzgar(5, 9, 11, 40); ok(r40 > 5 && r40 < 9, 'ara değer 40 m');
// Coğrafya: İstanbul Havalimanı ~ Sabiha Gökçen arası ~ 59 km
ok(Math.abs(D.mesafeKm(41.2749, 28.7321, 40.8986, 29.3092) - 63) < 3, 'mesafe');
ok(Math.abs(D.yonAci(41, 29, 42, 29) - 0) < 0.01 && Math.abs(D.yonAci(41, 29, 41, 30) - 90) < 1, 'yön');
const yakin = D.enYakinHavalimanlari(41.0, 28.98, [['A', 41.27, 28.73, 'b', 'IST'], ['B', 40.9, 29.31, 'b', 'SAW'], ['C', 39.9, 32.9, 'b', 'ESB']], 2);
ok(yakin.length === 2 && yakin[0].kod === 'SAW', 'en yakın');
ok(D.isikTipi(250, 245, 10).ad.startsWith('Ters'), 'ters ışık');
ok(D.isikTipi(70, 245, 10).ad.startsWith('Ön'), 'ön ışık');
ok(D.isikTipi(160, 245, 10).ad.startsWith('Yan'), 'yan ışık');
ok(Math.abs(D.kameraEgimi(100, 100) - 45) < 1e-9, 'kamera eğimi');
console.log(`drone: ${n} kontrol geçti`);
