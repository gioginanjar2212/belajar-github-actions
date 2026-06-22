import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ensureDb, readDb, writeDb } from './store.js';
import { calculateShippingRate, createShipment } from './services/shipping.js';
import { createPaymentIntent } from './services/payment.js';
import { recordPixelEvent } from './services/pixels.js';

ensureDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'umkm-marketplace-foundation' });
});

app.post('/api/sellers/register', (req, res) => {
  const { name, ownerName, email, originCity } = req.body;

  if (!name || !ownerName || !email || !originCity) {
    return res.status(422).json({ message: 'name, ownerName, email, dan originCity wajib diisi' });
  }

  const db = readDb();
  const seller = {
    id: `seller_${nanoid(10)}`,
    name,
    ownerName,
    email,
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

  res.status(201).json({ seller });
});

app.get('/api/sellers', (req, res) => {
  const db = readDb();
  res.json({ sellers: db.sellers });
});

app.get('/api/products', (req, res) => {
  const db = readDb();
  const activeProducts = db.products.filter((product) => product.active);
  res.json({ products: activeProducts });
});

app.post('/api/products', (req, res) => {
  const { sellerId, name, category, price, stock, weightGram } = req.body;

  if (!sellerId || !name || !category || !price || stock === undefined || !weightGram) {
    return res.status(422).json({ message: 'sellerId, name, category, price, stock, dan weightGram wajib diisi' });
  }

  const db = readDb();
  const seller = db.sellers.find((item) => item.id === sellerId);

  if (!seller) {
    return res.status(404).json({ message: 'Seller tidak ditemukan' });
  }

  const product = {
    id: `prod_${nanoid(10)}`,
    sellerId,
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
  const db = readDb();
  res.json({ orders: db.orders });
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
