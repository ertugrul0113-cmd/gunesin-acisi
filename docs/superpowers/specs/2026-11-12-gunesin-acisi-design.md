# Güneşin Açısı — Tasarım (2026-11-12)

## Amaç
iPhone'da web üzerinden çalışan (PWA), kişisel kullanım için fotoğraf ve drone çekim planlama uygulaması.
PhotoPills'in yaptığı işleri yapar; kodu, tasarımı, ismi ve metinleri tamamen bize aittir.
Kullanıcı: tek kişi (uygulama sahibi), DJI Avata 360 drone kullanıyor. Hesap/giriş yok.

## Kullanıcının söyledikleri
- Tüm özellikler olsun, ama sırayla yapılsın.
- Drone için: uçuş havası, çekim planı, havalimanı uyarısı.
- Çekim yerlerinde genelde internet var. İnternetsiz kayıt şimdilik yok.
- İsim: "Güneşin Açısı". Ekranlar Türkçe.

## Aşamalar (her aşama telefonda denenip onaylanınca sonrakine geçilir)
1. **Güneş ve Ay** — harita üzerinde konum (GPS veya haritaya dokunma), seçilen gün/saat için:
   güneş doğuş/batış saati ve yönü, o anki güneş yönü ve yüksekliği (açısı),
   altın saat (güneş yüksekliği -4° ile +6° arası), mavi saat (-6° ile -4° arası),
   sivil/denizci/astronomik alacakaranlık, ay doğuş/batış saati ve yönü, ay evresi ve aydınlanma yüzdesi.
   Saat kaydırıcı ile gün içinde ileri-geri; tarih seçici.
2. **Drone**
   - Uçuş havası: Open-Meteo'dan saatlik rüzgâr (10 m, 80 m, 120 m), ani rüzgâr, yağış olasılığı,
     görüş mesafesi, sıcaklık. Sonuç: "Uç / Dikkat / Uçma". Eşikler Ayarlar'dan değiştirilebilir
     Doğrulandı (DJI resmi teknik özellikler): Avata 360 en fazla rüzgâr 10,7 m/s (Seviye 5).
     Kurallar: uçuş yüksekliğinde rüzgâr ≥ sınır → Uçma, ≥ %70 → Dikkat; ani rüzgâr ≥ sınır → Uçma, ≥ %75 → Dikkat;
     yağış ≥ 0,3 mm, fırtına, kar, görüş < 1 km, sıcaklık -10…40 °C dışı, Kp ≥ 7 → Uçma;
     yağış olasılığı ≥ %40, görüş < 3 km, sıcaklık < 5 °C, Kp ≥ 5 → Dikkat.
     Uçuş yüksekliği seçilir (20/50/80/120 m); rüzgâr 10/80/120 m değerlerinden ara değerle bulunur.
     Kp (manyetik fırtına) NOAA SWPC'den alınır.
   - Çekim planı: haritada drone konumu; oradan güneşin/ayın yönü ve yüksekliği, seçilen saatte.
   - Havalimanı uyarısı: herkese açık OurAirports listesinden Türkiye havalimanları uygulamaya gömülür;
     en yakın havalimanları ve uzaklıkları gösterilir. Uyarı yarıçapı Ayarlar'dan değiştirilebilir.
     Ekranda açık not: "Kesin yasak bölge bilgisi değildir; DJI Fly ve SHGM kurallarını kontrol edin."
3. **Gece** — Samanyolu merkezinin (galaktik merkez) seçilen gece görünür olduğu saatler ve yönü
   (şart: güneş -18° altında, galaktik merkez ufkun üstünde; ayın durumu ayrıca gösterilir).
   Yıldız izi olmadan en uzun pozlama: 500 kuralı ve NPF kuralı, kamera bilgilerine göre.
