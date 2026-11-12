// Güneşin Açısı — drone: uçuş havası kararı, havalimanı mesafesi, hedef/ışık hesabı.
// Karar fonksiyonları saf (Node'da testlenebilir); veri çekme sadece tarayıcıda.
(function (kok) {
  'use strict';
  const RAD = Math.PI / 180;

  // Avata 360 (DJI resmi): en fazla rüzgâr 10,7 m/s (Seviye 5). Çalışma sıcaklığı -10..40 °C.
  const VARSAYILAN = { yukseklik: 50, ruzgarSinir: 10.7, yaricapKm: 5 };

  // 10/80/120 m rüzgârından istenen yüksekliğe (logaritmik ara değer)
  function yukseklikRuzgar(s10, s80, s120, h) {
    const n = [[10, s10], [80, s80], [120, s120]].filter(x => x[1] != null);
    if (!n.length) return null;
    if (h <= n[0][0]) return n[0][1];
    for (let i = 1; i < n.length; i++) {
      const [h0, v0] = n[i - 1], [h1, v1] = n[i];
      if (h <= h1) return v0 + (v1 - v0) * Math.log(h / h0) / Math.log(h1 / h0);
    }
    return n[n.length - 1][1];
  }

  const ms = v => v.toFixed(1).replace('.', ',') + ' m/s';

  // saat: { ruzgar10, ruzgar80, ruzgar120, ani10, yagis, yagisOlas, gorus, sicaklik, kod, kp }
  // Dönüş: { seviye: 0 uç | 1 dikkat | 2 uçma, ruzgar, nedenler: [{seviye, metin}] }
  function karar(saat, ayar) {
    const a = Object.assign({}, VARSAYILAN, ayar || {}), N = [];
    const ekle = (seviye, metin) => N.push({ seviye, metin });
    const r = yukseklikRuzgar(saat.ruzgar10, saat.ruzgar80, saat.ruzgar120, a.yukseklik);
    if (r != null) {
      if (r >= a.ruzgarSinir) ekle(2, `${a.yukseklik} m'de rüzgâr ${ms(r)} — drone'un sınırı ${ms(a.ruzgarSinir)}`);
      else if (r >= a.ruzgarSinir * 0.7) ekle(1, `${a.yukseklik} m'de rüzgâr ${ms(r)} — sınıra yakın, dönüşte zorlanabilir`);
    }
    if (saat.ani10 != null) {
      if (saat.ani10 >= a.ruzgarSinir) ekle(2, `Ani rüzgâr ${ms(saat.ani10)} (yerde) — sınırın üstünde`);
      else if (saat.ani10 >= a.ruzgarSinir * 0.75) ekle(1, `Ani rüzgâr ${ms(saat.ani10)} (yerde)`);
    }
    const k = saat.kod;
    if (k >= 95) ekle(2, 'Gök gürültülü fırtına');
    else if ((k >= 71 && k <= 77) || k === 85 || k === 86) ekle(2, 'Kar yağışı');
    if (saat.yagis != null && saat.yagis >= 0.3) ekle(2, `Yağış ${saat.yagis.toFixed(1).replace('.', ',')} mm — drone suya dayanıklı değil`);
    else if (saat.yagisOlas != null && saat.yagisOlas >= 40) ekle(1, `Yağış olasılığı %${saat.yagisOlas}`);
    if (saat.gorus != null) {
      if (saat.gorus < 1000) ekle(2, `Görüş ${Math.round(saat.gorus)} m — sis/pus`);
      else if (saat.gorus < 3000) ekle(1, `Görüş ${(saat.gorus / 1000).toFixed(1).replace('.', ',')} km`);
    }
    if (saat.sicaklik != null) {
      if (saat.sicaklik < -10 || saat.sicaklik > 40) ekle(2, `Sıcaklık ${Math.round(saat.sicaklik)} °C — çalışma aralığı dışında (-10…40 °C)`);
      else if (saat.sicaklik < 5) ekle(1, `Sıcaklık ${Math.round(saat.sicaklik)} °C — batarya hızlı biter, kalkıştan önce ısıtın`);
    }
    if (saat.kp != null) {
      if (saat.kp >= 7) ekle(2, `Kp ${saat.kp.toFixed(1).replace('.', ',')} — güçlü manyetik fırtına, GPS/pusula bozulabilir`);
      else if (saat.kp >= 5) ekle(1, `Kp ${saat.kp.toFixed(1).replace('.', ',')} — manyetik fırtına, GPS etkilenebilir`);
    }
    const seviye = N.reduce((m, n) => Math.max(m, n.seviye), 0);
    N.sort((x, y) => y.seviye - x.seviye);
    return { seviye, ruzgar: r, nedenler: N };
  }

  // ---- Coğrafya ----
  function mesafeKm(e1, b1, e2, b2) {
    const de = (e2 - e1) * RAD, db = (b2 - b1) * RAD;
    const h = Math.sin(de / 2) ** 2 + Math.cos(e1 * RAD) * Math.cos(e2 * RAD) * Math.sin(db / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function yonAci(e1, b1, e2, b2) {
    const y = Math.sin((b2 - b1) * RAD) * Math.cos(e2 * RAD);
    const x = Math.cos(e1 * RAD) * Math.sin(e2 * RAD) - Math.sin(e1 * RAD) * Math.cos(e2 * RAD) * Math.cos((b2 - b1) * RAD);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  function enYakinHavalimanlari(enl, boy, liste, adet) {
    return liste.map(h => ({ ad: h[0], enl: h[1], boy: h[2], tur: h[3], kod: h[4], km: mesafeKm(enl, boy, h[1], h[2]) }))
      .sort((a, b) => a.km - b.km).slice(0, adet || 3);
  }

  // Kameradan hedefe bakış yönü ile güneş yönü arasındaki fark -> ışık türü
  function isikTipi(hedefAz, gunesAz, gunesAlt) {
    if (gunesAlt < -0.833) return { ad: 'Güneş ufkun altında', fark: null };
    let f = Math.abs(hedefAz - gunesAz) % 360; if (f > 180) f = 360 - f;
    const ad = f <= 30 ? 'Ters ışık — güneş hedefin arkasında (siluet, parlama)'
      : f >= 150 ? 'Ön ışık — güneş arkanızda (hedef aydınlık)'
        : 'Yan ışık — derinlik ve gölge';
    return { ad, fark: f };
  }

  // Drone yüksekliğinden yerdeki hedefe kamera eğimi (aşağı, derece)
  function kameraEgimi(yukseklikM, mesafeM) { return Math.atan2(yukseklikM, Math.max(mesafeM, 1)) / RAD; }

  // ---- Veri çekme (tarayıcı) ----
  const HAVA_ALANLAR = 'temperature_2m,precipitation_probability,precipitation,visibility,cloud_cover,weather_code,wind_speed_10m,wind_speed_80m,wind_speed_120m,wind_direction_10m,wind_direction_120m,wind_gusts_10m';
  async function havaGetir(enl, boy) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${enl.toFixed(3)}&longitude=${boy.toFixed(3)}&hourly=${HAVA_ALANLAR}&wind_speed_unit=ms&timezone=GMT&past_days=1&forecast_days=7`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Hava servisi yanıt vermedi (' + r.status + ')');
    const j = await r.json(), h = j.hourly;
    return h.time.map((t, i) => ({
      zaman: new Date(t + ':00Z'),
      sicaklik: h.temperature_2m[i], yagisOlas: h.precipitation_probability[i], yagis: h.precipitation[i],
      gorus: h.visibility[i], bulut: h.cloud_cover[i], kod: h.weather_code[i],
      ruzgar10: h.wind_speed_10m[i], ruzgar80: h.wind_speed_80m[i], ruzgar120: h.wind_speed_120m[i],
      yon10: h.wind_direction_10m[i], yon120: h.wind_direction_120m[i], ani10: h.wind_gusts_10m[i]
    }));
  }
  async function kpGetir() {
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
    if (!r.ok) throw new Error('Kp alınamadı');
    const j = await r.json();
    // Yeni biçim: nesne dizisi; eski biçim: ilk satır başlık olan dizi dizisi
    const satirlar = Array.isArray(j[0]) ? j.slice(1).map(s => ({ time_tag: s[0], kp: +s[1] })) : j;
    return satirlar.map(s => ({ zaman: new Date(s.time_tag.replace(' ', 'T') + 'Z'), kp: +s.kp }));
  }
  function kpBul(liste, t) {
    if (!liste) return null;
    const x = liste.filter(k => k.zaman <= t && t - k.zaman < 3 * 3600000).pop();
    return x ? x.kp : null;
  }

  const Drone = { VARSAYILAN, yukseklikRuzgar, karar, mesafeKm, yonAci, enYakinHavalimanlari, isikTipi, kameraEgimi, havaGetir, kpGetir, kpBul };
  if (typeof module !== 'undefined' && module.exports) module.exports = Drone; else kok.Drone = Drone;
})(typeof window !== 'undefined' ? window : globalThis);
