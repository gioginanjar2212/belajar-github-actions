# Ayo Ginanjar Affiliate MVP

Website MVP untuk personal brand, katalog produk digital affiliate, blog, admin CMS sederhana, feed katalog, dan tracking klik produk.

Project ini berada di folder `affiliate-mvp/` agar tidak menimpa project lama pada repository `belajar-github-actions`.

## Fitur Publik

- `/` Home
- `/tentang-saya` Tentang Saya
- `/produk` Katalog produk digital
- `/produk/:slug` Detail produk
- `/go/:slug` Tracking klik lalu redirect ke link partner
- `/blog` Daftar artikel
- `/blog/:slug` Detail artikel
- `/kontak` Kontak dan bantuan
- `/catalog-feed.xml` Feed katalog XML
- `/meta/catalog.csv` Feed katalog CSV

## Fitur Admin

- `/admin/login` Login admin demo
- `/admin/dashboard` Dashboard ringkas
- `/admin/products` Kelola status produk
- `/admin/product-categories` Kategori produk
- `/admin/blog-posts` Artikel blog
- `/admin/blog-categories` Kategori blog
- `/admin/homepage` Homepage settings
- `/admin/settings` SEO dan global settings
- `/admin/analytics/clicks` Tracking klik produk

## Cara Menjalankan

```bash
cd affiliate-mvp
npm install
npm run seed
npm start
```

Buka:

```text
http://localhost:3000
```

## Test

```bash
npm run ci
```

## Catatan Scope

- Tidak ada pembayaran internal.
- Link beli diarahkan melalui `/go/:slug` agar klik produk bisa dicatat dulu.
- Data disimpan di JSON lokal untuk MVP.
- Untuk production, naikkan ke database seperti SQLite atau PostgreSQL.
- Meta Pixel disiapkan sebagai placeholder melalui settings.
