# Cara Menjalankan Affiliate MVP

Gunakan command langsung berikut dari root repository:

```bash
cd affiliate-mvp
npm install
node src/init-data.js
node src/server-entry.js
```

Lalu buka:

```text
http://localhost:3000
```

Test smoke route:

```bash
cd affiliate-mvp
node src/init-data.js
npm test
```

Catatan: `server-entry.js` dipakai agar route `/admin` aktif sebagai pintu masuk admin.
