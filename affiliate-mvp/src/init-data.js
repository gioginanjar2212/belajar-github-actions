import { resetDb } from './store.js';
import { demoData } from './demo-data.js';

const now = new Date().toISOString();
const withDates = {
  ...demoData,
  admins: demoData.admins.map((item) => ({ ...item, password: item.passcode, passcode: undefined, createdAt: now })),
  products: demoData.products.map((item) => ({ ...item, affiliateUrl: item.partnerUrl, partnerUrl: undefined, createdAt: now, updatedAt: now })),
  blogPosts: demoData.blogPosts.map((item) => ({ ...item, publishedAt: now, createdAt: now, updatedAt: now }))
};

resetDb(withDates);
console.log('Data awal affiliate MVP Ayo Ginanjar dibuat.');
