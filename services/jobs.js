const pool = require('../db/pool');

async function enqueueJob(type, payload) {
  await pool.query('INSERT INTO jobs (type, payload) VALUES ($1, $2)', [type, JSON.stringify(payload)]);
}

module.exports = { enqueueJob };