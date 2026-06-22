import { nanoid } from 'nanoid';
import { readDb, writeDb } from '../store.js';
import { requireRole } from '../auth.js';
import { calculateShippingRate, createShipment } from '../services/shipping.js';
import { createPaymentIntent } from '../services/payment.js';
import { recordPixelEvent } from '../services/pixels.js';

function itemKey(productId, variantId = null) {
  return `${productId}:${variantId || 'default'}`;
}

function ensureActiveCart(db, userId) {
  db.carts = db.carts || [];

  let cart = db.carts.find((item) => item.userId === userId && item.status === 'active');

  if (!cart) {
    cart = {
      id: `cart_${nanoid(10)}`,
      userId,
      status: 'active',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.carts.push(cart);
  }

  return cart;
}

function addStatusLog(order, status, actor = 'system', note = '') {
  order.status = status;
  order.statusLogs = order.statusLogs || [];
  order.statusLogs.push({ status, actor, note, createdAt: new Date().toISOString() });
}

function buildCartItem(product, variant, qty) {
  const imageUrl = product.images?.find((image) => image.isPrimary)?.url || product.images?.[0]?.url || '';
  const price = Number(product.price) + Number(variant?.priceDelta || 0);
  const weightGram = Number(variant?.weightGram || product.weightGram);

  return {
    id: `cartitem_${nanoid(10)}`,
    key: itemKey(product.id, variant?.id || null),
    productId: product.id,
    variantId: variant?.id || null,
    sellerId: product.sellerId,
    name: product.name,
    variant: variant ? `${variant.name}: ${variant.value}` : null,
    imageUrl,
    price,
    weightGram,
    qty: Number(qty),
    addedAt: new Date().toISOString()
  };
}

function cartSummary(cart) {
  const items = cart.items || [];
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty), 0);
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);

  return {
    ...cart,
    totalQty,
    subtotal
  };
}

