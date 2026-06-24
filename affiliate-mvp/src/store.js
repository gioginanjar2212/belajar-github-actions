import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'affiliate-mvp.json');

export const emptyDb = {
  admins: [],
  productCategories: [],
  products: [],
  productClicks: [],
  blogCategories: [],
  blogPosts: [],
  homepage: {},
  settings: {},
  events: []
};

function normalizeDb(db = {}) {
  return {
    ...emptyDb,
    ...db,
    admins: db.admins || [],
    productCategories: db.productCategories || [],
    products: db.products || [],
    productClicks: db.productClicks || [],
    blogCategories: db.blogCategories || [],
    blogPosts: db.blogPosts || [],
    homepage: db.homepage || {},
    settings: db.settings || {},
    events: db.events || []
  };
}

export function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(emptyDb, null, 2));
}

export function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(dbPath, 'utf8')));
}

export function writeDb(db) {
  ensureDb();
  const normalized = normalizeDb(db);
  fs.writeFileSync(dbPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

export function resetDb(seedData = emptyDb) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const normalized = normalizeDb(seedData);
  fs.writeFileSync(dbPath, JSON.stringify(normalized, null, 2));
  return normalized;
}
