import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/server.js';
import { resetDb } from '../src/store.js';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
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

test('health endpoint aktif', async () => {
  const res = await request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'ok');
});

test('seller bisa register dan produk bisa dibuat', async () => {
  resetDb({ sellers: [], customers: [], products: [], orders: [], chats: [], pixelEvents: [] });

  const sellerRes = await request('POST', '/api/sellers/register', {
    name: 'Toko UMKM Demo',
    ownerName: 'Gio',
    email: 'umkm@example.com',
    originCity: 'Bandung'
  });

  assert.equal(sellerRes.status, 201);

  const productRes = await request('POST', '/api/products', {
    sellerId: sellerRes.data.seller.id,
    name: 'Produk Demo',
    category: 'Fashion',
    price: 50000,
    stock: 10,
    weightGram: 250
  });

  assert.equal(productRes.status, 201);
  assert.equal(productRes.data.product.name, 'Produk Demo');
});

test('checkout menghasilkan order, payment, dan shipment', async () => {
  resetDb({
    sellers: [{ id: 'seller_1', name: 'Seller 1', ownerName: 'Owner', email: 's@example.com', status: 'approved', originCity: 'Bandung', codEnabled: true, pixelSettings: {} }],
    customers: [],
    products: [{ id: 'prod_1', sellerId: 'seller_1', name: 'Produk 1', category: 'Fashion', price: 75000, stock: 5, weightGram: 250, active: true }],
    orders: [],
    chats: [],
    pixelEvents: []
  });

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
