const pool = require('../db/pool');

const LIMIT = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

async function checkRateLimit(ipAddress, widgetId) {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM rate_limit_events WHERE ip_address = $1 AND widget_id = $2 AND created_at > $3',
    [ipAddress, widgetId, windowStart]
  );

  const count = parseInt(result.rows[0].count);
  return count < LIMIT;
}

async function recordRateLimitEvent(ipAddress, widgetId) {
  await pool.query('INSERT INTO rate_limit_events (ip_address, widget_id) VALUES ($1, $2)', [ipAddress, widgetId]);
}

module.exports = { checkRateLimit, recordRateLimitEvent };