import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import { ensureDb, readDb, writeDb } from './store.js';

ensureDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static('public'));

function now() { return new Date().toISOString(); }
function esc(value = '') { return String(value ?? '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char])); }
function slugify(value = '') { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${nanoid(6)}`; }
function deviceType(agent = '') { return /mobile|android|iphone|ipad/i.test(agent) ? 'mobile' : 'desktop'; }
function isAdmin(req) { return (req.headers.cookie || '').includes('admin_session=demo-admin'); }
function requireAdmin(req, res, next) { if (!isAdmin(req)) return res.redirect('/admin/login'); next(); }
function activeProducts(db) { return db.products.filter((item) => item.isActive); }
function publishedPosts(db) { return db.blogPosts.filter((item) => item.status === 'published'); }
function catName(db, id) { return db.productCategories.find((item) => item.id === id)?.name || 'Kategori'; }
function html(db, body, title = 'Ayo Ginanjar') {
  return `<!doctype html><html lang='id'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${esc(title)}</title><meta name='description' content='${esc(db.settings.siteDescription || '')}'><link rel='stylesheet' href='/assets/style.css'></head><body><header><a class='brand' href='/'>${esc(db.settings.brandName || 'Ayo Ginanjar')}</a><nav><a href='/produk'>Produk</a><a href='/blog'>Blog</a><a href='/tentang-saya'>Tentang</a><a href='/kontak'>Kontak</a><a href='/admin'>Admin</a></nav></header><main>${body}</main><footer><b>${esc(db.settings.siteName || 'Ayo Ginanjar')}</b><p>${esc(db.settings.siteDescription || '')}</p><p>Meta Pixel placeholder aktif melalui settings.</p></footer></body></html>`;
}
function card(p, db) { return `<article class='card'><img src='${esc(p.thumbnail)}' alt='${esc(p.title)}'><span>${esc(catName(db, p.categoryId))}</span><h3>${esc(p.title)}</h3><p>${esc(p.shortDescription)}</p><strong>${esc(p.priceLabel)}</strong><a class='btn' href='/produk/${esc(p.slug)}'>Lihat Detail</a></article>`; }
function admin(body, title = 'Admin') { return `<!doctype html><html lang='id'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${esc(title)}</title><link rel='stylesheet' href='/assets/style.css'></head><body class='admin'><aside><h2>Admin CMS</h2><a href='/admin/dashboard'>Dashboard</a><a href='/admin/products'>Produk</a><a href='/admin/product-categories'>Kategori Produk</a><a href='/admin/blog-posts'>Blog</a><a href='/admin/blog-categories'>Kategori Blog</a><a href='/admin/homepage'>Homepage</a><a href='/admin/settings'>Settings</a><a href='/admin/analytics/clicks'>Klik</a><a href='/admin/logout'>Logout</a></aside><main>${body}</main></body></html>`; }

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'ayo-ginanjar-affiliate-mvp' }));

app.get('/', (req, res) => {
  const db = readDb();
  const products = activeProducts(db).filter((item) => item.isFeatured).slice(0, 6);
  const posts = publishedPosts(db).slice(0, 3);
  const body = `<section class='hero'><div><p class='eyebrow'>Personal Brand + Katalog Produk Digital</p><h1>${esc(db.homepage.heroTitle)}</h1><p>${esc(db.homepage.heroSubtitle)}</p><a class='btn' href='/produk'>Lihat Katalog Produk</a><a class='btn ghost' href='/tentang-saya'>Tentang Saya</a></div></section><section><h2>Kategori Produk</h2><div class='chips'>${db.productCategories.filter((c) => c.isActive).map((c) => `<a href='/produk?kategori=${esc(c.slug)}'>${esc(c.name)}</a>`).join('')}</div></section><section><h2>Produk Pilihan</h2><div class='grid'>${products.map((p) => card(p, db)).join('')}</div></section><section><h2>Artikel Terbaru</h2><div class='grid'>${posts.map((p) => `<article class='card'><img src='${esc(p.coverImage)}'><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><a href='/blog/${esc(p.slug)}'>Baca</a></article>`).join('')}</div></section>`;
  res.send(html(db, body, `${db.settings.siteName} - Produk Digital`));
});

app.get('/tentang-saya', (req, res) => { const db = readDb(); res.send(html(db, `<section class='page'><h1>Ayo Ginanjar / ErgioG</h1><p>Website ini dibuat sebagai pusat rekomendasi produk digital yang praktis untuk marketing, branding, sales, self development, dan bisnis.</p><p>Pembelian diarahkan ke platform partner. Website ini tidak memproses pembayaran internal.</p><a class='btn' href='/produk'>Lihat Produk</a></section>`, 'Tentang Ayo Ginanjar')); });

app.get('/produk', (req, res) => {
  const db = readDb();
  const q = String(req.query.q || '').toLowerCase();
  const selected = db.productCategories.find((c) => c.slug === req.query.kategori);
  let products = activeProducts(db);
  if (q) products = products.filter((p) => `${p.title} ${p.shortDescription}`.toLowerCase().includes(q));
  if (selected) products = products.filter((p) => p.categoryId === selected.id);
  const body = `<section class='page'><h1>Katalog Produk Digital</h1><form class='search'><input name='q' value='${esc(req.query.q || '')}' placeholder='Cari produk'><button class='btn'>Cari</button></form><div class='chips'><a href='/produk'>Semua</a>${db.productCategories.filter((c) => c.isActive).map((c) => `<a href='/produk?kategori=${esc(c.slug)}'>${esc(c.name)}</a>`).join('')}</div></section><section><div class='grid'>${products.map((p) => card(p, db)).join('') || '<p>Produk belum tersedia.</p>'}</div></section>`;
  res.send(html(db, body, 'Katalog Produk Digital'));
});

app.get('/produk/:slug', (req, res) => {
  const db = readDb();
  const p = activeProducts(db).find((item) => item.slug === req.params.slug);
  if (!p) return res.status(404).send(html(db, '<h1>Produk tidak ditemukan</h1>', '404'));
  db.events.push({ id: `event_${nanoid(8)}`, type: 'product_detail_viewed', productId: p.id, createdAt: now() });
  writeDb(db);
  const body = `<section class='detail'><img src='${esc(p.thumbnail)}'><div><span>${esc(catName(db, p.categoryId))}</span><h1>${esc(p.title)}</h1><p>${esc(p.shortDescription)}</p><h2>${esc(p.priceLabel)}</h2><a class='btn' href='/go/${esc(p.slug)}'>${esc(p.checkoutButtonText || 'Lihat Produk Partner')}</a><p class='note'>Aksi beli diarahkan ke platform partner eksternal.</p></div></section><section class='page'><h2>Deskripsi</h2><p>${esc(p.fullDescription)}</p><h2>Manfaat</h2><ul>${(p.benefits || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><h2>Cocok untuk siapa?</h2><p>${esc(p.targetAudience)}</p><h2>Apa yang didapat?</h2><ul>${(p.deliverables || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
  res.send(html(db, body, p.seoTitle || p.title));
});

app.get('/go/:slug', (req, res) => {
  const db = readDb();
  const p = activeProducts(db).find((item) => item.slug === req.params.slug);
  if (!p || !p.affiliateUrl) return res.status(404).send('Link produk tidak tersedia.');
  db.productClicks.push({ id: `click_${nanoid(10)}`, productId: p.id, ipAddress: req.ip, userAgent: req.get('user-agent') || '', referrer: req.get('referer') || '', utmSource: req.query.utm_source || '', utmMedium: req.query.utm_medium || '', utmCampaign: req.query.utm_campaign || '', sessionId: req.query.sid || nanoid(12), deviceType: deviceType(req.get('user-agent') || ''), clickedAt: now() });
  p.clickCount = (p.clickCount || 0) + 1;
  db.events.push({ id: `event_${nanoid(8)}`, type: 'checkout_redirected', productId: p.id, createdAt: now() });
  writeDb(db);
  res.redirect(p.affiliateUrl);
});

app.get('/blog', (req, res) => { const db = readDb(); const posts = publishedPosts(db); res.send(html(db, `<section class='page'><h1>Blog</h1><p>Artikel edukasi produk digital dan bisnis online.</p></section><section><div class='grid'>${posts.map((p) => `<article class='card'><img src='${esc(p.coverImage)}'><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><a href='/blog/${esc(p.slug)}'>Baca</a></article>`).join('')}</div></section>`, 'Blog')); });
app.get('/blog/:slug', (req, res) => { const db = readDb(); const p = publishedPosts(db).find((item) => item.slug === req.params.slug); if (!p) return res.status(404).send(html(db, '<h1>Artikel tidak ditemukan</h1>', '404')); db.events.push({ id: `event_${nanoid(8)}`, type: 'blog_viewed', postId: p.id, createdAt: now() }); writeDb(db); res.send(html(db, `<article class='page article'><img src='${esc(p.coverImage)}'><h1>${esc(p.title)}</h1><p>${esc(p.content)}</p></article>`, p.seoTitle || p.title)); });
app.get('/kontak', (req, res) => { const db = readDb(); res.send(html(db, `<section class='page'><h1>Kontak dan Bantuan</h1><p>Email: ${esc(db.settings.contactEmail)}</p><p>WhatsApp: ${esc(db.settings.contactWhatsapp)}</p><p>Pembelian dilakukan melalui platform partner.</p><a class='btn' href='/produk'>Katalog Produk</a></section>`, 'Kontak')); });
app.get('/catalog-feed.xml', (req, res) => { const db = readDb(); const items = activeProducts(db).map((p) => `<item><id>${esc(p.id)}</id><title>${esc(p.title)}</title><description>${esc(p.shortDescription)}</description><availability>in stock</availability><condition>new</condition><price>${Number(p.discountPrice || 0)} IDR</price><link>/produk/${esc(p.slug)}</link><image_link>${esc(p.thumbnail)}</image_link><brand>${esc(db.settings.brandName)}</brand><product_type>${esc(catName(db, p.categoryId))}</product_type></item>`).join(''); res.type('application/xml').send(`<?xml version='1.0'?><catalog>${items}</catalog>`); });
app.get('/meta/catalog.csv', (req, res) => { const db = readDb(); const rows = activeProducts(db).map((p) => `${p.id},${p.title},${p.shortDescription},in stock,new,${Number(p.discountPrice || 0)} IDR,/produk/${p.slug},${p.thumbnail},${db.settings.brandName},${catName(db, p.categoryId)}`); res.type('text/csv').send(['id,title,description,availability,condition,price,link,image_link,brand,product_type', ...rows].join('\n')); });

app.get('/admin', (req, res) => res.redirect(isAdmin(req) ? '/admin/dashboard' : '/admin/login'));
app.get('/admin/login', (req, res) => res.send(admin(`<section class='panel'><h1>Login Admin</h1><form method='post'><input name='email' placeholder='Email'><input name='password' type='password' placeholder='Password'><button class='btn'>Login</button><p>Demo: admin@ayoginanjar.test / password123</p></form></section>`, 'Login')));
app.post('/admin/login', (req, res) => { const db = readDb(); const ok = db.admins.find((a) => a.email === req.body.email && a.password === req.body.password); if (!ok) return res.status(401).send(admin('<h1>Login gagal</h1><a href="/admin/login">Coba lagi</a>', 'Login gagal')); res.setHeader('Set-Cookie', 'admin_session=demo-admin; Path=/; HttpOnly; SameSite=Lax'); res.redirect('/admin/dashboard'); });
app.get('/admin/logout', (req, res) => { res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0'); res.redirect('/admin/login'); });
app.get('/admin/dashboard', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Dashboard</h1><div class='stats'><div><b>${activeProducts(db).length}</b><span>Produk aktif</span></div><div><b>${publishedPosts(db).length}</b><span>Artikel</span></div><div><b>${db.productClicks.length}</b><span>Klik produk</span></div></div><a class='btn' href='/admin/products'>Kelola Produk</a>`, 'Dashboard')); });
app.get('/admin/products', requireAdmin, (req, res) => { const db = readDb(); const rows = db.products.map((p) => `<tr><td>${esc(p.title)}</td><td>${p.isActive ? 'Aktif' : 'Nonaktif'}</td><td>${p.clickCount || 0}</td><td><form method='post' action='/admin/products/${p.id}/toggle'><button>Toggle</button></form></td></tr>`).join(''); res.send(admin(`<h1>Produk</h1><table>${rows}</table>`, 'Produk')); });
app.post('/admin/products/:id/toggle', requireAdmin, (req, res) => { const db = readDb(); const p = db.products.find((item) => item.id === req.params.id); if (p) p.isActive = !p.isActive; writeDb(db); res.redirect('/admin/products'); });
app.get('/admin/product-categories', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Kategori Produk</h1><table>${db.productCategories.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.slug)}</td></tr>`).join('')}</table>`, 'Kategori Produk')); });
app.get('/admin/blog-posts', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Blog Posts</h1><table>${db.blogPosts.map((p) => `<tr><td>${esc(p.title)}</td><td>${esc(p.status)}</td></tr>`).join('')}</table>`, 'Blog')); });
app.get('/admin/blog-categories', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Kategori Blog</h1><table>${db.blogCategories.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.slug)}</td></tr>`).join('')}</table>`, 'Kategori Blog')); });
app.get('/admin/homepage', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Homepage</h1><form method='post'><textarea name='heroTitle'>${esc(db.homepage.heroTitle)}</textarea><textarea name='heroSubtitle'>${esc(db.homepage.heroSubtitle)}</textarea><button class='btn'>Simpan</button></form>`, 'Homepage')); });
app.post('/admin/homepage', requireAdmin, (req, res) => { const db = readDb(); db.homepage = { ...db.homepage, ...req.body }; writeDb(db); res.redirect('/admin/homepage'); });
app.get('/admin/settings', requireAdmin, (req, res) => { const db = readDb(); res.send(admin(`<h1>Settings</h1><form method='post'><input name='siteName' value='${esc(db.settings.siteName)}'><textarea name='siteDescription'>${esc(db.settings.siteDescription)}</textarea><input name='metaPixelId' value='${esc(db.settings.metaPixelId)}'><button class='btn'>Simpan</button></form>`, 'Settings')); });
app.post('/admin/settings', requireAdmin, (req, res) => { const db = readDb(); db.settings = { ...db.settings, ...req.body }; writeDb(db); res.redirect('/admin/settings'); });
app.get('/admin/analytics/clicks', requireAdmin, (req, res) => { const db = readDb(); const rows = db.productClicks.map((c) => `<tr><td>${esc(db.products.find((p) => p.id === c.productId)?.title || c.productId)}</td><td>${esc(c.deviceType)}</td><td>${esc(c.clickedAt)}</td></tr>`).join(''); res.send(admin(`<h1>Tracking Klik</h1><table>${rows}</table>`, 'Tracking')); });

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Affiliate MVP berjalan di http://localhost:${port}`));
export default app;
