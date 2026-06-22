# UMKM Marketplace Foundation

Repository ini dipakai untuk praktik membangun sistem marketplace multi-vendor yang serius sambil belajar GitHub Actions.

Target produk:

- Seller/UMKM bisa daftar dan membuka toko.
- Seller bisa menambahkan produk.
- Customer bisa melihat produk dan membuat checkout simulasi.
- Sistem punya pondasi integrasi ongkir, payment gateway, COD, pixel ads, dan chat.
- GitHub Actions menjalankan pemeriksaan otomatis setiap ada perubahan.

## Jalankan Lokal

```bash
npm install
npm run seed
npm start
```

Buka:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

## Script Penting

```bash
npm test
npm run ci
```

## Status Sprint 1

Sprint 1 fokus ke fondasi:

- Express backend
- JSON storage untuk latihan awal
- API seller register
- API product listing/create
- API checkout simulasi
- API ongkir simulasi
- API payment simulasi
- tracking pixel event logger
- GitHub Actions CI

Catatan: ini belum production-ready, tetapi strukturnya diarahkan ke sistem nyata. Setelah CI hijau, fondasi ini bisa kita naikkan ke database PostgreSQL, auth yang aman, payment gateway sandbox, dan shipping provider API.