// Güneşin Açısı — harita ve yön çizgileri (Leaflet)
(function () {
  'use strict';
  const KATMANLAR = {
    sokak: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, attribution: '© OpenStreetMap' }],
    uydu: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }],
    topo: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 17, attribution: '© OpenTopoMap, © OpenStreetMap' }]
  };
  let harita, katman, pin, cizimKatmani, sonVeri = null;
  let hedef = null, hedefModu = false, hedefBtn, hedefDegisti = () => { };

  function hedefKoy(latlng) {
    if (!latlng) { if (hedef) harita.removeLayer(hedef); hedef = null; }
    else if (hedef) hedef.setLatLng(latlng);
    else {
      hedef = L.marker(latlng, { draggable: true,
        icon: L.divIcon({ className: '', html: '<div class="hedef-pin">🎯</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(harita);
      hedef.on('drag', () => sonVeri && ciz(sonVeri));
      hedef.on('dragend', () => hedefDegisti(hedef.getLatLng()));
    }
    hedefBtnYaz();
  }
  function hedefBtnYaz() {
    if (!hedefBtn) return;
    hedefBtn.textContent = hedefModu ? 'Hedefe dokunun…' : hedef ? '✕ Hedef' : '🎯 Hedef';
    hedefBtn.classList.toggle('aktif', hedefModu);
  }

  function kur(elId, konum, tiklayinca, hedefFn, ilkHedef) {
    hedefDegisti = hedefFn || hedefDegisti;
    harita = L.map(elId, { zoomControl: false, attributionControl: true }).setView([konum.enl, konum.boy], 14);
    turSec('sokak');
    cizimKatmani = L.layerGroup().addTo(harita);
    pin = L.marker([konum.enl, konum.boy], {
      draggable: true,
      icon: L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
    }).addTo(harita);
    pin.on('drag', () => sonVeri && ciz(sonVeri));
    pin.on('dragend', () => { const p = pin.getLatLng(); tiklayinca(p.lat, p.lng); });
    harita.on('click', e => {
      if (hedefModu) { hedefModu = false; hedefKoy(e.latlng); hedefDegisti(e.latlng); return; }
      pin.setLatLng(e.latlng); tiklayinca(e.latlng.lat, e.latlng.lng);
    });
    harita.on('zoom move resize', () => sonVeri && ciz(sonVeri));

    const Kontrol = L.Control.extend({
      onAdd() {
        hedefBtn = L.DomUtil.create('button', 'harita-btn');
        L.DomEvent.disableClickPropagation(hedefBtn);
        hedefBtn.addEventListener('click', () => {
          if (hedef && !hedefModu) { hedefKoy(null); hedefDegisti(null); }
          else { hedefModu = !hedefModu; hedefBtnYaz(); }
        });
        return hedefBtn;
      }
    });
    new Kontrol({ position: 'topright' }).addTo(harita);
    if (ilkHedef) hedefKoy(L.latLng(ilkHedef.enl, ilkHedef.boy));
    hedefBtnYaz();
  }

  function turSec(tur) {
    const k = KATMANLAR[tur] || KATMANLAR.sokak;
    if (katman) harita.removeLayer(katman);
    katman = L.tileLayer(k[0], k[1]).addTo(harita);
  }

  function konumaGit(enl, boy, ortala) {
    pin.setLatLng([enl, boy]);
    if (ortala) harita.setView([enl, boy], Math.max(harita.getZoom(), 13));
  }

  function yenile() { harita && harita.invalidateSize(); }

  // Pinden ekranda `az` yönünde `uzunluk` piksel giden noktanın enlem/boylamı.
  // (Mercator açıyı korur; ekranda doğru yönü verir.)
  function uc(az, uzunluk) {
    const p = harita.latLngToContainerPoint(pin.getLatLng());
    const r = az * Math.PI / 180;
    return harita.containerPointToLatLng(L.point(p.x + Math.sin(r) * uzunluk, p.y - Math.cos(r) * uzunluk));
  }

  // veri: { dogusAz, batisAz, gunes:{az,alt}, ayDogusAz, ayBatisAz, ay:{az,alt}, ayIkon }
  function ciz(veri) {
    sonVeri = veri;
    if (!harita) return;
    cizimKatmani.clearLayers();
    const b = harita.getSize(), R = Math.min(b.x, b.y) * 0.45, merkez = pin.getLatLng();
    const cizgi = (az, renk, kalin, kesik, oran) => {
      if (az == null) return;
      L.polyline([merkez, uc(az, R * (oran || 1))], { color: renk, weight: kalin, dashArray: kesik ? '8 8' : null, opacity: .95, interactive: false }).addTo(cizimKatmani);
    };
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    cizgi(veri.ayDogusAz, css('--ay-dogus'), 3, true, .8);
    cizgi(veri.ayBatisAz, css('--ay-batis'), 3, true, .8);
    cizgi(veri.dogusAz, css('--dogus'), 4);
    cizgi(veri.batisAz, css('--batis'), 4);
    // Anlık güneş ve ay: ufkun altındaysa soluk ve kesik
    const anlik = (k, renk, ikon, oran) => {
      if (!k) return;
      const ust = k.alt > 0;
      L.polyline([merkez, uc(k.az, R * oran)], { color: renk, weight: ust ? 6 : 3, opacity: ust ? 1 : .5, dashArray: ust ? null : '2 8', interactive: false }).addTo(cizimKatmani);
      L.marker(uc(k.az, R * oran), { interactive: false, opacity: ust ? 1 : .55,
        icon: L.divIcon({ className: '', html: `<div class="gok-ikon">${ikon}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(cizimKatmani);
    };
    if (veri.gm && veri.gm.alt > 0) anlik(veri.gm, css('--gm'), '🌌', .85);
    anlik(veri.ay, css('--ay'), veri.ayIkon || '🌙', .7);
    anlik(veri.gunes, css('--gunes'), '☀️', 1.05);
    if (hedef) L.polyline([merkez, hedef.getLatLng()], { color: '#ffffff', weight: 2, dashArray: '4 6', opacity: .9, interactive: false }).addTo(cizimKatmani);
  }

  function hedefKonum() { if (!hedef) return null; const p = hedef.getLatLng(); return { enl: p.lat, boy: p.lng }; }

  window.Harita = { kur, turSec, konumaGit, ciz, yenile, hedefKonum };
})();
