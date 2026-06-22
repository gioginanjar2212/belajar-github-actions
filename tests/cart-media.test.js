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

function seedCartDb() {
  resetDb({
    users: [
      { id: 'user_seller_1', name: 'Seller', email: 'seller@example.com', password: 'seller123', role: 'seller', sellerId: 'seller_1', active: true },
      { id: 'user_customer_1', name: 'Customer', email: 'customer@example.com', password: 'customer123', role: 'customer', sellerId: null, active: true }
    ],
    sellers: [{ id: 'seller_1', name: 'Seller 1', ownerName: 'Owner', email: 'seller@example.com', status: 'approved', originCity: 'Bandung', codEnabled: true, pixelSettings: {} }],
    customers: [],
    addresses: [{ id: 'addr_1', userId: 'user_customer_1', label: 'Utama', receiverName: 'Customer', contactPhone: 'demo-contact', city: 'Jakarta', detail: 'Alamat demo', isDefault: true }],
    carts: [],
    products: [{
      id: 'prod_1',
      sellerId: 'seller_1',
      name: 'Produk Media',
      category: 'Fashion',
      price: 100000,
      stock: 5,
      weightGram: 250,
      active: true,
      images: [],
      variants: [{ id: 'var_1', name: 'Ukuran', value: 'L', priceDelta: 10000, stock: 3, weightGram: 270 }]
    }],
    orders: [],
    paymentEvents: [],
    chats: [],
    pixelEvents: []
  });
}

test('seller bisa menambahkan gambar produk dan product detail menampilkan gambar', async () => {
  seedCartDb();

  const sellerLogin = await request('POST', '/api/auth/login', { email: 'seller@example.com', password: 'seller123' });
  const imageRes = await request('POST', '/api/seller/products/prod_1/images', {
    url: 'https://example.test/product.png',
    alt: 'Produk Media',
    isPrimary: true
  }, sellerLogin.data.token);

  assert.equal(imageRes.status, 201);
  assert.equal(imageRes.data.image.isPrimary, true);

  const detailRes = await request('GET', '/api/products/prod_1');
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.data.product.images.length, 1);
});

test('customer bisa add update delete item cart', async () => {
  seedCartDb();

  const customerLogin = await request('POST', '/api/auth/login', { email: 'customer@example.com', password: 'customer123' });
  const addRes = await request('POST', '/api/customer/cart/items', {
    productId: 'prod_1',
    variantId: 'var_1',
    qty: 1
  }, customerLogin.data.token);

  assert.equal(addRes.status, 201);
  assert.equal(addRes.data.cart.totalQty, 1);
  assert.equal(addRes.data.cart.subtotal, 110000);

  const cartItemId = addRes.data.cart.items[0].id;
  const updateRes = await request('PATCH', `/api/customer/cart/items/${cartItemId}`, { qty: 2 }, customerLogin.data.token);

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.cart.totalQty, 2);
  assert.equal(updateRes.data.cart.subtotal, 220000);

  const deleteRes = await request('DELETE', `/api/customer/cart/items/${cartItemId}`, null, customerLogin.data.token);
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteRes.data.cart.totalQty, 0);
});

test('customer bisa checkout dari cart menjadi order', async () => {
  seedCartDb();

  const customerLogin = await request('POST', '/api/auth/login', { email: 'customer@example.com', password: 'customer123' });
  await request('POST', '/api/customer/cart/items', {
    productId: 'prod_1',
    variantId: 'var_1',
    qty: 1
  }, customerLogin.data.token);

  const checkoutRes = await request('POST', '/api/customer/cart/checkout', {
    addressId: 'addr_1',
    paymentMethod: 'VA'
  }, customerLogin.data.token);

  assert.equal(checkoutRes.status, 201);
  assert.equal(checkoutRes.data.order.source, 'cart');
  assert.equal(checkoutRes.data.order.customerId, 'user_customer_1');
  assert.equal(checkoutRes.data.order.items[0].variant, 'Ukuran: L');
  assert.ok(checkoutRes.data.order.payment.paymentCode);

  const cartRes = await request('GET', '/api/customer/cart', null, customerLogin.data.token);
  assert.equal(cartRes.status, 200);
  assert.equal(cartRes.data.cart.totalQty, 0);
});
