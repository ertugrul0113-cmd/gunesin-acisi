// Güneşin Açısı — kamera hesapları (saf fonksiyonlar; Node'da testlenebilir)
(function (kok) {
  'use strict';
  // Sensör hazır ayarları: genişlik × yükseklik (mm), varsayılan megapiksel
  const SENSORLER = [
    { id: 'ff', ad: 'Tam kare (Full frame)', gen: 36, yuk: 24, mp: 24 },
    { id: 'apsc', ad: 'APS-C (Sony, Nikon, Fuji)', gen: 23.5, yuk: 15.6, mp: 24 },
    { id: 'apsc-canon', ad: 'APS-C (Canon)', gen: 22.3, yuk: 14.9, mp: 24 },
    { id: 'mft', ad: 'Micro 4/3', gen: 17.3, yuk: 13, mp: 20 },
    { id: '1inc', ad: '1 inç', gen: 13.2, yuk: 8.8, mp: 20 },
    { id: '1-1.3', ad: '1/1.3 inç (drone/telefon)', gen: 9.6, yuk: 7.2, mp: 12 }
  ];
  const sensor = id => SENSORLER.find(s => s.id === id) || SENSORLER[0];
  const kosegen = s => Math.hypot(s.gen, s.yuk);
  const kirpma = s => Math.hypot(36, 24) / kosegen(s);
  // Piksel aralığı (µm)
  const pikselAraligi = (s, mp) => s.gen * 1000 / Math.sqrt((mp || s.mp) * 1e6 * s.gen / s.yuk);

  // 500 kuralı: yıldız izi olmadan en uzun süre (sn)
  const kural500 = (odak, s) => 500 / (odak * kirpma(s));
  // Basit NPF kuralı (sn): (35·N + 30·p) / f  — p piksel aralığı µm, N diyafram, f odak mm
  const npf = (odak, diyafram, s, mp) => (35 * diyafram + 30 * pikselAraligi(s, mp)) / odak;

  // ---- Alan derinliği ----
  // Bulanıklık çemberi (mm): köşegen / 1500
  const coc = s => kosegen(s) / 1500;
  function hiperfokal(odak, diyafram, s) { return (odak * odak) / (diyafram * coc(s)) + odak; }   // mm
  // mesafe (m) -> { yakin, uzak (Infinity olabilir), toplam } metre
  function alanDerinligi(odak, diyafram, mesafeM, s) {
    const H = hiperfokal(odak, diyafram, s), d = mesafeM * 1000;
    const yakin = d * (H - odak) / (H + d - 2 * odak);
    const uzak = d >= H ? Infinity : d * (H - odak) / (H - d);
    return { yakin: yakin / 1000, uzak: uzak / 1000, toplam: (uzak - yakin) / 1000, hiperfokal: H / 1000 };
  }

  // ---- ND filtre ----
  // durak sayısı: ND8 = 3, ND1000 = 10 ...
  const ndDurak = katsayi => Math.log2(katsayi);
  const ndSure = (sureSn, durak) => sureSn * Math.pow(2, durak);

  // ---- Timelapse ----
  // çekimSn: toplam çekim süresi, aralikSn: kareler arası, fps: video
  function timelapse(cekimSn, aralikSn, fps) {
    const kare = Math.floor(cekimSn / aralikSn) + 1;
    return { kare, videoSn: kare / fps };
  }

  // Süreyi okunur yaz: 1/250, 0,5 sn, 25 sn, 4 dk 10 sn, 1 sa 2 dk
  function sureYaz(sn) {
    if (!isFinite(sn)) return '—';
    if (sn < 0.3) return '1/' + Math.round(1 / sn);
    if (sn < 10) return sn.toFixed(1).replace('.', ',') + ' sn';
    if (sn < 60) return Math.round(sn) + ' sn';
    if (sn < 3600) { const d = Math.floor(sn / 60), s = Math.round(sn % 60); return s ? `${d} dk ${s} sn` : `${d} dk`; }
    const sa = Math.floor(sn / 3600), d = Math.round((sn % 3600) / 60); return d ? `${sa} sa ${d} dk` : `${sa} sa`;
  }

  const Kamera = { SENSORLER, sensor, kirpma, pikselAraligi, kural500, npf, coc, hiperfokal, alanDerinligi, ndDurak, ndSure, timelapse, sureYaz };
  if (typeof module !== 'undefined' && module.exports) module.exports = Kamera; else kok.Kamera = Kamera;
})(typeof window !== 'undefined' ? window : globalThis);
