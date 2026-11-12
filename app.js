// Güneşin Açısı — ekranlar
(function () {
  'use strict';
  const SURUM = '0.2.1';
  const $ = id => document.getElementById(id);
  const KAYIT = 'gunesinAcisi.v1';

  // ---- Durum ----
  const durum = Object.assign({
    konum: { enl: 41.0082, boy: 28.9784, ad: 'İstanbul' },
    haritaTuru: 'sokak',
    hedef: null,
    drone: { yukseklik: 50, ruzgarSinir: Drone.VARSAYILAN.ruzgarSinir, yaricapKm: Drone.VARSAYILAN.yaricapKm }
  }, oku());
  let hava = null, havaHata = '', havaAnahtar = '', kp = null, havalimanlari = null;
  let gun = Astro.gunBasi(new Date());     // seçili günün başı (ms)
  let dakika = simdikiDakika();             // 0..1439
  let gunVerisi = null;

  function oku() { try { return JSON.parse(localStorage.getItem(KAYIT)) || {}; } catch (e) { return {}; } }
  function kaydet() { try { localStorage.setItem(KAYIT, JSON.stringify({ konum: durum.konum, haritaTuru: durum.haritaTuru, hedef: durum.hedef, drone: durum.drone })); } catch (e) { } }
  function simdikiDakika() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  // Seçili an. Yaz saati geçişlerinde de doğru olsun diye yerel tarih üzerinden kurulur.
  function secilenAn() { const d = new Date(gun); d.setHours(0, dakika, 0, 0); return d; }

  // ---- Biçimlendirme ----
  const saat = d => d ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const derece = x => x == null ? '—' : Math.round(x) + '°';
  const yon = az => az == null ? '—' : `${Math.round(az)}° ${Astro.yonAdi(az)}`;
  const aci = alt => (alt >= 0 ? '' : '−') + Math.abs(alt).toFixed(1) + '°';
  const tarihUzun = t => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' });
  const sure = dk => dk == null ? '—' : `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
  const aralik = (a, b) => a || b ? `${saat(a)} – ${saat(b)}` : '—';
  function ayEmoji(uzanim, enl) {
    const kuzey = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const i = Math.round(uzanim / 45) % 8;
    return enl < 0 ? kuzey[(8 - i) % 8] : kuzey[i];   // güney yarımkürede ay ters görünür
  }

  // ---- Hesap ----
  function gunuHesapla() {
    const { enl, boy } = durum.konum;
    const ortaGun = new Date(gun + 12 * 3600000);
    gunVerisi = { g: Astro.gunesGunu(ortaGun, enl, boy), a: Astro.ayGunu(ortaGun, enl, boy) };
    kaydiriciBoya();
    saatlerCiz();
  }

  function anlikGuncelle() {
    const { enl, boy } = durum.konum, t = secilenAn();
    const g = Astro.gunesKonum(t, enl, boy), a = Astro.ayKonum(t, enl, boy), ev = Astro.ayEvre(t);
    const ik = ayEmoji(ev.uzanim, enl);
    $('saatYazi').textContent = saat(t);
    $('gAz').textContent = yon(g.az); $('gAlt').textContent = aci(g.alt);
    $('aAz').textContent = yon(a.az); $('aAlt').textContent = aci(a.alt);
    $('ayIkon').textContent = ik;
    $('saatKaydir').value = dakika;
    Harita.ciz({
      dogusAz: gunVerisi.g.dogusAz, batisAz: gunVerisi.g.batisAz, gunes: g,
      ayDogusAz: gunVerisi.a.dogusAz, ayBatisAz: gunVerisi.a.batisAz, ay: a, ayIkon: ik
    });
    hedefBilgiYaz(g);
    droneCiz();
  }

  // ---- Hedef (ikinci pin) ----
  function hedefHesap(g) {
    const h = durum.hedef; if (!h) return null;
    const k = durum.konum;
    const km = Drone.mesafeKm(k.enl, k.boy, h.enl, h.boy), az = Drone.yonAci(k.enl, k.boy, h.enl, h.boy);
    return { km, az, isik: Drone.isikTipi(az, g.az, g.alt), egim: Drone.kameraEgimi(durum.drone.yukseklik, km * 1000) };
  }
  const mesafe = km => km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(2).replace('.', ',') + ' km';
  function hedefBilgiYaz(g) {
    const el = $('hedefBilgi'), h = hedefHesap(g);
    if (!h) { el.classList.add('gizli'); return; }
    el.classList.remove('gizli');
    el.innerHTML = `🎯 <b>${mesafe(h.km)}</b> · yön <b>${yon(h.az)}</b>` +
      (h.isik.fark != null ? ` · güneşle fark <b>${Math.round(h.isik.fark)}°</b>` : ' · güneş ufkun altında');
  }

  // ---- Drone ----
  const SEVIYE = ['UÇ', 'DİKKAT', 'UÇMA'];
  const ms1 = v => v == null ? '—' : v.toFixed(1).replace('.', ',');
  const okIsareti = yonDer => yonDer == null ? '' : `<span class="ok" style="transform:rotate(${Math.round(yonDer + 180)}deg)">↑</span>`;

  function havaSaati(t) {
    if (!hava) return null;
    const s = Math.floor(+t / 3600000) * 3600000;
    const x = hava.find(h => +h.zaman === s);
    return x ? Object.assign({ kp: Drone.kpBul(kp, t) }, x) : null;
  }

  function droneCiz() {
    if (!$('sayfa-drone').classList.contains('aktif')) return;
    const t = secilenAn(), ayar = durum.drone;
    document.querySelectorAll('#yukseklikSec button').forEach(b => b.classList.toggle('aktif', +b.dataset.h === ayar.yukseklik));
    const kart = $('kararKart'), s = havaSaati(t);
    if (!s) {
      kart.className = 'karar-kart s1';
      kart.innerHTML = `<div class="ust-satir"><span class="buyuk">${hava ? 'Tahmin yok' : havaHata ? 'Hava alınamadı' : 'Yükleniyor…'}</span></div>
        <div class="kucuk">${hava ? 'Hava tahmini dünden itibaren 7 gün için var. Tarihi değiştirin.' : havaHata || 'Hava durumu alınıyor.'}</div>`;
      $('havaIzgara').innerHTML = ''; $('saatlikListe').innerHTML = '';
    } else {
      const k = Drone.karar(s, ayar);
      kart.className = 'karar-kart s' + k.seviye;
      kart.innerHTML = `<div class="ust-satir"><span class="buyuk">${SEVIYE[k.seviye]}</span><span>${saat(t)} · ${ayar.yukseklik} m</span></div>` +
        (k.nedenler.length ? `<ul>${k.nedenler.map(n => `<li>${n.metin}</li>`).join('')}</ul>` : '<div class="kucuk">Rüzgâr, yağış, görüş ve sıcaklık uygun.</div>');
      const kutu = (et, de) => `<div class="kutu"><div class="et">${et}</div><div class="de">${de}</div></div>`;
      $('havaIzgara').innerHTML = [
        kutu(`Rüzgâr ${ayar.yukseklik} m`, `${ms1(k.ruzgar)} <small>m/s · ${Math.round((k.ruzgar || 0) * 3.6)} km/sa</small> ${okIsareti(s.yon120)}`),
        kutu('Rüzgâr yerde (10 m)', `${ms1(s.ruzgar10)} <small>m/s</small> ${okIsareti(s.yon10)}`),
        kutu('Ani rüzgâr (yerde)', `${ms1(s.ani10)} <small>m/s</small>`),
        kutu('Yağış', `%${s.yagisOlas ?? '—'} <small>${ms1(s.yagis)} mm</small>`),
        kutu('Görüş', s.gorus == null ? '—' : s.gorus >= 10000 ? '10+ <small>km</small>' : `${ms1(s.gorus / 1000)} <small>km</small>`),
        kutu('Sıcaklık', `${s.sicaklik == null ? '—' : Math.round(s.sicaklik)} <small>°C</small>`),
        kutu('Bulut', `%${s.bulut ?? '—'}`),
        kutu('Manyetik (Kp)', s.kp == null ? '—' : ms1(s.kp))
      ].join('');
      // Saat saat (seçili gün)
      const gunSon = new Date(gun); gunSon.setDate(gunSon.getDate() + 1);
      const sec = Math.floor(+t / 3600000) * 3600000;
      const satirlar = hava.filter(h => +h.zaman >= gun && h.zaman < gunSon).map(h => {
        const hk = Drone.karar(Object.assign({ kp: Drone.kpBul(kp, h.zaman) }, h), ayar);
        return `<div class="satir tik ${+h.zaman === sec ? 'secili' : ''}" data-t="${+h.zaman}">
          <span><span class="nokta s${hk.seviye}"></span>${saat(h.zaman)}</span>
          <span class="sag"><b>${ms1(hk.ruzgar)}</b> m/s ${okIsareti(h.yon120)} · ani ${ms1(h.ani10)} · %${h.yagisOlas ?? '—'} · ${Math.round(h.sicaklik)}°</span></div>`;
      });
      const liste = $('saatlikListe');
      liste.innerHTML = satirlar.join('') || '<div class="satir pasif">Bu gün için tahmin yok</div>';
      liste.querySelectorAll('.satir.tik').forEach(r => r.addEventListener('click', () => {
        const z = new Date(+r.dataset.t); dakika = z.getHours() * 60 + z.getMinutes(); anlikGuncelle();
      }));
    }
    // Havalimanları
    const hl = $('havalimaniListe');
    if (!havalimanlari) hl.innerHTML = '<div class="satir pasif">Yükleniyor…</div>';
    else {
      const k = durum.konum, yakin = Drone.enYakinHavalimanlari(k.enl, k.boy, havalimanlari, 3);
      const icinde = yakin.filter(h => h.km <= ayar.yaricapKm);
      hl.innerHTML = (icinde.length ? `<div class="satir uyari"><span>⚠️ ${ayar.yaricapKm} km içinde havalimanı var — uçuş izni gerekebilir</span></div>` : '') +
        yakin.map(h => `<div class="satir ${h.km <= ayar.yaricapKm ? 'uyari' : ''}"><span>${h.tur === 'k' ? '🛩' : '✈️'} ${h.ad}${h.kod ? ' (' + h.kod + ')' : ''}</span><span class="sag"><b>${mesafe(h.km)}</b></span></div>`).join('');
    }
    // Güneş ve hedef
    const k = durum.konum, g = Astro.gunesKonum(t, k.enl, k.boy), h = hedefHesap(g);
    const sat = (a, b) => `<div class="satir"><span>${a}</span><span class="sag">${b}</span></div>`;
    $('hedefListe').innerHTML = sat('Güneş (drone konumundan)', `<b>${yon(g.az)}</b> · açı ${aci(g.alt)}`) +
      (h ? sat('Hedefe mesafe', `<b>${mesafe(h.km)}</b>`) + sat('Hedefin yönü', `<b>${yon(h.az)}</b>`) +
        sat('Işık', h.isik.ad + (h.isik.fark != null ? ` (${Math.round(h.isik.fark)}°)` : '')) +
        sat(`Kamera eğimi (${ayar.yukseklik} m'den)`, `<b>${Math.round(h.egim)}°</b> aşağı`)
        : sat('Hedef', 'Konulmadı'));
  }

  async function havaYukle() {
    const k = durum.konum, anahtar = k.enl.toFixed(2) + ',' + k.boy.toFixed(2);
    if (anahtar === havaAnahtar && hava) return;
    havaAnahtar = anahtar; havaHata = ''; hava = null; droneCiz();
    try {
      const v = await Drone.havaGetir(k.enl, k.boy);
      if (anahtar === havaAnahtar) hava = v;
    } catch (e) { havaHata = navigator.onLine === false ? 'İnternet yok.' : 'Hava servisine ulaşılamadı. Biraz sonra tekrar deneyin.'; havaAnahtar = ''; }
    droneCiz();
  }
  async function digerVeriYukle() {
    if (!kp) Drone.kpGetir().then(v => { kp = v; droneCiz(); }).catch(() => { });
    if (!havalimanlari) fetch('veri/havalimanlari.json').then(r => r.json()).then(v => { havalimanlari = v; droneCiz(); }).catch(() => { });
  }

  // Kaydırıcının arkasına günün renkleri: gece / mavi saat / altın saat / gündüz
  function kaydiriciBoya() {
    const { enl, boy } = durum.konum, duraklar = [];
    for (let m = 0; m <= 1440; m += 10) {
      const d = new Date(gun); d.setHours(0, m, 0, 0);
      const h = Astro.gunesKonum(d, enl, boy).alt;
      const renk = h < -6 ? '#0a0f1a' : h < -4 ? '#2f5fbf' : h < 6 ? '#f0a020' : '#7fb6e8';
      duraklar.push(`${renk} ${(m / 1440 * 100).toFixed(2)}%`);
    }
    $('kaydiriciIz').style.background = `linear-gradient(90deg, ${duraklar.join(',')})`;
  }

  function saatlerCiz() {
    const { g, a } = gunVerisi, k = durum.konum;
    $('saatlerBaslik').textContent = `${tarihUzun(gun)} · ${k.ad || ''}`;
    const not = $('durumNotu');
    if (g.durum === 'batmiyor') { not.textContent = 'Bu gün güneş hiç batmıyor (kutup gündüzü).'; not.classList.remove('gizli'); }
    else if (g.durum === 'dogmuyor') { not.textContent = 'Bu gün güneş hiç doğmuyor (kutup gecesi).'; not.classList.remove('gizli'); }
    else not.classList.add('gizli');

    const satir = (ad, deger, zaman, sinif) => ({ ad, deger, zaman, sinif });
    const gs = [
      satir('Astronomik şafak', saat(g.astroSafak), g.astroSafak),
      satir('Denizci şafağı', saat(g.denizciSafak), g.denizciSafak),
      satir('Mavi saat', aralik(g.maviSabahBas, g.maviSabahSon), g.maviSabahBas, 'mavi'),
      satir('Altın saat', aralik(g.altinSabahBas, g.altinSabahSon), g.altinSabahBas, 'altin'),
      satir('Gün doğumu', g.dogus ? `<b>${saat(g.dogus)}</b> · ${yon(g.dogusAz)}` : '—', g.dogus, 'ana'),
      satir('Öğle (en yüksek)', `${saat(g.tepe)} · açı ${derece(g.tepeYuk)}`, g.tepe),
      satir('Altın saat', aralik(g.altinAksamBas, g.altinAksamSon), g.altinAksamBas, 'altin'),
      satir('Gün batımı', g.batis ? `<b>${saat(g.batis)}</b> · ${yon(g.batisAz)}` : '—', g.batis, 'ana'),
      satir('Mavi saat', aralik(g.maviAksamBas, g.maviAksamSon), g.maviAksamBas, 'mavi'),
      satir('Denizci alacakaranlığı', saat(g.denizciAksam), g.denizciAksam),
      satir('Astronomik gece', saat(g.astroAksam), g.astroAksam),
      satir('Gün uzunluğu', sure(g.gunUzunlukDk))
    ];
    const ev = a.evre;
    $('ayBaslik').textContent = `${ayEmoji(ev.uzanim, k.enl)} Ay · ${ev.ad} · %${Math.round(ev.aydinlik * 100)} aydınlık`;
    const tarihKisa = d => d ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' ' + saat(d) : '—';
    const as = [
      satir('Ay doğuşu', a.dogus ? `<b>${saat(a.dogus)}</b> · ${yon(a.dogusAz)}` : 'Bu gün doğmuyor', a.dogus, 'ana'),
      satir('En yüksek', `${saat(a.tepe)} · açı ${derece(a.tepeYuk)}`, a.tepe),
      satir('Ay batışı', a.batis ? `<b>${saat(a.batis)}</b> · ${yon(a.batisAz)}` : 'Bu gün batmıyor', a.batis, 'ana'),
      satir('Sonraki dolunay', tarihKisa(a.sonrakiDolunay)),
      satir('Sonraki yeni ay', tarihKisa(a.sonrakiYeniAy))
    ];
    const yaz = (el, liste) => {
      el.innerHTML = liste.map((s, i) => `<div class="satir ${s.sinif || ''} ${s.zaman ? 'tik' : ''}" data-i="${i}"><span>${s.ad}</span><span class="sag">${s.deger}</span></div>`).join('');
      el.querySelectorAll('.satir.tik').forEach(r => r.addEventListener('click', () => {
        const z = liste[+r.dataset.i].zaman;
        if (Astro.gunBasi(z) !== gun) { gun = Astro.gunBasi(z); tarihYaz(); gunuHesapla(); }
        dakika = z.getHours() * 60 + z.getMinutes();
        sayfaAc('harita'); anlikGuncelle();
      }));
    };
    yaz($('gunesListe'), gs); yaz($('ayListe'), as);
  }

  function tarihYaz() {
    $('tarihYazi').textContent = tarihUzun(gun);
    const d = new Date(gun);
    $('tarihSec').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ---- Konum ----
  let adZamanlayici = null;
  function konumDegisti(enl, boy, ortala) {
    durum.konum = { enl, boy, ad: `${enl.toFixed(4)}, ${boy.toFixed(4)}` };
    $('konumAd').textContent = '📍 ' + durum.konum.ad;
    Harita.konumaGit(enl, boy, ortala);
    kaydet(); gunuHesapla(); anlikGuncelle();
    clearTimeout(adZamanlayici);
    adZamanlayici = setTimeout(() => { yerAdiBul(enl, boy); havaYukle(); }, 800);
  }

  async function yerAdiBul(enl, boy) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${enl}&lon=${boy}&zoom=14&accept-language=tr`);
      if (!r.ok) return;
      const j = await r.json(), a = j.address || {};
      const kucuk = a.neighbourhood || a.suburb || a.village || a.town || a.quarter || a.city_district || a.county;
      const buyuk = a.province || a.state || a.city || a.country;
      const ad = [kucuk, buyuk].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(', ');
      if (ad && durum.konum.enl === enl && durum.konum.boy === boy) {
        durum.konum.ad = ad; $('konumAd').textContent = '📍 ' + ad; kaydet();
        $('saatlerBaslik').textContent = `${tarihUzun(gun)} · ${ad}`;
      }
    } catch (e) { /* internet yoksa koordinat kalır */ }
  }

  function konumumuBul() {
    if (!navigator.geolocation) return alert('Bu cihaz konum vermiyor. Haritaya dokunarak konum seçin.');
    $('konumumBtn').textContent = '…';
    navigator.geolocation.getCurrentPosition(
      p => { $('konumumBtn').textContent = '◎'; konumDegisti(p.coords.latitude, p.coords.longitude, true); },
      () => { $('konumumBtn').textContent = '◎'; alert('Konum alınamadı. Konum iznini açın ya da haritaya dokunarak konum seçin.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  // ---- Sayfalar ----
  function sayfaAc(ad) {
    document.querySelectorAll('.sayfa').forEach(s => s.classList.toggle('aktif', s.id === 'sayfa-' + ad));
    document.querySelectorAll('.sekmeler button').forEach(b => b.classList.toggle('aktif', b.dataset.sayfa === ad));
    $('panel').classList.toggle('gizli', ad === 'diger');
    panelYuksekligi();
    if (ad === 'harita') setTimeout(Harita.yenile, 0);
    if (ad === 'drone') { havaYukle(); digerVeriYukle(); droneCiz(); }
  }
  function panelYuksekligi() { document.documentElement.style.setProperty('--panel-h', $('panel').offsetHeight + 'px'); }

  // ---- Başlat ----
  function baslat() {
    $('surum').textContent = SURUM;
    $('konumAd').textContent = '📍 ' + (durum.konum.ad || '');
    $('haritaTuru').value = durum.haritaTuru;
    Harita.kur('harita', durum.konum, (enl, boy) => konumDegisti(enl, boy, false),
      p => { durum.hedef = p ? { enl: p.lat, boy: p.lng } : null; kaydet(); anlikGuncelle(); }, durum.hedef);
    $('ruzgarSinir').value = durum.drone.ruzgarSinir;
    $('yaricapKm').value = durum.drone.yaricapKm;
    $('ruzgarSinir').addEventListener('change', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v >= 3 && v <= 20) { durum.drone.ruzgarSinir = v; kaydet(); } else e.target.value = durum.drone.ruzgarSinir; });
    $('yaricapKm').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v >= 1 && v <= 50) { durum.drone.yaricapKm = v; kaydet(); } else e.target.value = durum.drone.yaricapKm; });
    document.querySelectorAll('#yukseklikSec button').forEach(b => b.addEventListener('click', () => { durum.drone.yukseklik = +b.dataset.h; kaydet(); anlikGuncelle(); }));
    Harita.turSec(durum.haritaTuru);
    tarihYaz(); gunuHesapla(); anlikGuncelle(); panelYuksekligi();
    // Kayıtlı ad koordinat ise yeniden dene
    if (/^-?\d/.test(durum.konum.ad || '')) yerAdiBul(durum.konum.enl, durum.konum.boy);

    $('saatKaydir').addEventListener('input', e => { dakika = +e.target.value; anlikGuncelle(); });
    $('oncekiGun').addEventListener('click', () => gunKaydir(-1));
    $('sonrakiGun').addEventListener('click', () => gunKaydir(1));
    $('tarihSec').addEventListener('change', e => {
      if (!e.target.value) return;
      const [y, m, d] = e.target.value.split('-').map(Number);
      gun = +new Date(y, m - 1, d); tarihYaz(); gunuHesapla(); anlikGuncelle();
    });
    $('simdiBtn').addEventListener('click', () => { gun = Astro.gunBasi(new Date()); dakika = simdikiDakika(); tarihYaz(); gunuHesapla(); anlikGuncelle(); });
    $('konumumBtn').addEventListener('click', konumumuBul);
    $('konumAd').addEventListener('click', () => { sayfaAc('harita'); Harita.konumaGit(durum.konum.enl, durum.konum.boy, true); });
    $('haritaTuru').addEventListener('change', e => { durum.haritaTuru = e.target.value; Harita.turSec(durum.haritaTuru); kaydet(); });
    document.querySelectorAll('.sekmeler button').forEach(b => b.addEventListener('click', () => sayfaAc(b.dataset.sayfa)));
    window.addEventListener('resize', panelYuksekligi);
    const h = location.hash.slice(1);
    if (['harita', 'saatler', 'drone', 'diger'].includes(h)) sayfaAc(h);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(k => k.update()).catch(() => { });
      // Yeni sürüm devreye girince sayfayı bir kez yenile
      let yenilendi = !navigator.serviceWorker.controller;   // ilk kurulumda yenileme yok
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!yenilendi) { yenilendi = true; location.reload(); } });
    }
  }

  function gunKaydir(n) {
    const d = new Date(gun); d.setDate(d.getDate() + n); gun = +d;
    tarihYaz(); gunuHesapla(); anlikGuncelle();
  }

  baslat();
})();
