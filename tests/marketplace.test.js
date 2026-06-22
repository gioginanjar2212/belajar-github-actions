import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/server.js';
import { resetDb } from '../src/store.js';

function request(method, path, body, token = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        server.close(() => resolve({ status: response.status, data }));
      } catch (error) {
        server.close(() => reject(error));
      }
    });
  });
}

function seedAuthDb() {
  resetDb({
    users: [
      { id: 'user_admin_1', name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin', sellerId: null, active: true },
      { id: 'user_seller_1', name: 'Seller', email: 'seller@example.com', password: 'seller123', role: 'seller', sellerId: 'seller_1', active: true },
      { id: 'user_customer_1', name: 'Customer', email: 'customer@example.com', password: 'customer123', role: 'customer', sellerId: null, active: true }
    ],
    sellers: [{ id: 'seller_1', name: 'Seller 1', ownerName: 'Owner', email: 'seller@example.com', status: 'approved', originCity: 'Bandung', codEnabled: true, pixelSettings: {} }],
    customers: [],
    products: [{ id: 'prod_1', sellerId: 'seller_1', name: 'Produk 1', category: 'Fashion', price: 75000, stock: 5, weightGram: 250, active: true }],
    orders: [],
    chats: [],
    pixelEvents: []
  });
}

test('health endpoint aktif', async () => {
  const res = await request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
});

test('customer bisa register dan login', async () => {
  resetDb({ users: [], sellers: [], customers: [], products: [], orders: [], chats: [], pixelEvents: [] });

  const registerRes = await request('POST', '/api/auth/register/customer', {
    name: 'Customer Baru',
    email: 'baru@example.com',
    password: 'rahasia123'
  });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.data.user.role, 'customer');
  assert.equal(registerRes.data.user.password, undefined);

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'baru@example.com',
    password: 'rahasia123'
  });

  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.data.token);
});

test('seller register masuk status pending lalu admin bisa approve', async () => {
  resetDb({ users: [{ id: 'user_admin_1', name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin', sellerId: null, active: true }], sellers: [], customers: [], products: [], orders: [], chats: [], pixelEvents: [] });

  const sellerRes = await request('POST', '/api/auth/register/seller', {
    storeName: 'Toko UMKM Demo',
    ownerName: 'Gio',
    email: 'umkm@example.com',
    password: 'seller123',
    originCity: 'Bandung'
  });

  assert.equal(sellerRes.status, 201);
  assert.equal(sellerRes.data.seller.status, 'pending_approval');
  assert.equal(sellerRes.data.user.role, 'seller');

  const adminLogin = await request('POST', '/api/auth/login', { email: 'admin@example.com', password: 'admin123' });
  const approveRes = await request('PATCH', `/api/admin/sellers/${sellerRes.data.seller.id}/approve`, { codEnabled: true }, adminLogin.data.token);

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.seller.status, 'approved');
  assert.equal(approveRes.data.seller.codEnabled, true);
});

test('produk hanya bisa dibuat oleh seller approved', async () => {
  seedAuthDb();

  const loginRes = await request('POST', '/api/auth/login', {
    email: 'seller@example.com',
    password: 'seller123'
  });

  const productRes = await request('POST', '/api/products', {
    name: 'Produk Demo',
    category: 'Fashion',
    price: 50000,
    stock: 10,
    weightGram: 250
  }, loginRes.data.token);

  assert.equal(productRes.status, 201);
  assert.equal(productRes.data.product.sellerId, 'seller_1');
  assert.equal(productRes.data.product.name, 'Produk Demo');
});

test('dashboard seller menampilkan produk dan order seller', async () => {
  seedAuthDb();

  await request('POST', '/api/checkout', {
    customerName: 'Customer Demo',
    customerPhone: '081234567890',
    destinationCity: 'Jakarta',
    paymentMethod: 'VA',
    items: [{ productId: 'prod_1', qty: 1 }]
  });

  const loginRes = await request('POST', '/api/auth/login', { email: 'seller@example.com', password: 'seller123' });
  const dashboardRes = await request('GET', '/api/seller/dashboard', null, loginRes.data.token);

  assert.equal(dashboardRes.status, 200);
  assert.equal(dashboardRes.data.products.length, 1);
  assert.equal(dashboardRes.data.orders.length, 1);
});

test('checkout menghasilkan order, payment, dan shipment', async () => {
  seedAuthDb();

  const res = await request('POST', '/api/checkout', {
    customerName: 'Customer Demo',
    customerPhone: '081234567890',
    destinationCity: 'Jakarta',
    paymentMethod: 'VA',
    items: [{ productId: 'prod_1', qty: 1 }]
  });

  assert.equal(res.status, 201);
  assert.equal(res.data.order.status, 'waiting_payment');
  assert.ok(res.data.order.payment.paymentCode);
  assert.ok(res.data.order.shipment.awb);
});
