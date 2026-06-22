# Sprint 2 — Auth, Seller Approval, dan Dashboard

## Tujuan

Menaikkan fondasi marketplace dari sekadar API produk/order menjadi sistem dengan peran pengguna yang jelas.

## Modul yang Ditambahkan

- Customer register
- Seller register
- Login sederhana berbasis Bearer token latihan
- Role customer, seller, admin
- Admin melihat daftar seller
- Admin approve seller
- Seller dashboard
- Produk hanya bisa dibuat oleh seller approved
- Order dashboard untuk seller
- Test otomatis untuk auth, approval, product ownership, dashboard, dan checkout

## Catatan Keamanan

Auth pada sprint ini masih untuk praktik GitHub Actions dan flow marketplace. Password masih plain text dan token masih token simulasi.

Sebelum production, modul ini harus diganti ke:

- password hashing
- session/JWT yang benar
- rate limit login
- validasi input lebih ketat
- database production
- audit log admin
- permission policy yang lebih rapi

## Alur Marketplace Setelah Sprint 2

```text
Seller daftar
↓
Status pending approval
↓
Admin login
↓
Admin approve seller
↓
Seller login
↓
Seller tambah produk
↓
Customer checkout
↓
Order muncul di dashboard seller
```

## Sprint 3 yang Disarankan

- Database PostgreSQL
- Product image upload
- Product variant
- Address book customer
- Order status lifecycle
- Payment gateway sandbox
- Shipping provider sandbox
