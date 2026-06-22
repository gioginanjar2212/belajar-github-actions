import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'marketplace.json');

const emptyDb = {
  users: [],
  sellers: [],
  customers: [],
  addresses: [],
  products: [],
  orders: [],
  paymentEvents: [],
  chats: [],
  pixelEvents: []
};

function normalizeDb(db) {
  return {
    ...emptyDb,
    ...db,
    users: db.users || [],
    sellers: db.sellers || [],
    customers: db.customers || [],
    addresses: db.addresses || [],
    products: db.products || [],
    orders: db.orders || [],
    paymentEvents: db.paymentEvents || [],
    chats: db.chats || [],
    pixelEvents: db.pixelEvents || []
  };
}

export function ensureDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2));
  }
}

export function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
}

export function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(normalizeDb(db), null, 2));
  return db;
}

export function resetDb(seedData = emptyDb) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(dbPath, JSON.stringify(normalizeDb(seedData), null, 2));
  return seedData;
}
