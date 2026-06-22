import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ensureDb, readDb, writeDb } from './store.js';
import { calculateShippingRate, createShipment } from './services/shipping.js';
import { createPaymentIntent } from './services/payment.js';
import { recordPixelEvent } from './services/pixels.js';
import { createUser, getUserFromToken, loginUser, requireRole, safeUser } from './auth.js';
import { registerCartMediaRoutes } from './routes/cart-media.js';

ensureDb();

const app = express();
const port = process.env.PORT || 3000;
const sellerOrderStatuses = ['processing', 'shipped', 'delivered'];

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function addStatusLog(order, status, actor = 'system', note = '') {
  order.status = status;
  order.statusLogs = order.statusLogs || [];
  order.statusLogs.push({ status, actor, note, createdAt: new Date().toISOString() });
}

function registerSeller(req, res) {
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
    pixelSettings: { metaPixelId: '', tiktokPixelId: '', googleTagId: '' },
    createdAt: new Date().toISOString()
  };

  db.sellers.push(seller);
  writeDb(db);

  try {
    const user = createUser({ name: ownerName, email: normalizedEmail, password, role: 'seller', sellerId: seller.id });
    return res.status(201).json({ seller, user });
  } catch (error) {
    const rollbackDb = readDb();
    rollbackDb.sellers = rollbackDb.sellers.filter((item) => item.id !== seller.id);
    writeDb(rollbackDb);
    return res.status(422).json({ message: error.message });
  }
}

function prepareCheckoutItems(db, items) {
  const orderItems = [];
  let subtotal = 0;
  let totalWeightGram = 0;
  let sellerId = null;

  for (const item of items) {
    const product = db.products.find((productItem) => productItem.id === item.productId && productItem.active);

    if (!product) {
      return { error: { status: 404, message: `Produk ${item.productId} tidak ditemukan` } };
    }

    const qty = Number(item.qty || 1);
    const variant = item.variantId ? (product.variants || []).find((variantItem) => variantItem.id === item.variantId) : null;

    if (item.variantId && !variant) {
      return { error: { status: 404, message: `Varian ${item.variantId} tidak ditemukan` } };
    }

    if (variant && variant.stock < qty) {
      return { error: { status: 422, message: `Stok varian ${variant.value} tidak cukup` } };
    }

    if (product.stock < qty) {
      return { error: { status: 422, message: `Stok ${product.name} tidak cukup` } };
    }

    sellerId = product.sellerId;
    product.stock -= qty;
    if (variant) variant.stock -= qty;

    const finalPrice = Number(product.price) + Number(variant?.priceDelta || 0);
    const finalWeight = Number(variant?.weightGram || product.weightGram);
    const imageUrl = product.images?.find((image) => image.isPrimary)?.url || product.images?.[0]?.url || '';

    subtotal += finalPrice * qty;
    totalWeightGram += finalWeight * qty;
    orderItems.push({
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      variant: variant ? `${variant.name}: ${variant.value}` : null,
      price: finalPrice,
      qty,
      imageUrl
    });
  }

  return { orderItems, subtotal, totalWeightGram, sellerId };
}

function createOrderFromItems({ db, currentUser = null, customerData, selectedAddress = null, items, paymentMethod = 'VA', source = 'checkout' }) {
  const prepared = prepareCheckoutItems(db, items);

  if (prepared.error) {
    return prepared;
  }

  const seller = db.sellers.find((item) => item.id === prepared.sellerId);
  const cod = paymentMethod === 'COD';

  if (cod && !seller?.codEnabled) {
    return { error: { status: 422, message: 'COD belum aktif untuk seller ini' } };
  }

  const shippingRate = calculateShippingRate({
    originCity: seller.originCity,
    destinationCity: customerData.destinationCity,
    weightGram: prepared.totalWeightGram,
    courier: cod ? 'COD' : 'REG'
  });

  const order = {
    id: `ord_${nanoid(10)}`,
    sellerId: prepared.sellerId,
    customerId: currentUser?.role === 'customer' ? currentUser.id : null,
    customerName: customerData.customerName,
    customerPhone: customerData.customerPhone,
    destinationCity: customerData.destinationCity,
    addressId: selectedAddress?.id || null,
    source,
    items: prepared.orderItems,
    subtotal: prepared.subtotal,
    shippingCost: shippingRate.cost,
    total: prepared.subtotal + shippingRate.cost,
    status: cod ? 'waiting_seller_process_cod' : 'waiting_payment',
    statusLogs: [],
    createdAt: new Date().toISOString()
  };

  addStatusLog(order, order.status, 'system', source === 'cart' ? 'Order dibuat dari cart' : 'Order dibuat');
  order.payment = createPaymentIntent({ orderId: order.id, amount: order.total, method: paymentMethod });
  order.shipment = createShipment({ orderId: order.id, cod });

  return { order };
}

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

app.post('/api/auth/register/seller', registerSeller);

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

app.post('/api/customer/addresses', (req, res) => {
  const user = requireRole(req, res, 'customer');
  if (!user) return;

  const { label, receiverName, contactPhone, city, detail, postalCode } = req.body;

  if (!label || !receiverName || !contactPhone || !city || !detail) {
    return res.status(422).json({ message: 'label, receiverName, contactPhone, city, dan detail wajib diisi' });
  }

  const db = readDb();
  const address = {
    id: `addr_${nanoid(10)}`,
    userId: user.id,
    label,
    receiverName,
    contactPhone,
    city,
    detail,
    postalCode: postalCode || '',
    isDefault: db.addresses.filter((item) => item.userId === user.id).length === 0,
    createdAt: new Date().toISOString()
  };

  db.addresses.push(address);
  writeDb(db);
  res.status(201).json({ address });
});