4. **Kamera hesapları** — alan derinliği, hiperfokal mesafe, ND filtre pozlama süresi, timelapse
   (çekim süresi, aralık, kare sayısı, video süresi). Kamera bilgileri (sensör boyu, piksel aralığı)
   kullanıcı tarafından kaydedilir; Avata 360 kamerası için bir hazır ayar eklenir (değerler doğrulanarak).
5. **Kamera ekranı (AR)** — iPhone kamerası + pusula/eğim sensörü ile güneş ve ayın gün içi yolu
   görüntünün üstüne çizilir. iOS izin ister; pusula hassasiyeti sınırlıdır, ekranda belirtilir.

## Durum (2026-11-12)
- 0.2: aşama 1 + 2. 0.3: aşama 3 (Gece sekmesi, 30 gecelik Samanyolu takvimi) + aşama 4 (Diğer > Kamera hesapları).
- 0.4: aşama 5 (AR). Yön: DeviceOrientation dönüş matrisi; iPhone'da webkitCompassHeading ile kuzeye bağlanır.
  Pusula hatası için "Güneşe/Aya hizala" düzeltmesi ve görüş açısı ayarı (varsayılan 65°) var; telefonda denenmedi.

## Teknik yapı
- Düz HTML/JS, derleme yok (sipariş kontrol uygulamasıyla aynı yaklaşım).
- Dosyalar:
  - `index.html`, `style.css`
  - `app.js` — ekranlar ve gezinme; `SURUM` sabiti (her yayında artırılır, Ayarlar'da görünür)
  - `astro.js` — güneş/ay/galaktik merkez hesapları (Meeus / NOAA formülleri, kendi kodumuz).
    Tarayıcı ve Node'da çalışır, testlenebilir. Ekrana hiç dokunmaz.
  - `drone.js` — hava verisini alma ve "Uç/Dikkat/Uçma" kararı (karar kısmı Node'da testlenebilir)
  - `kamera.js` — kamera hesapları (saf fonksiyonlar, testlenebilir)
  - `harita.js` — Leaflet haritası ve çizgiler
  - `sw.js` — önce ağ, sonra önbellek (yeni sürüm telefona kendiliğinden gelir)
  - `manifest.webmanifest`, ikonlar
  - `vendor/leaflet/` — Leaflet 1.9.4 (yerel kopya)
  - `veri/havalimanlari-tr.json` — OurAirports'tan süzülmüş liste (aşama 2)
- Harita: OpenStreetMap karoları (internet gerekir).
- Hava: Open-Meteo forecast API (anahtar gerekmez).
- Ayarlar ve son konum: telefonun tarayıcı hafızasında (localStorage).
- Yayın: GitHub Pages, kullanıcının hesabında yeni bir depo (oluşturmadan önce kullanıcıya sorulur).

## Hata durumları
- Konum izni verilmezse: haritaya dokunarak konum seçilir, son konum hatırlanır.
- İnternet yoksa: harita/hava "İnternet yok" der; güneş/ay/kamera hesapları çalışmaya devam eder.
- Kutup bölgesi gibi güneşin doğmadığı/batmadığı günler: "Bugün güneş batmıyor/doğmuyor" yazılır.
- Hava servisi yanıt vermezse: son başarılı veri saatiyle birlikte gösterilir, yoksa hata mesajı.

## Test
- `test/` altında Node testleri (harici kütüphane yok, `node test/astro.test.js`):
  güneş doğuş/batış ve yönleri, NOAA hesaplayıcısının İstanbul ve birkaç başka şehir için verdiği
  değerlerle karşılaştırılır (hedef: güneş ±1 dk / ±0,5°, ay ±5 dk / ±1°).
- Kamera ve drone karar fonksiyonları için örnek değerli testler.
- Her aşama sonunda kullanıcı telefonda dener.

## Kapsam dışı (şimdilik)
- İnternetsiz harita/hava kaydı, hesap/giriş, paylaşım, plan kaydetme (istenirse sonra).
- Gerçek DJI yasak bölge verisi (herkese açık değil).
