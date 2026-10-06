const express = require('express');
const router = express.Router();
const requireAuth = require('../services/requireAuth');
const pool = require('../db/pool');

router.get('/dashboard/stats', requireAuth, async (req, res) => {
  const totalResult = await pool.query(
    'SELECT COUNT(*) AS count FROM submissions WHERE tenant_id = $1 AND spam_flag = false',
    [req.tenant.id]
  );

  const perWidgetResult = await pool.query(
    `SELECT w.id AS widget_id, w.title, COUNT(s.id) AS submission_count
     FROM widgets w
     LEFT JOIN submissions s ON s.widget_id = w.id AND s.spam_flag = false
     WHERE w.tenant_id = $1
     GROUP BY w.id, w.title`,
    [req.tenant.id]
  );

  const geoResult = await pool.query(
    `SELECT country, COUNT(*) AS count
     FROM submissions
     WHERE tenant_id = $1 AND country IS NOT NULL AND spam_flag = false
     GROUP BY country
     ORDER BY count DESC`,
    [req.tenant.id]
  );

  res.json({
    total_submissions: parseInt(totalResult.rows[0].count),
    per_widget: perWidgetResult.rows,
    by_country: geoResult.rows,
  });
});

module.exports = router;