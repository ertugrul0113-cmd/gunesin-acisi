// Güneşin Açısı — kamera ekranı (AR): kamera görüntüsü üstüne güneş/ay yolu.
// Yön: DeviceOrientation (W3C ZXY dönüş matrisi). iPhone'da webkitCompassHeading ile kuzeye bağlanır.
(function () {
  'use strict';
  const RAD = Math.PI / 180;
  let video, tuval, ctx, akis = null, acik = false, cizimIstek = 0;
  let yon = null;            // { a, b, g } son sensör okuması (derece)
  let pusulaFark = null;     // matris azimutu + fark = gerçek azimut (iPhone pusulası)
  let mutlak = false;        // Android: deviceorientationabsolute
  let ayar, veriAl, kaydet;  // app.js'ten

  // Cihaz -> dünya (Doğu, Kuzey, Yukarı) dönüş matrisi
  function matris(a, b, g) {
    const cA = Math.cos(a * RAD), sA = Math.sin(a * RAD), cB = Math.cos(b * RAD), sB = Math.sin(b * RAD), cG = Math.cos(g * RAD), sG = Math.sin(g * RAD);
    return [
      [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB],
      [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
      [-cB * sG, sB, cB * cG]
    ];
  }
  const norm360 = x => ((x % 360) + 360) % 360;
  const aciFark = (x, y) => { let d = norm360(x - y); return d > 180 ? d - 360 : d; };

  function toplamFark() { return (pusulaFark || 0) + (ayar().duzeltme || 0); }

  // Kameranın baktığı yön (gerçek azimut) ve yükseklik
  function bakis() {
    if (!yon) return null;
    const R = matris(yon.a, yon.b, yon.g);
    const e = [-R[0][2], -R[1][2], -R[2][2]];
    return { az: norm360(Math.atan2(e[0], e[1]) / RAD + toplamFark()), alt: Math.asin(Math.max(-1, Math.min(1, e[2]))) / RAD };
  }

  // Gökyüzü noktası (gerçek az, alt) -> ekran (x, y) ya da null
  function izdusum(az, alt, R, f, cx, cy) {
    const azm = (az - toplamFark()) * RAD, h = alt * RAD;
    const e = [Math.cos(h) * Math.sin(azm), Math.cos(h) * Math.cos(azm), Math.sin(h)];
    // cihaz koordinatı = Rᵀ · e
    const dx = R[0][0] * e[0] + R[1][0] * e[1] + R[2][0] * e[2];
    const dy = R[0][1] * e[0] + R[1][1] * e[1] + R[2][1] * e[2];
    const dz = R[0][2] * e[0] + R[1][2] * e[1] + R[2][2] * e[2];
    if (dz > -0.05) return null;                      // kameranın arkasında
    return { x: cx + dx / -dz * f, y: cy - dy / -dz * f };
  }

  function yolCiz(noktalar, renk, kalin, kesik, R, f, cx, cy, W, H, etiketle) {
    ctx.strokeStyle = renk; ctx.lineWidth = kalin; ctx.setLineDash(kesik ? [10, 8] : []);
    ctx.beginPath();
    let onceki = null;
    for (const n of noktalar) {
      const p = izdusum(n.az, n.alt, R, f, cx, cy);
      if (p && onceki && Math.hypot(p.x - onceki.x, p.y - onceki.y) < Math.max(W, H)) ctx.lineTo(p.x, p.y);
      else if (p) ctx.moveTo(p.x, p.y);
      onceki = p;
    }
    ctx.stroke(); ctx.setLineDash([]);
    if (etiketle) {
      ctx.fillStyle = renk; ctx.font = '600 12px -apple-system, sans-serif'; ctx.textAlign = 'center';
      for (const n of noktalar) {
        if (n.zaman.getMinutes() !== 0 || n.alt < -2) continue;
        const p = izdusum(n.az, n.alt, R, f, cx, cy);
        if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
        ctx.fillText(String(n.zaman.getHours()).padStart(2, '0'), p.x, p.y - 8);
      }
    }
  }

  function ciz() {
    cizimIstek = 0;
    if (!acik) return;
    const W = tuval.clientWidth, H = tuval.clientHeight, dpr = window.devicePixelRatio || 1;
    if (tuval.width !== Math.round(W * dpr)) { tuval.width = Math.round(W * dpr); tuval.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bilgi = document.getElementById('arBilgi');
    if (!yon) { bilgi.textContent = 'Sensör bekleniyor… Telefonu biraz hareket ettirin.'; return; }
    const R = matris(yon.a, yon.b, yon.g);
    const f = (H / 2) / Math.tan(ayar().gorus / 2 * RAD), cx = W / 2, cy = H / 2;
    const v = veriAl();

    // Ufuk ve ana yönler
    const ufuk = []; for (let az = 0; az <= 360; az += 2) ufuk.push({ az, alt: 0 });
    yolCiz(ufuk, 'rgba(255,255,255,.75)', 1.5, true, R, f, cx, cy, W, H);
    ctx.font = '700 16px -apple-system, sans-serif'; ctx.textAlign = 'center';
    for (let az = 0; az < 360; az += 45) {
      const p = izdusum(az, 0, R, f, cx, cy); if (!p) continue;
      ctx.fillStyle = az === 0 ? '#ff5a5a' : '#fff';
      ctx.fillText(['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'][az / 45], p.x, p.y + 22);
    }
    // Yollar
    if (v.gmYol) yolCiz(v.gmYol, 'rgba(192,140,255,.8)', 2, true, R, f, cx, cy, W, H);
    yolCiz(v.ayYol, '#9ccaff', 2.5, true, R, f, cx, cy, W, H, true);
    yolCiz(v.gunesYol, '#ffb627', 3, false, R, f, cx, cy, W, H, true);
    // Anlık konumlar
    const isaret = (k, renk, yazi, r) => {
      const p = izdusum(k.az, k.alt, R, f, cx, cy); if (!p) return;
      ctx.globalAlpha = k.alt > 0 ? 1 : .5;
      ctx.fillStyle = renk; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#000a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 13px -apple-system, sans-serif'; ctx.fillText(yazi, p.x, p.y - r - 6);
      ctx.globalAlpha = 1;
    };
    if (v.gm && v.gm.alt > 0) isaret(v.gm, '#c08cff', 'Samanyolu', 7);
    isaret(v.ay, '#dfe9ff', 'Ay', 10);
    isaret(v.gunes, '#ffb627', 'Güneş', 13);
    // Nişangâh
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14); ctx.stroke();
    const b = bakis();
    bilgi.textContent = `${v.saatYazi} · Bakış ${Math.round(b.az)}° ${v.yonAdi(b.az)} · eğim ${Math.round(b.alt)}°` + (pusulaFark == null && !mutlak ? ' · pusula yok' : '');
  }
  function cizIste() { if (!cizimIstek) cizimIstek = requestAnimationFrame(ciz); }

  function yonOlayi(e) {
    if (e.alpha == null) return;
    yon = { a: e.alpha, b: e.beta, g: e.gamma };
    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
      // iPhone: matris azimutu (-alpha) ile pusula yönü arasındaki fark, yumuşatılarak
      const yeni = norm360(e.webkitCompassHeading + e.alpha);
      pusulaFark = pusulaFark == null ? yeni : norm360(pusulaFark + aciFark(yeni, pusulaFark) * 0.1);
    }
    cizIste();
  }
  function mutlakOlay(e) { mutlak = true; yonOlayi(e); }

  async function ac() {
    const durumYaz = t => { document.getElementById('arBilgi').textContent = t; };
    acik = true;
    document.getElementById('arEkran').classList.remove('gizli');
    durumYaz('İzin isteniyor…');
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const s = await DeviceOrientationEvent.requestPermission();
        if (s !== 'granted') { durumYaz('Hareket ve yön izni verilmedi. Ayarlar > Safari > Hareket ve Yön Erişimi.'); }
      }
    } catch (e) { /* bazı tarayıcılarda gerekmez */ }
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', mutlakOlay);
    else window.addEventListener('deviceorientation', yonOlayi);
    try {
      akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = akis; await video.play();
    } catch (e) {
      durumYaz('Kamera açılamadı. Kamera iznini verin (Ayarlar > Safari > Kamera).');
    }
    cizIste();
  }

  function kapat() {
    acik = false;
    window.removeEventListener('deviceorientation', yonOlayi);
    window.removeEventListener('deviceorientationabsolute', mutlakOlay);
    if (akis) { akis.getTracks().forEach(t => t.stop()); akis = null; }
    video.srcObject = null;
    document.getElementById('arEkran').classList.add('gizli');
  }

  // Ortadaki nişangâhı güneşe (ya da aya) tutup basınca pusula düzeltmesi
  function hizala(hedefAz) {
    const b = bakis(); if (!b) return false;
    ayar().duzeltme = norm360((ayar().duzeltme || 0) + aciFark(hedefAz, b.az) + 180) - 180;
    kaydet(); cizIste(); return true;
  }

  function kur(ayarFn, veriFn, kaydetFn) {
    ayar = ayarFn; veriAl = veriFn; kaydet = kaydetFn;
    video = document.getElementById('arVideo');
    tuval = document.getElementById('arTuval');
    ctx = tuval.getContext('2d');
    window.addEventListener('resize', cizIste);
  }

  window.AR = { kur, ac, kapat, hizala, cizIste, acikMi: () => acik };
})();