export function registerCartMediaRoutes(app) {
  app.get('/api/products/:productId', (req, res) => {
    const db = readDb();
    const product = db.products.find((item) => item.id === req.params.productId && item.active);

    if (!product) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    res.json({ product });
  });

  app.post('/api/seller/products/:productId/images', (req, res) => {
    const user = requireRole(req, res, 'seller');
    if (!user) return;

    const { url, alt = '', isPrimary = false } = req.body;

    if (!url) {
      return res.status(422).json({ message: 'url gambar wajib diisi' });
    }

    const db = readDb();
    const product = db.products.find((item) => item.id === req.params.productId && item.sellerId === user.sellerId);

    if (!product) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    product.images = product.images || [];

    if (isPrimary) {
      product.images = product.images.map((image) => ({ ...image, isPrimary: false }));
    }

    const image = {
      id: `img_${nanoid(10)}`,
      url,
      alt,
      isPrimary: Boolean(isPrimary || product.images.length === 0),
      createdAt: new Date().toISOString()
    };

    product.images.push(image);
    writeDb(db);

    res.status(201).json({ image, product });
  });

  app.get('/api/customer/cart', (req, res) => {
    const user = requireRole(req, res, 'customer');
    if (!user) return;

    const db = readDb();
    const cart = ensureActiveCart(db, user.id);
    writeDb(db);

    res.json({ cart: cartSummary(cart) });
  });

  app.post('/api/customer/cart/items', (req, res) => {
    const user = requireRole(req, res, 'customer');
    if (!user) return;

    const { productId, variantId = null, qty = 1 } = req.body;

    if (!productId) {
      return res.status(422).json({ message: 'productId wajib diisi' });
    }

    const db = readDb();
    const product = db.products.find((item) => item.id === productId && item.active);

    if (!product) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }

    const variant = variantId ? (product.variants || []).find((item) => item.id === variantId) : null;

    if (variantId && !variant) {
      return res.status(404).json({ message: 'Varian tidak ditemukan' });
    }

    const requestedQty = Number(qty);

    if (requestedQty < 1) {
      return res.status(422).json({ message: 'qty minimal 1' });
    }

    if (product.stock < requestedQty || (variant && variant.stock < requestedQty)) {
      return res.status(422).json({ message: 'Stok tidak cukup' });
    }

    const cart = ensureActiveCart(db, user.id);
    const key = itemKey(product.id, variant?.id || null);
    const existingItem = cart.items.find((item) => item.key === key);

    if (existingItem) {
      existingItem.qty += requestedQty;
      existingItem.updatedAt = new Date().toISOString();
    } else {
      cart.items.push(buildCartItem(product, variant, requestedQty));
    }

    cart.updatedAt = new Date().toISOString();
    writeDb(db);

    res.status(201).json({ cart: cartSummary(cart) });
  });

  app.patch('/api/customer/cart/items/:cartItemId', (req, res) => {
    const user = requireRole(req, res, 'customer');
    if (!user) return;

    const qty = Number(req.body.qty);

    if (!qty || qty < 1) {
      return res.status(422).json({ message: 'qty minimal 1' });
    }

    const db = readDb();
    const cart = ensureActiveCart(db, user.id);
    const item = cart.items.find((cartItem) => cartItem.id === req.params.cartItemId);

    if (!item) {
      return res.status(404).json({ message: 'Item cart tidak ditemukan' });
    }

    item.qty = qty;
    item.updatedAt = new Date().toISOString();
    cart.updatedAt = new Date().toISOString();
    writeDb(db);

    res.json({ cart: cartSummary(cart) });
  });

  app.delete('/api/customer/cart/items/:cartItemId', (req, res) => {
    const user = requireRole(req, res, 'customer');
    if (!user) return;

    const db = readDb();
    const cart = ensureActiveCart(db, user.id);
    const before = cart.items.length;
    cart.items = cart.items.filter((item) => item.id !== req.params.cartItemId);

    if (before === cart.items.length) {
      return res.status(404).json({ message: 'Item cart tidak ditemukan' });
    }

    cart.updatedAt = new Date().toISOString();
    writeDb(db);

    res.json({ cart: cartSummary(cart) });
  });

  app.post('/api/customer/cart/checkout', (req, res) => {
    const user = requireRole(req, res, 'customer');
    if (!user) return;

    const { addressId, paymentMethod = 'VA' } = req.body;

    if (!addressId) {
      return res.status(422).json({ message: 'addressId wajib diisi' });
    }

    const db = readDb();
    const cart = ensureActiveCart(db, user.id);

    if (!cart.items.length) {
      return res.status(422).json({ message: 'Cart masih kosong' });
    }

    const address = db.addresses.find((item) => item.id === addressId && item.userId === user.id);

    if (!address) {
      return res.status(404).json({ message: 'Alamat tidak ditemukan' });
    }

    const sellerIds = [...new Set(cart.items.map((item) => item.sellerId))];

    if (sellerIds.length !== 1) {
      return res.status(422).json({ message: 'Checkout cart saat ini hanya mendukung satu seller' });
    }

    let subtotal = 0;
    let totalWeightGram = 0;
    const orderItems = [];

    for (const cartItem of cart.items) {
      const product = db.products.find((item) => item.id === cartItem.productId && item.active);

      if (!product) {
        return res.status(404).json({ message: 'Produk di cart tidak ditemukan' });
      }

      const variant = cartItem.variantId ? (product.variants || []).find((item) => item.id === cartItem.variantId) : null;
      const qty = Number(cartItem.qty);

      if (product.stock < qty || (variant && variant.stock < qty)) {
        return res.status(422).json({ message: 'Stok produk di cart tidak cukup' });
      }

      product.stock -= qty;
      if (variant) variant.stock -= qty;

      subtotal += Number(cartItem.price) * qty;
      totalWeightGram += Number(cartItem.weightGram) * qty;
      orderItems.push({
        productId: cartItem.productId,
        variantId: cartItem.variantId,
        name: cartItem.name,
        variant: cartItem.variant,
        price: cartItem.price,
        qty,
        imageUrl: cartItem.imageUrl
      });
    }

    const seller = db.sellers.find((item) => item.id === sellerIds[0]);
    const cod = paymentMethod === 'COD';

    if (cod && !seller?.codEnabled) {
      return res.status(422).json({ message: 'COD belum aktif untuk seller ini' });
    }

    const shippingRate = calculateShippingRate({
      originCity: seller.originCity,
      destinationCity: address.city,
      weightGram: totalWeightGram,
      courier: cod ? 'COD' : 'REG'
    });

    const order = {
      id: `ord_${nanoid(10)}`,
      sellerId: seller.id,
      customerId: user.id,
      customerName: address.receiverName,
      customerPhone: address.contactPhone,
      destinationCity: address.city,
      addressId: address.id,
      items: orderItems,
      subtotal,
      shippingCost: shippingRate.cost,
      total: subtotal + shippingRate.cost,
      status: cod ? 'waiting_seller_process_cod' : 'waiting_payment',
      statusLogs: [],
      createdAt: new Date().toISOString()
    };

    addStatusLog(order, order.status, 'system', 'Order dibuat dari cart');

    order.payment = createPaymentIntent({ orderId: order.id, amount: order.total, method: paymentMethod });
    order.shipment = createShipment({ orderId: order.id, cod });

    db.orders.push(order);
    cart.status = 'checked_out';
    cart.orderId = order.id;
    cart.checkedOutAt = new Date().toISOString();

    writeDb(db);

    recordPixelEvent({
      sellerId: seller.id,
      eventName: 'Purchase',
      source: 'server',
      payload: { orderId: order.id, total: order.total, paymentMethod, fromCart: true }
    });

    res.status(201).json({ order });
  });
}
