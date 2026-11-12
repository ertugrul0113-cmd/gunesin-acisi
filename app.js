// Güneşin Açısı — ekranlar
(function () {
  'use strict';
  const SURUM = '0.4';
  const $ = id => document.getElementById(id);
  const KAYIT = 'gunesinAcisi.v1';

  // ---- Durum ----
  const durum = Object.assign({
    konum: { enl: 41.0082, boy: 28.9784, ad: 'İstanbul' },
    haritaTuru: 'sokak',
    hedef: null,
    drone: { yukseklik: 50, ruzgarSinir: Drone.VARSAYILAN.ruzgarSinir, yaricapKm: Drone.VARSAYILAN.yaricapKm },
    kamera: { sensor: 'ff', mp: 24, odak: 14, diyafram: 2.8 },
    ar: { gorus: 65, duzeltme: 0 }
  }, oku());
  let arYol = null;
  let hava = null, havaHata = '', havaAnahtar = '', kp = null, havalimanlari = null;
  let gun = Astro.gunBasi(new Date());     // seçili günün başı (ms)
  let dakika = simdikiDakika();             // 0..1439
  let gunVerisi = null;

  function oku() { try { return JSON.parse(localStorage.getItem(KAYIT)) || {}; } catch (e) { return {}; } }
  function kaydet() { try { localStorage.setItem(KAYIT, JSON.stringify({ konum: durum.konum, haritaTuru: durum.haritaTuru, hedef: durum.hedef, drone: durum.drone, kamera: durum.kamera, ar: durum.ar })); } catch (e) { } }
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
    arYol = null;   // AR yolları gerektiğinde yeniden hesaplanır
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
      ayDogusAz: gunVerisi.a.dogusAz, ayBatisAz: gunVerisi.a.batisAz, ay: a, ayIkon: ik,
      gm: Astro.galaktikKonum(t, enl, boy)
    });
    hedefBilgiYaz(g);
    droneCiz();
    geceCiz();
    if (AR.acikMi()) { $('arSaat').value = dakika; $('arTarih').textContent = arTarihYazi(); AR.cizIste(); }
  }

  // ---- Kamera ekranı (AR) ----
  const arTarihYazi = () => `${new Date(gun).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${saat(secilenAn())}`;
  function arVeri() {
    const { enl, boy } = durum.konum, t = secilenAn();
    if (!arYol) {
      const orta = new Date(gun + 12 * 3600000);
      arYol = {
        gunes: Astro.gunlukYol(Astro.gunesKonum, orta, enl, boy, 10),
        ay: Astro.gunlukYol(Astro.ayKonum, orta, enl, boy, 10),
        gm: Astro.gunlukYol(Astro.galaktikKonum, orta, enl, boy, 10)
      };
    }
    return {
      gunesYol: arYol.gunes, ayYol: arYol.ay, gmYol: arYol.gm,
      gunes: Astro.gunesKonum(t, enl, boy), ay: Astro.ayKonum(t, enl, boy), gm: Astro.galaktikKonum(t, enl, boy),
      saatYazi: arTarihYazi(), yonAdi: Astro.yonAdi
    };
  }
  function arAc() {
    $('arSaat').value = dakika; $('arTarih').textContent = arTarihYazi(); $('arFov').textContent = durum.ar.gorus + '°';
    AR.ac();
  }
  function arHizala(fn, ad) {
    const { enl, boy } = durum.konum, k = fn(new Date(), enl, boy);
    if (k.alt < -1) return alert(`${ad} şu an ufkun altında, hizalama yapılamaz.`);
    if (!confirm(`Ekranın ortasındaki artıyı (+) şu an gökyüzündeki ${ad.toLowerCase()} üstüne getirin ve Tamam'a basın.`)) return;
    AR.hizala(k.az);
  }

  // ---- Gece / Samanyolu ----
  const aktifMi = ad => $('sayfa-' + ad).classList.contains('aktif');
  const yildizlar = p => `<span class="yildiz">${'★'.repeat(p)}<span class="bos">${'★'.repeat(3 - p)}</span></span>`;
  const PUAN_AD = ['Görünmüyor', 'Zayıf', 'İyi', 'Çok iyi'];
  let geceOnbellek = {};
  function geceAnaliz(gunMs) {
    const k = durum.konum, anahtar = `${k.enl.toFixed(3)},${k.boy.toFixed(3)},${gunMs}`;
    if (!geceOnbellek[anahtar]) {
      if (Object.keys(geceOnbellek).length > 200) geceOnbellek = {};
      geceOnbellek[anahtar] = Astro.geceAnalizi(new Date(gunMs), k.enl, k.boy);
    }
    return geceOnbellek[anahtar];
  }
  function zamanaGit(z, sayfa) {
    if (Astro.gunBasi(z) !== gun) { gun = Astro.gunBasi(z); tarihYaz(); gunuHesapla(); }
    dakika = z.getHours() * 60 + z.getMinutes();
    if (sayfa) sayfaAc(sayfa);
    anlikGuncelle();
  }
  let sonGeceAnahtar = '';
  function geceCiz() {
    if (!aktifMi('gece')) return;
    const k = durum.konum, a = geceAnaliz(gun), ev = a.ayEvre;
    const kameraAnahtar = JSON.stringify(durum.kamera);
    pozCiz();
    const anahtar = `${k.enl},${k.boy},${gun},${kameraAnahtar}`;
    if (anahtar === sonGeceAnahtar) return;
    sonGeceAnahtar = anahtar;
    const yarin = new Date(gun); yarin.setDate(yarin.getDate() + 1);
    $('geceBaslik').textContent = `${new Date(gun).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – ${yarin.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} gecesi · ${k.ad || ''}`;
    const sat = (ad, deger, zaman) => `<div class="satir ${zaman ? 'tik' : ''}" ${zaman ? `data-t="${+zaman}"` : ''}><span>${ad}</span><span class="sag">${deger}</span></div>`;
    const sureYaz = dk => dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk} dk`;
    let html = sat('Samanyolu', `${yildizlar(a.puan)} <b>${PUAN_AD[a.puan]}</b>`);
    html += a.karanlikBas ? sat('Tam karanlık', `<b>${saat(a.karanlikBas)} – ${saat(a.karanlikSon)}</b>`, a.karanlikBas)
      : sat('Tam karanlık', 'Bu gece tam karanlık olmuyor');
    html += sat(`Ay ${ayEmoji(ev.uzanim, k.enl)}`, `${ev.ad} · %${Math.round(ev.aydinlik * 100)}`);
    if (a.karanlikBas) html += sat('Aysız karanlık', `<b>${sureYaz(a.aysizKaranlikDk)}</b>`);
    if (a.gmBas) {
      html += sat('Samanyolu merkezi görünür', `<b>${saat(a.gmBas)} – ${saat(a.gmSon)}</b>`, a.gmBas);
      html += sat('Yönü', `${yon(a.gmBasAz)} → ${yon(a.gmSonAz)}`);
      html += sat('Aysız görünme süresi', `<b>${sureYaz(a.aysizGmDk)}</b>`);
      html += sat('En iyi an', `<b>${saat(a.enIyi.zaman)}</b> · ${yon(a.enIyi.az)} · açı ${derece(a.enIyi.alt)}`, a.enIyi.zaman);
    } else html += sat('Samanyolu merkezi', 'Bu gece karanlıkta ufkun üstüne çıkmıyor');
    const el = $('geceListe');
    el.innerHTML = html;
    el.querySelectorAll('.satir.tik').forEach(r => r.addEventListener('click', () => zamanaGit(new Date(+r.dataset.t), 'harita')));
    // 30 gece
    const satirlar = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(gun); d.setDate(d.getDate() + i);
      const g = geceAnaliz(+d);
      const ae = g.ayEvre;
      satirlar.push(`<div class="satir tik" data-g="${+d}" data-t="${g.enIyi ? +g.enIyi.zaman : ''}">
        <span>${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })}</span>
        <span class="sag">${ayEmoji(ae.uzanim, k.enl)} ${g.aysizGmDk ? sureYaz(g.aysizGmDk) + ' · ' : ''}${yildizlar(g.puan)}</span></div>`);
    }
    const tk = $('geceTakvim');
    tk.innerHTML = satirlar.join('');
    tk.querySelectorAll('.satir.tik').forEach(r => r.addEventListener('click', () => {
      if (r.dataset.t) zamanaGit(new Date(+r.dataset.t));
      else { gun = +r.dataset.g; tarihYaz(); gunuHesapla(); anlikGuncelle(); }
      $('sayfa-gece').querySelector('.kaydir').scrollTop = 0;
    }));
  }

  // ---- Kamera ayarları (Gece ve Kamera sayfalarında ortak) ----
  function kameraAyarCiz(el) {
    const c = durum.kamera;
    el.innerHTML = `
      <div class="satir"><span>Sensör</span><select data-k="sensor">${Kamera.SENSORLER.map(s => `<option value="${s.id}" ${s.id === c.sensor ? 'selected' : ''}>${s.ad}</option>`).join('')}</select></div>
      <div class="satir"><span>Megapiksel</span><input data-k="mp" type="number" min="1" max="200" inputmode="numeric" class="sayi-kutu" value="${c.mp}"></div>
      <div class="satir"><span>Odak uzaklığı (mm)</span><input data-k="odak" type="number" min="1" max="1200" step="1" inputmode="decimal" class="sayi-kutu" value="${c.odak}"></div>
      <div class="satir"><span>Diyafram (f/)</span><input data-k="diyafram" type="number" min="0.7" max="64" step="0.1" inputmode="decimal" class="sayi-kutu" value="${c.diyafram}"></div>`;
    el.querySelectorAll('[data-k]').forEach(g => g.addEventListener('change', () => {
      const ad = g.dataset.k;
      if (ad === 'sensor') { c.sensor = g.value; c.mp = Kamera.sensor(g.value).mp; }
      else { const v = parseFloat(String(g.value).replace(',', '.')); if (v > 0) c[ad] = v; }
      kaydet();
      ['kameraAyar1', 'kameraAyar2'].forEach(id => kameraAyarCiz($(id)));
      geceCiz(); kameraCiz();
    }));
  }
  const kutu = (et, de) => `<div class="kutu"><div class="et">${et}</div><div class="de">${de}</div></div>`;
  const sayi = (x, b) => x.toFixed(b).replace('.', ',');
  function pozCiz() {
    const c = durum.kamera, s = Kamera.sensor(c.sensor);
    $('pozIzgara').innerHTML = [
      kutu('NPF kuralı', `${Kamera.sureYaz(Kamera.npf(c.odak, c.diyafram, s, c.mp))}`),
      kutu('500 kuralı', `${Kamera.sureYaz(Kamera.kural500(c.odak, s))}`),
      kutu('Kırpma faktörü', `${sayi(Kamera.kirpma(s), 2)}×`),
      kutu('Piksel aralığı', `${sayi(Kamera.pikselAraligi(s, c.mp), 1)} <small>µm</small>`)
    ].join('');
  }
  const ENSTANTANELER = [1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 15, 30];
  const NDLER = [[2, 'ND2 (1 durak)'], [4, 'ND4 (2 durak)'], [8, 'ND8 (3 durak)'], [16, 'ND16 (4 durak)'], [32, 'ND32 (5 durak)'], [64, 'ND64 (6 durak)'], [1000, 'ND1000 (10 durak)'], [32768, 'ND32K (15 durak)'], [65536, 'ND64K (16 durak)']];
  const metre = m => !isFinite(m) ? '∞' : m < 1 ? Math.round(m * 100) + ' cm' : sayi(m, m < 10 ? 2 : 1) + ' m';
  function kameraCiz() {
    if (!aktifMi('kamera')) return;
    const c = durum.kamera, s = Kamera.sensor(c.sensor);
    const mesafeM = parseFloat(String($('dofMesafe').value).replace(',', '.')) || 5;
    const ad = Kamera.alanDerinligi(c.odak, c.diyafram, mesafeM, s);
    $('dofIzgara').innerHTML = [
      kutu('Net başlangıcı', metre(ad.yakin)), kutu('Net bitişi', metre(ad.uzak)),
      kutu('Toplam netlik', metre(ad.toplam)), kutu('Hiperfokal mesafe', metre(ad.hiperfokal))
    ].join('');
    const normal = ENSTANTANELER[+$('ndNormal').value], katsayi = NDLER[+$('ndFiltre').value][0];
    const durak = Kamera.ndDurak(katsayi);
    $('ndIzgara').innerHTML = [kutu('Filtreyle enstantane', Kamera.sureYaz(Kamera.ndSure(normal, durak))), kutu('Işık kaybı', `${sayi(durak, 1)} <small>durak</small>`)].join('');
    const tl = Kamera.timelapse((parseFloat($('tlSure').value) || 0) * 60, parseFloat(String($('tlAralik').value).replace(',', '.')) || 1, +$('tlFps').value);
    $('tlIzgara').innerHTML = [kutu('Kare sayısı', tl.kare), kutu('Video süresi', Kamera.sureYaz(tl.videoSn))].join('');
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
    const sekme = ad === 'kamera' ? 'diger' : ad;
    document.querySelectorAll('.sekmeler button').forEach(b => b.classList.toggle('aktif', b.dataset.sayfa === sekme));
    $('panel').classList.toggle('gizli', ad === 'diger' || ad === 'kamera');
    panelYuksekligi();
    if (ad === 'harita') setTimeout(Harita.yenile, 0);
    if (ad === 'drone') { havaYukle(); digerVeriYukle(); droneCiz(); }
    if (ad === 'gece') { sonGeceAnahtar = ''; geceCiz(); }
    if (ad === 'kamera') kameraCiz();
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
    AR.kur(() => durum.ar, arVeri, kaydet);
    $('arAcBtn').addEventListener('click', arAc);
    $('arAcSatir').addEventListener('click', arAc);
    $('arKapat').addEventListener('click', () => AR.kapat());
    $('arSaat').addEventListener('input', e => { dakika = +e.target.value; anlikGuncelle(); });
    $('arGunesHizala').addEventListener('click', () => arHizala(Astro.gunesKonum, 'Güneş'));
    $('arAyHizala').addEventListener('click', () => arHizala(Astro.ayKonum, 'Ay'));
    $('arSifirla').addEventListener('click', () => { durum.ar.duzeltme = 0; kaydet(); AR.cizIste(); });
    const fov = d => { durum.ar.gorus = Math.max(20, Math.min(120, durum.ar.gorus + d)); $('arFov').textContent = durum.ar.gorus + '°'; kaydet(); AR.cizIste(); };
    $('arFovEksi').addEventListener('click', () => fov(-1));
    $('arFovArti').addEventListener('click', () => fov(1));
    kameraAyarCiz($('kameraAyar1')); kameraAyarCiz($('kameraAyar2'));
    $('ndNormal').innerHTML = ENSTANTANELER.map((s, i) => `<option value="${i}" ${i === 6 ? 'selected' : ''}>${Kamera.sureYaz(s)}</option>`).join('');
    $('ndFiltre').innerHTML = NDLER.map((n, i) => `<option value="${i}" ${i === 6 ? 'selected' : ''}>${n[1]}</option>`).join('');
    ['dofMesafe', 'ndNormal', 'ndFiltre', 'tlSure', 'tlAralik', 'tlFps'].forEach(id => $(id).addEventListener('input', kameraCiz));
    document.querySelectorAll('[data-git]').forEach(b => b.addEventListener('click', () => sayfaAc(b.dataset.git)));
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
    if (['harita', 'saatler', 'gece', 'drone', 'diger', 'kamera'].includes(h)) sayfaAc(h);

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
