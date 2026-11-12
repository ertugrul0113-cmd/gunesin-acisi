// Çalıştır: node test/kamera.test.js
const assert = require('assert');
const K = require('../kamera.js');
let n = 0; const yakin = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} ≠ ${b}`); n++; };
const ff = K.sensor('ff'), apsc = K.sensor('apsc');
yakin(K.kirpma(ff), 1, 1e-9, 'FF kırpma');
yakin(K.kirpma(apsc), 1.53, 0.01, 'APS-C kırpma');
yakin(K.pikselAraligi(ff, 24), 5.9, 0.1, 'FF 24MP piksel');
yakin(K.kural500(20, ff), 25, 1e-9, '500 kuralı 20mm FF');
// NPF basit: 14 mm, f/2.8, FF 24MP -> (98 + 177) / 14 ≈ 19,6 sn
yakin(K.npf(14, 2.8, ff, 24), 19.6, 0.3, 'NPF');
// Hiperfokal: 24 mm f/8 FF (CoC 0,0288) ≈ 2,52 m
yakin(K.hiperfokal(24, 8, ff) / 1000, 2.52, 0.03, 'hiperfokal');
const ad = K.alanDerinligi(50, 2.8, 3, ff);   // 50mm f/2.8 3 m -> ~2,74 – 3,32 m (CoC 0,029)
yakin(ad.yakin, 2.74, 0.02, 'DoF yakın'); yakin(ad.uzak, 3.32, 0.02, 'DoF uzak');
assert.strictEqual(K.alanDerinligi(24, 8, 3, ff).uzak, Infinity); n++;
yakin(K.ndDurak(1000), 9.97, 0.01, 'ND1000');
yakin(K.ndSure(1 / 125, 10), 8.19, 0.01, 'ND süre');
const tl = K.timelapse(3600, 5, 25); assert.ok(tl.kare === 721 && Math.abs(tl.videoSn - 28.84) < 0.01, 'timelapse'); n++;
assert.strictEqual(K.sureYaz(1 / 250), '1/250'); assert.strictEqual(K.sureYaz(250), '4 dk 10 sn'); assert.strictEqual(K.sureYaz(19.6), '20 sn'); n++;
console.log(`kamera: ${n} kontrol geçti`);
