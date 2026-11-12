// Güneşin Açısı — astronomi hesapları (güneş, ay, galaktik merkez).
// Formüller: Astronomical Almanac düşük hassasiyet serileri (güneş ~0,01°, ay ~0,3°).
// Ekrana dokunmaz; tarayıcıda window.Astro, Node'da module.exports.
(function (kok) {
  'use strict';
  const RAD = Math.PI / 180, DER = 180 / Math.PI, GUN_MS = 86400000;

  const norm360 = x => ((x % 360) + 360) % 360;
  const sinD = x => Math.sin(x * RAD), cosD = x => Math.cos(x * RAD);
  const jd = t => t / GUN_MS + 2440587.5;           // t: ms (Date.valueOf)
  const nGun = t => jd(t) - 2451545.0;              // J2000'den gün

  // Ekliptik -> ekvatoral (derece)
  function ekvatoral(lam, bet, eps) {
    const ra = Math.atan2(sinD(lam) * cosD(eps) - Math.tan(bet * RAD) * sinD(eps), cosD(lam)) * DER;
    const dec = Math.asin(sinD(bet) * cosD(eps) + cosD(bet) * sinD(eps) * sinD(lam)) * DER;
    return { ra: norm360(ra), dec };
  }

  function gunesEkliptik(t) {
    const n = nGun(t);
    const L = norm360(280.460 + 0.9856474 * n);
    const g = norm360(357.528 + 0.9856003 * n);
    const lam = norm360(L + 1.915 * sinD(g) + 0.020 * sinD(2 * g));
    return { lam, eps: 23.439 - 0.0000004 * n };
  }

  function gunesEkv(t) {
    const { lam, eps } = gunesEkliptik(t);
    return Object.assign(ekvatoral(lam, 0, eps), { lam });
  }

  function ayEkv(t) {
    const T = nGun(t) / 36525;
    const lam = norm360(218.32 + 481267.881 * T
      + 6.29 * sinD(135.0 + 477198.87 * T)
      - 1.27 * sinD(259.3 - 413335.36 * T)
      + 0.66 * sinD(235.7 + 890534.22 * T)
      + 0.21 * sinD(269.9 + 954397.74 * T)
      - 0.19 * sinD(357.5 + 35999.05 * T)
      - 0.11 * sinD(186.5 + 966404.03 * T));
    const bet = 5.13 * sinD(93.3 + 483202.02 * T)
      + 0.28 * sinD(228.2 + 960400.89 * T)
      - 0.28 * sinD(318.3 + 6003.15 * T)
      - 0.17 * sinD(217.6 - 407332.21 * T);
    const par = 0.9508 + 0.0518 * cosD(135.0 + 477198.87 * T)
      + 0.0095 * cosD(259.3 - 413335.36 * T)
      + 0.0078 * cosD(235.7 + 890534.22 * T)
      + 0.0028 * cosD(269.9 + 954397.74 * T);
    const eps = 23.439 - 0.0000004 * nGun(t);
    return Object.assign(ekvatoral(lam, bet, eps), { lam, par, mesafeKm: 6378.14 / Math.sin(par * RAD) });
  }

  // Galaktik merkez (Samanyolu çekirdeği), J2000
  const GALAKTIK = { ra: 266.405, dec: -28.936 };

  // Ekvatoral -> yatay. Azimut kuzeyden saat yönünde (0=K, 90=D).
  function yatay(t, ra, dec, enl, boy) {
    const gmst = norm360(280.46061837 + 360.98564736629 * nGun(t));
    const H = norm360(gmst + boy - ra);
    const alt = Math.asin(sinD(enl) * sinD(dec) + cosD(enl) * cosD(dec) * cosD(H)) * DER;
    const az = norm360(Math.atan2(sinD(H), cosD(H) * sinD(enl) - Math.tan(dec * RAD) * cosD(enl)) * DER + 180);
    return { alt, az };
  }

  // Atmosferik kırılma (Bennett), derece
  function kirilma(h) {
    if (h < -1.9) return 0;
    return 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * RAD) / 60;
  }

  // ---- Konumlar (görünen: kırılma dahil) ----
  function gunesKonum(tarih, enl, boy) {
    const t = +tarih, e = gunesEkv(t), y = yatay(t, e.ra, e.dec, enl, boy);
    return { az: y.az, alt: y.alt + kirilma(y.alt), altGeo: y.alt };
  }

  function ayKonum(tarih, enl, boy) {
    const t = +tarih, m = ayEkv(t), y = yatay(t, m.ra, m.dec, enl, boy);
    const topo = y.alt - m.par * cosD(y.alt);        // paralaks düzeltmesi
    return { az: y.az, alt: topo + kirilma(topo), altGeo: y.alt, mesafeKm: m.mesafeKm };
  }

  function galaktikKonum(tarih, enl, boy) {
    const y = yatay(+tarih, GALAKTIK.ra, GALAKTIK.dec, enl, boy);
    return { az: y.az, alt: y.alt + kirilma(y.alt), altGeo: y.alt };
  }

  // ---- Ay evresi ----
  function ayEvre(tarih) {
    const t = +tarih, s = gunesEkv(t), m = ayEkv(t);
    const uzanim = norm360(m.lam - s.lam);            // 0 yeni ay, 180 dolunay
    const cosPsi = sinD(s.dec) * sinD(m.dec) + cosD(s.dec) * cosD(m.dec) * cosD(s.ra - m.ra);
    const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi))) * DER;
    const aydinlik = (1 - cosD(psi)) / 2;               // 0..1
    const buyuyen = uzanim < 180;
    let ad;
    if (aydinlik < 0.03) ad = 'Yeni ay';
    else if (aydinlik > 0.97) ad = 'Dolunay';
    else if (Math.abs(aydinlik - 0.5) < 0.04) ad = buyuyen ? 'İlk dördün' : 'Son dördün';
    else if (aydinlik < 0.5) ad = buyuyen ? 'Büyüyen hilal' : 'Küçülen hilal';
    else ad = buyuyen ? 'Büyüyen ay (şişkin)' : 'Küçülen ay (şişkin)';
    return { aydinlik, uzanim, buyuyen, ad };
  }

  // Bir sonraki yeni ay (hedef=0) / dolunay (hedef=180)
  function sonrakiEvre(tarih, hedef) {
    const fark = t => { let d = norm360(ayEkv(t).lam - gunesEkv(t).lam) - hedef; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
    let a = +tarih, fa = fark(a);
    const adim = 6 * 3600000;
    for (let i = 0; i < 4 * 32; i++) {
      const b = a + adim, fb = fark(b);
      if (fa < 0 && fb >= 0 && fb - fa < 90) return new Date(ikiye(fark, a, b));
      a = b; fa = fb;
    }
    return null;
  }

  // f(a)<0<=f(b) varsayımıyla kök
  function ikiye(f, a, b) {
    let fa = f(a);
    for (let i = 0; i < 40 && b - a > 1000; i++) {
      const m = (a + b) / 2, fm = f(m);
      if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }

  // [bas, bas+24s) içinde yükseklik fonksiyonunun h0'ı kestiği anlar.
  // yon: 'yukari' (yükselirken) / 'asagi' (alçalırken)
  function kesisimler(yukseklik, bas, h0) {
    const ADIM = 10 * 60000, son = bas + GUN_MS, sonuc = [];
    let a = bas, fa = yukseklik(a) - h0;
    while (a < son) {
      const b = Math.min(a + ADIM, son), fb = yukseklik(b) - h0;
      if ((fa < 0) !== (fb < 0)) {
        const yukari = fa < 0;
        const f = yukari ? (x => yukseklik(x) - h0) : (x => h0 - yukseklik(x));
        sonuc.push({ zaman: new Date(ikiye(f, a, b)), yon: yukari ? 'yukari' : 'asagi' });
      }
      a = b; fa = fb;
    }
    return sonuc;
  }

  function enYuksek(yukseklik, bas) {
    let enT = bas, enH = -Infinity;
    for (let t = bas; t <= bas + GUN_MS; t += 5 * 60000) { const h = yukseklik(t); if (h > enH) { enH = h; enT = t; } }
    let a = enT - 5 * 60000, b = enT + 5 * 60000;
    for (let i = 0; i < 40; i++) {
      const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (yukseklik(m1) < yukseklik(m2)) a = m1; else b = m2;
    }
    return new Date((a + b) / 2);
  }

  const ilk = (liste, yon) => { const x = liste.find(k => k.yon === yon); return x ? x.zaman : null; };

  // Telefonun yerel gününün başlangıcı
  function gunBasi(tarih) { const d = new Date(tarih); d.setHours(0, 0, 0, 0); return +d; }

  // ---- Günlük güneş olayları ----
  // Eşikler (geometrik yükseklik, kırılmasız): doğuş/batış -0,833 (merkez, kırılma+yarıçap)
  function gunesGunu(tarih, enl, boy) {
    const bas = gunBasi(tarih);
    const h = t => yatay(t, gunesEkv(t).ra, gunesEkv(t).dec, enl, boy).alt;
    const k = esik => kesisimler(h, bas, esik);
    const dogBat = k(-0.833), s6 = k(6), s4 = k(-4), s6n = k(-6), s12 = k(-12), s18 = k(-18);
    const tepe = enYuksek(h, bas);
    const dogus = ilk(dogBat, 'yukari'), batis = ilk(dogBat, 'asagi');
    const azi = z => z ? gunesKonum(z, enl, boy).az : null;
    const tepeYuk = gunesKonum(tepe, enl, boy).alt;
    let durum = 'normal';
    if (!dogus && !batis) durum = tepeYuk > 0 ? 'batmiyor' : 'dogmuyor';
    return {
      durum,
      astroSafak: ilk(s18, 'yukari'), denizciSafak: ilk(s12, 'yukari'), sivilSafak: ilk(s6n, 'yukari'),
      maviSabahBas: ilk(s6n, 'yukari'), maviSabahSon: ilk(s4, 'yukari'),
      altinSabahBas: ilk(s4, 'yukari'), altinSabahSon: ilk(s6, 'yukari'),
      dogus, dogusAz: azi(dogus),
      tepe, tepeYuk,
      altinAksamBas: ilk(s6, 'asagi'), altinAksamSon: ilk(s4, 'asagi'),
      maviAksamBas: ilk(s4, 'asagi'), maviAksamSon: ilk(s6n, 'asagi'),
      batis, batisAz: azi(batis),
      sivilAksam: ilk(s6n, 'asagi'), denizciAksam: ilk(s12, 'asagi'), astroAksam: ilk(s18, 'asagi'),
      gunUzunlukDk: dogus && batis && batis > dogus ? Math.round((batis - dogus) / 60000) : null
    };
  }

  // ---- Günlük ay olayları ----
  // Doğuş/batış: geosantrik yükseklik = 0,7275*paralaks - 0,5667° (≈ +0,125°)
  function ayGunu(tarih, enl, boy) {
    const bas = gunBasi(tarih);
    const h = t => { const m = ayEkv(t); return yatay(t, m.ra, m.dec, enl, boy).alt - (0.7275 * m.par - 0.5667); };
    const liste = kesisimler(h, bas, 0);
    const dogus = ilk(liste, 'yukari'), batis = ilk(liste, 'asagi');
    const tepe = enYuksek(t => ayKonum(t, enl, boy).alt, bas);
    return {
      dogus, dogusAz: dogus ? ayKonum(dogus, enl, boy).az : null,
      batis, batisAz: batis ? ayKonum(batis, enl, boy).az : null,
      tepe, tepeYuk: ayKonum(tepe, enl, boy).alt,
      evre: ayEvre(tarih),
      sonrakiDolunay: sonrakiEvre(bas, 180),
      sonrakiYeniAy: sonrakiEvre(bas, 0)
    };
  }

  // Gün boyunca yol (harita/AR için): her `dk` dakikada bir konum
  function gunlukYol(konumFn, tarih, enl, boy, dk) {
    const bas = gunBasi(tarih), yol = [];
    for (let t = bas; t <= bas + GUN_MS; t += (dk || 15) * 60000) yol.push(Object.assign({ zaman: new Date(t) }, konumFn(t, enl, boy)));
    return yol;
  }

  // ---- Gece / Samanyolu ----
  // Seçili günün akşamından ertesi sabaha: astronomik karanlık (güneş < -18°),
  // galaktik merkezin (Samanyolu çekirdeği) görünür olduğu süre ve aysız kısmı.
  function geceAnalizi(tarih, enl, boy) {
    const d = new Date(gunBasi(tarih)); d.setHours(12, 0, 0, 0);
    const bas = +d, son = bas + GUN_MS, ADIM = 5 * 60000;
    const ortaGece = new Date(bas + 12 * 3600000);
    const evre = ayEvre(ortaGece);
    const s = {
      karanlikBas: null, karanlikSon: null, gmBas: null, gmSon: null, gmBasAz: null, gmSonAz: null,
      enIyi: null, gmDk: 0, aysizGmDk: 0, aysizKaranlikDk: 0, karanlikDk: 0, ayAydinlik: evre.aydinlik, ayEvre: evre
    };
    let enIyiPuan = -Infinity;
    for (let t = bas; t <= son; t += ADIM) {
      const se = gunesEkv(t), gAlt = yatay(t, se.ra, se.dec, enl, boy).alt;
      if (gAlt >= -18) continue;
      const gc = galaktikKonum(t, enl, boy), ay = ayKonum(t, enl, boy);
      const aysiz = ay.alt < 0 || evre.aydinlik < 0.1;
      if (s.karanlikBas == null) s.karanlikBas = new Date(t);
      s.karanlikSon = new Date(t);
      s.karanlikDk += 5; if (aysiz) s.aysizKaranlikDk += 5;
      if (gc.alt > 5) {
        if (s.gmBas == null) { s.gmBas = new Date(t); s.gmBasAz = gc.az; }
        s.gmSon = new Date(t); s.gmSonAz = gc.az;
        s.gmDk += 5; if (aysiz) s.aysizGmDk += 5;
        const puan = gc.alt + (aysiz ? 100 : 0);       // önce aysız, sonra en yüksek
        if (puan > enIyiPuan) { enIyiPuan = puan; s.enIyi = { zaman: new Date(t), az: gc.az, alt: gc.alt, aysiz }; }
      }
    }
    const saat = s.aysizGmDk / 60;
    s.puan = saat <= 0 ? 0 : saat < 1 ? 1 : saat < 3 ? 2 : 3;   // 0 yok, 1 zayıf, 2 iyi, 3 çok iyi
    return s;
  }

  function yonAdi(az) {
    const adlar = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
    return adlar[Math.round(norm360(az) / 22.5) % 16];
  }

  const Astro = { gunesKonum, ayKonum, galaktikKonum, ayEvre, sonrakiEvre, gunesGunu, ayGunu, geceAnalizi, gunlukYol, gunBasi, yonAdi, kirilma };
  if (typeof module !== 'undefined' && module.exports) module.exports = Astro; else kok.Astro = Astro;
})(typeof window !== 'undefined' ? window : globalThis);
