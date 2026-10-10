const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const RETRYABLE = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', '57P03'];

// Applies schema.sql. Every statement is idempotent, so running it repeatedly is safe.
// Retries while Postgres is still starting up, so `docker compose up` works on a clean machine.
async function migrate({ retries = 20, delayMs = 2000 } = {}) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(sql);
      console.log('Migration complete.');
      return;
    } catch (err) {
      const canRetry = RETRYABLE.includes(err.code) || err.name === 'AggregateError';
      if (!canRetry || attempt === retries) throw err;
      console.log(`Database not ready (${err.code || err.message}), retrying in ${delayMs}ms (${attempt}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = migrate;

// Still works as a standalone command: node db/migrate.js
if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}