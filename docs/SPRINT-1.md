# Sprint 1 — Marketplace Foundation

## Tujuan

Membuat fondasi awal marketplace multi-vendor untuk UMKM, bukan demo toko kecil.

## Modul yang Sudah Dimulai

- Seller registration
- Product management API
- Product listing API
- Shipping rate simulation
- Payment intent simulation
- Checkout order creation
- Shipment/AWB simulation
- Pixel event server-side logger
- Chat message API
- Automated tests
- GitHub Actions CI

## Batasan Sprint 1

Fondasi ini belum memakai database production, belum memakai auth final, dan belum terhubung ke payment/shipping provider live.

Batasan ini disengaja supaya GitHub Actions dapat dipahami melalui sistem nyata sebelum kita naik ke integrasi pihak ketiga.

## Sprint 2 yang Disarankan

- Ganti JSON storage ke PostgreSQL
- Tambah auth customer/seller/admin
- Tambah role permission
- Tambah seller approval admin
- Tambah upload gambar produk
- Tambah status order lifecycle
- Tambah sandbox payment gateway
- Tambah sandbox shipping provider

## Sprint 3 yang Disarankan

- Resi otomatis
- Tracking webhook
- Pixel ads dashboard
- Meta/TikTok/Google event mapping
- Chat dashboard
- Voucher seller/platform
