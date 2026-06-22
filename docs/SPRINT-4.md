# Sprint 4 — Product Media dan Customer Cart

## Tujuan

Membuat marketplace foundation semakin terasa seperti toko online publik.

Sprint sebelumnya sudah punya:

- Customer, seller, admin auth
- Seller approval
- Product variants
- Address book customer
- Checkout langsung
- Payment event simulasi
- Order status lifecycle

Sprint 4 menambahkan lapisan belanja yang lebih natural:

- Product detail endpoint
- Product image/media management oleh seller
- Customer cart aktif
- Add item ke cart
- Update qty item cart
- Delete item cart
- Checkout dari cart menjadi order

## Alur Setelah Sprint 4

```text
Seller login
↓
Seller tambah gambar produk
↓
Customer login
↓
Customer lihat detail produk
↓
Customer masukkan produk/varian ke cart
↓
Customer update qty / hapus item
↓
Customer checkout cart
↓
Order dibuat dari cart
```

## Endpoint Baru

```text
GET    /api/products/:productId
POST   /api/seller/products/:productId/images
GET    /api/customer/cart
POST   /api/customer/cart/items
PATCH  /api/customer/cart/items/:cartItemId
DELETE /api/customer/cart/items/:cartItemId
POST   /api/customer/cart/checkout
```

## Catatan Production

Product media pada sprint ini masih memakai URL gambar. Untuk production perlu:

- Upload file asli
- Validasi mime type
- Validasi ukuran file
- Object storage
- Thumbnail generation
- Moderasi media
- CDN

Cart pada sprint ini hanya mendukung checkout satu seller. Untuk marketplace production, cart multi-seller perlu dipecah menjadi beberapa order per seller.
