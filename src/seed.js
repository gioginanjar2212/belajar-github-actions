import { resetDb } from './store.js';

resetDb({
  users: [
    {
      id: 'user_admin_1',
      name: 'Admin Marketplace',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
      sellerId: null,
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'user_seller_1',
      name: 'Demo Seller',
      email: 'seller@example.com',
      password: 'seller123',
      role: 'seller',
      sellerId: 'seller_demo_1',
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'user_customer_1',
      name: 'Customer Demo',
      email: 'customer@example.com',
      password: 'customer123',
      role: 'customer',
      sellerId: null,
      active: true,
      createdAt: new Date().toISOString()
    }
  ],
  sellers: [
    {
      id: 'seller_demo_1',
      name: 'Toko Kaos Bandung',
      ownerName: 'Demo Seller',
      email: 'seller@example.com',
      status: 'approved',
      originCity: 'Bandung',
      codEnabled: true,
      pixelSettings: {
        metaPixelId: '',
        tiktokPixelId: '',
        googleTagId: ''
      }
    }
  ],
  customers: [],
  products: [
    {
      id: 'prod_kaos_oversize',
      sellerId: 'seller_demo_1',
      name: 'Kaos Oversize Hitam',
      category: 'Fashion',
      price: 75000,
      stock: 20,
      weightGram: 250,
      active: true
    },
    {
      id: 'prod_totebag_canvas',
      sellerId: 'seller_demo_1',
      name: 'Totebag Canvas',
      category: 'Tas',
      price: 55000,
      stock: 15,
      weightGram: 300,
      active: true
    }
  ],
  orders: [],
  chats: [],
  pixelEvents: []
});

console.log('Seed selesai: data marketplace demo dibuat.');
