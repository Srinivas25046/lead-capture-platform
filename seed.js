const crypto = require('crypto');
const pool = require('./db/pool');
const migrate = require('./db/migrate');

// A fixed, publicly documented key so reviewers can call the owner endpoints right away.
// LOCAL DEMO DATA ONLY. Never reuse a documented key anywhere real.
const DEMO_API_KEY = 'lck_demo_local_only_key';
const DEMO_WIDGET_TITLE = 'Join our newsletter';

async function seed() {
  await migrate();

  const keyHash = crypto.createHash('sha256').update(DEMO_API_KEY).digest('hex');

  let tenant = (await pool.query('SELECT id FROM tenants WHERE api_key_hash = $1', [keyHash])).rows[0];
  if (!tenant) {
    tenant = (
      await pool.query('INSERT INTO tenants (name, api_key_hash) VALUES ($1, $2) RETURNING id', ['Demo Corp', keyHash])
    ).rows[0];
  }

  let widget = (
    await pool.query('SELECT id FROM widgets WHERE tenant_id = $1 AND title = $2', [tenant.id, DEMO_WIDGET_TITLE])
  ).rows[0];
  if (!widget) {
    widget = (
      await pool.query(
        `INSERT INTO widgets (tenant_id, type, title, description, fields, button_text, allowed_origins)
         VALUES ($1, 'signup_form', $2, $3, $4, 'Subscribe', $5) RETURNING id`,
        [
          tenant.id,
          DEMO_WIDGET_TITLE,
          'Get product updates by email.',
          JSON.stringify([
            { name: 'email', type: 'email', required: true },
            { name: 'website', type: 'text', required: false, honeypot: true },
          ]),
          JSON.stringify(['http://localhost:5500', 'http://127.0.0.1:5500']),
        ]
      )
    ).rows[0];
  }

  console.log('Seed complete.');
  console.log(`  X-API-Key:  ${DEMO_API_KEY}`);
  console.log(`  widget id:  ${widget.id}`);
  console.log('  allowed origins: http://localhost:5500, http://127.0.0.1:5500');
  console.log(`  embed:      <script src="http://localhost:3000/widget.js?id=${widget.id}&v=2"></script>`);

  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});