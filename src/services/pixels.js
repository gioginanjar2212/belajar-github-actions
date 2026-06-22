import { readDb, writeDb } from '../store.js';

export function recordPixelEvent({ sellerId, eventName, source = 'server', payload = {} }) {
  const db = readDb();

  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sellerId,
    eventName,
    source,
    payload,
    createdAt: new Date().toISOString()
  };

  db.pixelEvents.push(event);
  writeDb(db);

  return event;
}
