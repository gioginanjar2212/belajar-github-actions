# Sprint 3 — Varian Produk, Alamat Customer, Payment Event, dan Order Lifecycle

## Tujuan

Membuat marketplace foundation mulai mendekati alur transaksi nyata.

Sprint sebelumnya sudah punya:

- Customer register/login
- Seller register/login
- Admin approve seller
- Seller dashboard
- Product create
- Checkout simulasi

Sprint 3 menambahkan lapisan transaksi:

- Varian produk
- Alamat customer
- Checkout memakai address book
- Payment event simulasi
- Seller update status order
- Tracking order customer
- Status log order

## Alur Setelah Sprint 3

```text
Customer login
↓
Customer simpan alamat
↓
Customer checkout produk + varian
↓
Order status waiting_payment
↓
Payment event masuk
↓
Order status paid
↓
Seller update processing
↓
Seller update shipped
↓
Customer melihat tracking order
```

## Modul yang Ditambahkan

- `addresses` di JSON store
- `paymentEvents` di JSON store
- product `variants`
- endpoint customer address
- endpoint order detail customer
- endpoint payment event simulasi
- endpoint seller update order status
- order status logs
- checkout dengan `addressId` dan `variantId`

## Catatan Production

Payment event pada sprint ini masih simulasi. Untuk production perlu:

- signature verification dari payment gateway
- idempotency key
- retry handling
- audit log immutable
- database transaction
- real shipment creation setelah payment valid
- status transition policy yang lebih ketat
