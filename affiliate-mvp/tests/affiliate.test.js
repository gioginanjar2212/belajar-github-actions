import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/server.js';

const server = app.listen(0);
const base = () => `http://127.0.0.1:${server.address().port}`;

after(() => server.close());

test('public pages render', async () => {
  for (const path of ['/', '/tentang-saya', '/produk', '/blog', '/kontak']) {
    const response = await fetch(`${base()}${path}`);
    assert.equal(response.status, 200, `${path} should return 200`);
    const body = await response.text();
    assert.ok(body.includes('Ayo Ginanjar') || body.includes('Produk Digital'));
  }
});

test('product detail and partner redirect route work', async () => {
  const detail = await fetch(`${base()}/produk/template-konten-30-hari-umkm`);
  assert.equal(detail.status, 200);
  const detailBody = await detail.text();
  assert.ok(detailBody.includes('/go/template-konten-30-hari-umkm'));

  const redirect = await fetch(`${base()}/go/template-konten-30-hari-umkm?utm_source=test`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.ok(redirect.headers.get('location').includes('example.com'));
});

test('catalog feeds render', async () => {
  const xml = await fetch(`${base()}/catalog-feed.xml`);
  assert.equal(xml.status, 200);
  assert.ok((await xml.text()).includes('<catalog>'));

  const csv = await fetch(`${base()}/meta/catalog.csv`);
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes('id,title,description'));
});