app.get('/api/customer/addresses', (req, res) => {
  const user = requireRole(req, res, 'customer');
  if (!user) return;
  const db = readDb();
  res.json({ addresses: db.addresses.filter((item) => item.userId === user.id) });
});

app.post('/api/sellers/register', (req, res) => {
  req.body.storeName = req.body.storeName || req.body.name;
  return registerSeller(req, res);
});

app.get('/api/sellers', (req, res) => {
  const db = readDb();
  res.json({ sellers: db.sellers.filter((seller) => seller.status === 'approved') });
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
  res.json({ products: db.products.filter((product) => product.active) });
});

app.post('/api/products', (req, res) => {
  const user = requireRole(req, res, 'seller');
  if (!user) return;

  const { name, category, price, stock, weightGram, variants = [], images = [] } = req.body;

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
    images: images.map((image, index) => ({
      id: image.id || `img_${nanoid(8)}`,
      url: image.url,
      alt: image.alt || name,
      isPrimary: Boolean(image.isPrimary || index === 0)
    })).filter((image) => image.url),
    variants: variants.map((variant) => ({
      id: variant.id || `var_${nanoid(8)}`,
      name: variant.name,
      value: variant.value,
      priceDelta: Number(variant.priceDelta || 0),
      stock: Number(variant.stock || 0),
      weightGram: Number(variant.weightGram || weightGram)
    })),
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
  const currentUser = getUserFromToken(req);
  const { customerName, customerPhone, destinationCity, addressId, paymentMethod = 'VA', items = [] } = req.body;

  if (items.length === 0) {
    return res.status(422).json({ message: 'items wajib diisi' });
  }

  const db = readDb();
  let customerData = { customerName, customerPhone, destinationCity };
  let selectedAddress = null;

  if (addressId) {
    if (!currentUser || currentUser.role !== 'customer') {
      return res.status(401).json({ message: 'Login customer dibutuhkan untuk memakai addressId' });
    }

    selectedAddress = db.addresses.find((address) => address.id === addressId && address.userId === currentUser.id);

    if (!selectedAddress) {
      return res.status(404).json({ message: 'Alamat tidak ditemukan' });
    }

    customerData = {
      customerName: selectedAddress.receiverName,
      customerPhone: selectedAddress.contactPhone,
      destinationCity: selectedAddress.city
    };
  }

  if (!customerData.customerName || !customerData.customerPhone || !customerData.destinationCity) {
    return res.status(422).json({ message: 'customerName, customerPhone, destinationCity atau addressId wajib diisi' });
  }

  const result = createOrderFromItems({ db, currentUser, customerData, selectedAddress, items, paymentMethod, source: 'checkout' });

  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  db.orders.push(result.order);
  writeDb(db);

  recordPixelEvent({
    sellerId: result.order.sellerId,
    eventName: 'Purchase',
    source: 'server',
    payload: { orderId: result.order.id, total: result.order.total, paymentMethod }
  });

  res.status(201).json({ order: result.order });
});

app.post('/api/payments/events', (req, res) => {
  const { orderId, status, providerReference = '' } = req.body;

  if (!orderId || !status) {
    return res.status(422).json({ message: 'orderId dan status wajib diisi' });
  }

  const db = readDb();
  const order = db.orders.find((item) => item.id === orderId);

  if (!order) {
    return res.status(404).json({ message: 'Order tidak ditemukan' });
  }

  const paymentEvent = { id: `payevt_${nanoid(10)}`, orderId, status, providerReference, createdAt: new Date().toISOString() };
  db.paymentEvents.push(paymentEvent);

  if (status === 'paid') {
    order.payment.status = 'paid';
    addStatusLog(order, 'paid', 'payment', 'Pembayaran valid');
  }

  if (status === 'failed') {
    order.payment.status = 'failed';
    addStatusLog(order, 'payment_failed', 'payment', 'Pembayaran gagal');
  }

  writeDb(db);
  res.status(201).json({ paymentEvent, order });
});

app.patch('/api/seller/orders/:orderId/status', (req, res) => {
  const user = requireRole(req, res, 'seller');
  if (!user) return;

  const { status, note = '' } = req.body;

  if (!sellerOrderStatuses.includes(status)) {
    return res.status(422).json({ message: 'Status seller tidak valid' });
  }

  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.orderId && item.sellerId === user.sellerId);

  if (!order) {
    return res.status(404).json({ message: 'Order tidak ditemukan' });
  }

  addStatusLog(order, status, 'seller', note);

  if (status === 'shipped') {
    order.shipment.status = 'in_transit';
  }

  if (status === 'delivered') {
    order.shipment.status = 'delivered';
  }

  writeDb(db);
  res.json({ order });
});

app.get('/api/customer/orders/:orderId', (req, res) => {
  const user = requireRole(req, res, 'customer');
  if (!user) return;

  const db = readDb();
  const order = db.orders.find((item) => item.id === req.params.orderId && item.customerId === user.id);

  if (!order) {
    return res.status(404).json({ message: 'Order tidak ditemukan' });
  }

  res.json({ order });
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
  const chatMessage = { id: `chat_${nanoid(10)}`, sellerId, customerName, message, createdAt: new Date().toISOString() };
  db.chats.push(chatMessage);
  writeDb(db);
  res.status(201).json({ chatMessage });
});

registerCartMediaRoutes(app);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`UMKM Marketplace Foundation berjalan di http://localhost:${port}`);
  });
}

export default app;
