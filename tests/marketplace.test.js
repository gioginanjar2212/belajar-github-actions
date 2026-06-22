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
    addresses: [],
    products: [{
      id: 'prod_1',
      sellerId: 'seller_1',
      name: 'Produk 1',
      category: 'Fashion',
      price: 75000,
      stock: 5,
      weightGram: 250,
      active: true,
      variants: [{ id: 'var_1', name: 'Ukuran', value: 'L', priceDelta: 5000, stock: 3, weightGram: 270 }]
    }],
    orders: [],
    paymentEvents: [],
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
  resetDb({ users: [], sellers: [], customers: [], addresses: [], products: [], orders: [], paymentEvents: [], chats: [], pixelEvents: [] });

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
  resetDb({ users: [{ id: 'user_admin_1', name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin', sellerId: null, active: true }], sellers: [], customers: [], addresses: [], products: [], orders: [], paymentEvents: [], chats: [], pixelEvents: [] });

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

test('produk hanya bisa dibuat oleh seller approved dan dapat punya varian', async () => {
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
    weightGram: 250,
    variants: [{ name: 'Ukuran', value: 'XL', priceDelta: 10000, stock: 4, weightGram: 290 }]
  }, loginRes.data.token);

  assert.equal(productRes.status, 201);
  assert.equal(productRes.data.product.sellerId, 'seller_1');
  assert.equal(productRes.data.product.variants.length, 1);
});

test('customer bisa simpan alamat dan checkout pakai addressId plus varian', async () => {
  seedAuthDb();

  const loginRes = await request('POST', '/api/auth/login', { email: 'customer@example.com', password: 'customer123' });
  const addressRes = await request('POST', '/api/customer/addresses', {
    label: 'Alamat Utama',
    receiverName: 'Customer Demo',
    contactPhone: '080000000000',
    city: 'Jakarta',
    detail: 'Alamat demo'
  }, loginRes.data.token);

  assert.equal(addressRes.status, 201);

  const checkoutRes = await request('POST', '/api/checkout', {
    addressId: addressRes.data.address.id,
    paymentMethod: 'VA',
    items: [{ productId: 'prod_1', variantId: 'var_1', qty: 1 }]
  }, loginRes.data.token);

  assert.equal(checkoutRes.status, 201);
  assert.equal(checkoutRes.data.order.customerId, 'user_customer_1');
  assert.equal(checkoutRes.data.order.items[0].variant, 'Ukuran: L');
  assert.equal(checkoutRes.data.order.items[0].price, 80000);
});

test('payment event dan seller status update membentuk status log', async () => {
  seedAuthDb();

  const checkoutRes = await request('POST', '/api/checkout', {
    customerName: 'Customer Demo',
    customerPhone: '080000000000',
    destinationCity: 'Jakarta',
    paymentMethod: 'VA',
    items: [{ productId: 'prod_1', variantId: 'var_1', qty: 1 }]
  });

  const orderId = checkoutRes.data.order.id;

  const paidRes = await request('POST', '/api/payments/events', {
    orderId,
    status: 'paid',
    providerReference: 'PAYMENT-SIM-1'
  });

  assert.equal(paidRes.status, 201);
  assert.equal(paidRes.data.order.status, 'paid');

  const sellerLogin = await request('POST', '/api/auth/login', { email: 'seller@example.com', password: 'seller123' });
  const shippedRes = await request('PATCH', `/api/seller/orders/${orderId}/status`, {
    status: 'shipped',
    note: 'Paket diserahkan ke kurir'
  }, sellerLogin.data.token);

  assert.equal(shippedRes.status, 200);
  assert.equal(shippedRes.data.order.status, 'shipped');
  assert.equal(shippedRes.data.order.shipment.status, 'in_transit');
  assert.ok(shippedRes.data.order.statusLogs.length >= 3);
});

test('dashboard seller menampilkan produk dan order seller', async () => {
  seedAuthDb();

  await request('POST', '/api/checkout', {
    customerName: 'Customer Demo',
    customerPhone: '080000000000',
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
    customerPhone: '080000000000',
    destinationCity: 'Jakarta',
    paymentMethod: 'VA',
    items: [{ productId: 'prod_1', qty: 1 }]
  });

  assert.equal(res.status, 201);
  assert.equal(res.data.order.status, 'waiting_payment');
  assert.ok(res.data.order.payment.paymentCode);
  assert.ok(res.data.order.shipment.awb);
});
