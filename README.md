# UMKM Marketplace Foundation

Repository ini dipakai untuk praktik membangun sistem marketplace multi-vendor yang serius sambil belajar GitHub Actions.

Target produk:

- Seller/UMKM bisa daftar dan membuka toko.
- Admin bisa approve seller sebelum seller berjualan.
- Seller bisa login dan menambahkan produk serta gambar produk.
- Customer bisa melihat produk, memilih varian, menyimpan alamat, memasukkan item ke cart, dan checkout.
- Sistem punya pondasi integrasi ongkir, payment gateway, COD, pixel ads, chat, dan order lifecycle.
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

## Akun Demo

```text
Admin
email: admin@example.com
password: admin123

Seller
email: seller@example.com
password: seller123

Customer
email: customer@example.com
password: customer123
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

## Status Sprint 2

Sprint 2 fokus ke akun dan peran:

- Customer register
- Seller register
- Login sederhana
- Role customer, seller, admin
- Admin approve seller
- Seller dashboard
- Produk hanya bisa dibuat seller approved
- Order seller dashboard

## Status Sprint 3

Sprint 3 fokus ke transaksi:

- Varian produk
- Address book customer
- Checkout memakai addressId dan variantId
- Payment event simulasi
- Order status logs
- Seller update order status
- Customer order tracking

## Status Sprint 4

Sprint 4 fokus ke pengalaman belanja:

- Product detail endpoint
- Seller product image/media management
- Customer cart aktif
- Add/update/delete item cart
- Checkout dari cart menjadi order

Catatan: ini belum production-ready, tetapi strukturnya diarahkan ke sistem nyata. Setelah CI hijau, fondasi ini bisa dinaikkan ke PostgreSQL, auth aman, upload file asli, payment gateway sandbox, dan shipping provider API.