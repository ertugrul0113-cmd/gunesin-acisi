// Güneşin Açısı — ekranlar
(function () {
  'use strict';
  const SURUM = '0.1';
  const $ = id => document.getElementById(id);
  const KAYIT = 'gunesinAcisi.v1';

  // ---- Durum ----
  const durum = Object.assign({
    konum: { enl: 41.0082, boy: 28.9784, ad: 'İstanbul' },
    haritaTuru: 'sokak'
  }, oku());
  let gun = Astro.gunBasi(new Date());     // seçili günün başı (ms)
  let dakika = simdikiDakika();             // 0..1439
  let gunVerisi = null;

  function oku() { try { return JSON.parse(localStorage.getItem(KAYIT)) || {}; } catch (e) { return {}; } }
  function kaydet() { try { localStorage.setItem(KAYIT, JSON.stringify({ konum: durum.konum, haritaTuru: durum.haritaTuru })); } catch (e) { } }
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
    adZamanlayici = setTimeout(() => yerAdiBul(enl, boy), 800);
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
  }
  function panelYuksekligi() { document.documentElement.style.setProperty('--panel-h', $('panel').offsetHeight + 'px'); }

  // ---- Başlat ----
  function baslat() {
    $('surum').textContent = SURUM;
    $('konumAd').textContent = '📍 ' + (durum.konum.ad || '');
    $('haritaTuru').value = durum.haritaTuru;
    Harita.kur('harita', durum.konum, (enl, boy) => konumDegisti(enl, boy, false));
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
    if (['harita', 'saatler', 'diger'].includes(h)) sayfaAc(h);

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  function gunKaydir(n) {
    const d = new Date(gun); d.setDate(d.getDate() + n); gun = +d;
    tarihYaz(); gunuHesapla(); anlikGuncelle();
  }

  baslat();
})();
