const crypto = require('crypto');
const pool = require('../db/pool');

function generateApiKey() {
  return 'lck_' + crypto.randomBytes(24).toString('hex'); // "lck" = lead capture key, just a readable prefix
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function createTenant(name) {
  const rawKey = generateApiKey();
  const hash = hashKey(rawKey);
  const result = await pool.query(
    'INSERT INTO tenants (name, api_key_hash) VALUES ($1, $2) RETURNING id, name',
    [name, hash]
  );
  return { ...result.rows[0], api_key: rawKey }; // the raw key is only ever shown this once
}

async function findTenantByKey(rawKey) {
  const hash = hashKey(rawKey);
  const result = await pool.query('SELECT id, name FROM tenants WHERE api_key_hash = $1', [hash]);
  return result.rows[0] || null;
}

module.exports = { createTenant, findTenantByKey };