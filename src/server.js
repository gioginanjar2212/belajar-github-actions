import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ensureDb, readDb, writeDb } from './store.js';
import { calculateShippingRate, createShipment } from './services/shipping.js';
import { createPaymentIntent } from './services/payment.js';
import { recordPixelEvent } from './services/pixels.js';
import { createUser, loginUser, requireRole, safeUser } from './auth.js';

ensureDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'umkm-marketplace-foundation' });
});

app.post('/api/auth/register/customer', (req, res) => {
  try {
    const user = createUser({ ...req.body, role: 'customer' });
    res.status(201).json({ user });
  } catch (error) {
    res.status(422).json({ message: error.message });
  }
});

app.post('/api/auth/register/seller', (req, res) => {
  const { storeName, ownerName, email, password, originCity } = req.body;

  if (!storeName || !ownerName || !email || !password || !originCity) {
    return res.status(422).json({ message: 'storeName, ownerName, email, password, dan originCity wajib diisi' });
  }

  const db = readDb();
  const normalizedEmail = email.toLowerCase().trim();
  const existingSeller = db.sellers.find((seller) => seller.email === normalizedEmail);

  if (existingSeller) {
    return res.status(422).json({ message: 'seller email sudah terdaftar' });
  }

  const seller = {
    id: `seller_${nanoid(10)}`,
    name: storeName,
    ownerName,
    email: normalizedEmail,
    originCity,
    status: 'pending_approval',
    codEnabled: false,
    pixelSettings: {
      metaPixelId: '',
      tiktokPixelId: '',
      googleTagId: ''
    },
    createdAt: new Date().toISOString()
  };

  db.sellers.push(seller);
  writeDb(db);

  try {
    const user = createUser({ name: ownerName, email: normalizedEmail, password, role: 'seller', sellerId: seller.id });
    res.status(201).json({ seller, user });
  } catch (error) {
    const rollbackDb = readDb();
    rollbackDb.sellers = rollbackDb.sellers.filter((item) => item.id !== seller.id);
    writeDb(rollbackDb);
    res.status(422).json({ message: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const session = loginUser(req.body);
    res.json(session);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
});

app.get('/api/me', (req, res) => {
  const user = requireRole(req, res, ['customer', 'seller', 'admin']);
  if (!user) return;

  res.json({ user: safeUser(user) });
});

app.post('/api/sellers/register', (req, res) => {
  req.body.storeName = req.body.storeName || req.body.name;
  return app._router.handle(req, res, () => {}, '/api/auth/register/seller');
});

app.get('/api/sellers', (req, res) => {
  const db = readDb();
  const publicSellers = db.sellers.filter((seller) => seller.status === 'approved');
  res.json({ sellers: publicSellers });
});

app.get('/api/admin/sellers', (req, res) => {
  const admin = requireRole(req, res, 'admin');
  if (!admin) return;

  const db = readDb();
  res.json({ sellers: db.sellers });
});

app.patch('/api/admin/sellers/:sellerId/approve', (req, res) => {
  const admin = requireRole(req, res, 'admin');
  if (!admin) return;

  const db = readDb();
  const seller = db.sellers.find((item) => item.id === req.params.sellerId);

  if (!seller) {
    return res.status(404).json({ message: 'Seller tidak ditemukan' });
  }

  seller.status = 'approved';
  seller.codEnabled = Boolean(req.body.codEnabled ?? seller.codEnabled);
  seller.approvedAt = new Date().toISOString();
  seller.approvedBy = admin.id;
  writeDb(db);

  res.json({ seller });
});

app.get('/api/seller/dashboard', (req, res) => {
  const user = requireRole(req, res, 'seller');
  if (!user) return;

  const db = readDb();
  const seller = db.sellers.find((item) => item.id === user.sellerId);

  if (!seller) {
    return res.status(404).json({ message: 'Seller tidak ditemukan' });
  }

  const products = db.products.filter((product) => product.sellerId === seller.id);
  const orders = db.orders.filter((order) => order.sellerId === seller.id);

  res.json({ seller, products, orders });
});

app.get('/api/products', (req, res) => {
  const db = readDb();
  const activeProducts = db.products.filter((product) => product.active);
  res.json({ products: activeProducts });
});

app.post('/api/products', (req, res) => {
  const user = requireRole(req, res, 'seller');
  if (!user) return;

  const { name, category, price, stock, weightGram } = req.body;

  if (!name || !category || !price || stock === undefined || !weightGram) {
    return res.status(422).json({ message: 'name, category, price, stock, dan weightGram wajib diisi' });
  }

  const db = readDb();
  const seller = db.sellers.find((item) => item.id === user.sellerId);

  if (!seller) {
    return res.status(404).json({ message: 'Seller tidak ditemukan' });
  }

  if (seller.status !== 'approved') {
    return res.status(403).json({ message: 'Seller belum disetujui admin' });
  }

  const product = {
    id: `prod_${nanoid(10)}`,
    sellerId: seller.id,
    name,
    category,
    price: Number(price),
    stock: Number(stock),
    weightGram: Number(weightGram),
    active: true,
    createdAt: new Date().toISOString()
  };

  db.products.push(product);
  writeDb(db);

  res.status(201).json({ product });
});

app.post('/api/shipping/rates', (req, res) => {
  try {
    const rate = calculateShippingRate(req.body);
    res.json({ rate });
  } catch (error) {
    res.status(422).json({ message: error.message });
  }
});

app.post('/api/checkout', (req, res) => {
  const { customerName, customerPhone, destinationCity, paymentMethod = 'VA', items = [] } = req.body;

  if (!customerName || !customerPhone || !destinationCity || items.length === 0) {
    return res.status(422).json({ message: 'customerName, customerPhone, destinationCity, dan items wajib diisi' });
  }

  const db = readDb();
  const orderItems = [];
  let subtotal = 0;
  let totalWeightGram = 0;
  let sellerId = null;

  for (const item of items) {
    const product = db.products.find((productItem) => productItem.id === item.productId && productItem.active);

    if (!product) {
      return res.status(404).json({ message: `Produk ${item.productId} tidak ditemukan` });
    }

    const qty = Number(item.qty || 1);

    if (product.stock < qty) {
      return res.status(422).json({ message: `Stok ${product.name} tidak cukup` });
    }

    sellerId = product.sellerId;
    product.stock -= qty;
    subtotal += product.price * qty;
    totalWeightGram += product.weightGram * qty;
    orderItems.push({ productId: product.id, name: product.name, price: product.price, qty });
  }

  const seller = db.sellers.find((item) => item.id === sellerId);
  const cod = paymentMethod === 'COD';

  if (cod && !seller?.codEnabled) {
    return res.status(422).json({ message: 'COD belum aktif untuk seller ini' });
  }

  const shippingRate = calculateShippingRate({
    originCity: seller.originCity,
    destinationCity,
    weightGram: totalWeightGram,
    courier: cod ? 'COD' : 'REG'
  });

  const order = {
    id: `ord_${nanoid(10)}`,
    sellerId,
    customerName,
    customerPhone,
    destinationCity,
    items: orderItems,
    subtotal,
    shippingCost: shippingRate.cost,
    total: subtotal + shippingRate.cost,
    status: cod ? 'waiting_seller_process_cod' : 'waiting_payment',
    createdAt: new Date().toISOString()
  };

  const payment = createPaymentIntent({
    orderId: order.id,
    amount: order.total,
    method: paymentMethod
  });

  const shipment = createShipment({ orderId: order.id, cod });

  order.payment = payment;
  order.shipment = shipment;

  db.orders.push(order);
  writeDb(db);

  recordPixelEvent({
    sellerId,
    eventName: 'Purchase',
    source: 'server',
    payload: { orderId: order.id, total: order.total, paymentMethod }
  });

  res.status(201).json({ order });
});

app.get('/api/orders', (req, res) => {
  const user = requireRole(req, res, ['seller', 'admin']);
  if (!user) return;

  const db = readDb();

  if (user.role === 'admin') {
    return res.json({ orders: db.orders });
  }

  res.json({ orders: db.orders.filter((order) => order.sellerId === user.sellerId) });
});

app.post('/api/chat/messages', (req, res) => {
  const { sellerId, customerName, message } = req.body;

  if (!sellerId || !customerName || !message) {
    return res.status(422).json({ message: 'sellerId, customerName, dan message wajib diisi' });
  }

  const db = readDb();
  const chatMessage = {
    id: `chat_${nanoid(10)}`,
    sellerId,
    customerName,
    message,
    createdAt: new Date().toISOString()
  };

  db.chats.push(chatMessage);
  writeDb(db);

  res.status(201).json({ chatMessage });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`UMKM Marketplace Foundation berjalan di http://localhost:${port}`);
  });
}

export default app;
