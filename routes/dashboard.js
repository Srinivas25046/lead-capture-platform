const express = require('express');
const router = express.Router();
const requireAuth = require('../services/requireAuth');
const pool = require('../db/pool');

// Every query below filters on tenant_id, so an owner only ever sees their own data.
// Spam-flagged submissions are excluded from all counts and listings.

router.get('/dashboard/stats', requireAuth, async (req, res) => {
  const tenantId = req.tenant.id;

  const total = await pool.query(
    'SELECT COUNT(*) AS count FROM submissions WHERE tenant_id = $1 AND spam_flag = false',
    [tenantId]
  );

  const perWidget = await pool.query(
    `SELECT w.id AS widget_id, w.title, COUNT(s.id) AS submission_count
     FROM widgets w
     LEFT JOIN submissions s ON s.widget_id = w.id AND s.spam_flag = false
     WHERE w.tenant_id = $1
     GROUP BY w.id, w.title
     ORDER BY w.id`,
    [tenantId]
  );

  const byCountry = await pool.query(
    `SELECT country, COUNT(*) AS count
     FROM submissions
     WHERE tenant_id = $1 AND country IS NOT NULL AND spam_flag = false
     GROUP BY country
     ORDER BY count DESC`,
    [tenantId]
  );

  const byDay = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS count
     FROM submissions
     WHERE tenant_id = $1 AND spam_flag = false AND created_at > now() - interval '30 days'
     GROUP BY 1
     ORDER BY 1`,
    [tenantId]
  );

  res.json({
    total_submissions: Number(total.rows[0].count),
    per_widget: perWidget.rows.map(r => ({ ...r, submission_count: Number(r.submission_count) })),
    by_country: byCountry.rows.map(r => ({ ...r, count: Number(r.count) })),
    by_day: byDay.rows.map(r => ({ ...r, count: Number(r.count) })),
  });
});

// The owner's submissions, newest first. Optional filters: ?widget_id=1&limit=20&offset=0
router.get('/dashboard/submissions', requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const params = [req.tenant.id];
  let where = 'tenant_id = $1 AND spam_flag = false';

  if (req.query.widget_id !== undefined) {
    if (!/^\d+$/.test(String(req.query.widget_id))) {
      return res.status(400).json({ error: 'widget_id must be a number' });
    }
    params.push(req.query.widget_id);
    where += ` AND widget_id = $${params.length}`;
  }

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT id, widget_id, data, country, city, geo_provider_used, created_at
     FROM submissions
     WHERE ${where}
     ORDER BY id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ limit, offset, submissions: result.rows });
});

module.exports = router;