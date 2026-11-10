# Catatan proyek — video affiliate klip kabel (CHARACTER FLOW + insert produk 3D)

- Story: `stories/klip-kabel/story.json` (kit CHARACTER FLOW, kamar tidur malam → pagi). Kata-kata VO:
  `stories/klip-kabel/words.json` (whisper.cpp medium, disejajarkan ke naskah; cocok dengan jeda di VO).
- Insert produk (bukan bagian kit): `src/affiliate/` — `clip.ts` (model klip 5 slot), `world.tsx` (meja, kabel,
  HP, colokan, kursi), `shots.ts` (11 insert, fungsi murni dari waktu film), `Insert.tsx` (lampu, label ✓/✗,
  caption), `KlipFilm.tsx` (komposisi `klip-kabel-ov-preview` / `klip-kabel-ov-final`).
- Ujung setiap insert harus jatuh tepat di potongan shot karakter berikutnya (beat), kalau tidak muncul kedipan
  shot < 0,1 s. `node scripts/prep.mjs stories/klip-kabel/story.json --no-sound` mencetak edit gabungan.
- Suara: `sound-story.ts` (kit) → `product-sfx.ts` (foley produk) → `public/audio/klip-kabel-final-mix.wav`.
  Target saat VO bicara: bed ≥ 17 dB di bawah suara, SFX produk ≥ 14 dB di bawah suara.
- Render hanya lewat GitHub Actions (repo privat): workflow "Render video", mode `stills` / `audio` / `final`.
  Runner tanpa GPU → GL=swangle; final dibagi ke beberapa job paralel (`parts`).
- Bentuk produk: halaman Shopee tidak bisa dibuka otomatis; model dibuat dari deskripsi naskah (klip perekat
  silikon, slot berbeda ukuran). Sesuaikan `clip.ts` kalau ada foto produk.
