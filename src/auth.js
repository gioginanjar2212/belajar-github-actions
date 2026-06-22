import { nanoid } from 'nanoid';
import { readDb, writeDb } from './store.js';

const allowedRoles = ['customer', 'seller', 'admin'];

export function createUser({ name, email, password, role = 'customer', sellerId = null }) {
  if (!name || !email || !password) {
    throw new Error('name, email, dan password wajib diisi');
  }

  if (!allowedRoles.includes(role)) {
    throw new Error('role tidak valid');
  }

  const db = readDb();
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = db.users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    throw new Error('email sudah terdaftar');
  }

  const user = {
    id: `user_${nanoid(10)}`,
    name,
    email: normalizedEmail,
    password,
    role,
    sellerId,
    active: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDb(db);

  return safeUser(user);
}

export function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('email dan password wajib diisi');
  }

  const db = readDb();
  const user = db.users.find((item) => item.email === email.toLowerCase().trim() && item.password === password && item.active);

  if (!user) {
    throw new Error('login gagal');
  }

  const token = `token_${user.id}`;
  return { token, user: safeUser(user) };
}

export function getUserFromToken(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token.startsWith('token_')) {
    return null;
  }

  const userId = token.replace('token_', '');
  const db = readDb();
  const user = db.users.find((item) => item.id === userId && item.active);

  return user || null;
}

export function requireRole(req, res, roles) {
  const user = getUserFromToken(req);

  if (!user) {
    res.status(401).json({ message: 'Unauthenticated' });
    return null;
  }

  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!allowed.includes(user.role)) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }

  return user;
}

export function safeUser(user) {
  if (!user) return null;

  const { password, ...safe } = user;
  return safe;
}
