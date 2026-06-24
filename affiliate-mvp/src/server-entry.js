import app from './server.js';

app.get('/admin', (req, res) => {
  const loggedIn = (req.headers.cookie || '').includes('admin_session=demo-admin');
  res.redirect(loggedIn ? '/admin/dashboard' : '/admin/login');
});

export default app;
