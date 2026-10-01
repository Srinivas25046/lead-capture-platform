const { findTenantByKey } = require('./auth');

async function requireAuth(req, res, next) {
  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    return res.status(401).json({ error: 'X-API-Key header required' });
  }

  const tenant = await findTenantByKey(apiKey);
  if (!tenant) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.tenant = tenant; // every owner route reads req.tenant.id from here on
  next();
}

module.exports = requireAuth;