const express = require('express');
const router = express.Router();
const widgetCors = require('../services/cors');
const { checkRateLimit, recordRateLimitEvent } = require('../services/rateLimit');
const isSpam = require('../services/spamCheck');
const lookupGeo = require('../services/geoLookup');
const { enqueueJob } = require('../services/jobs');
const pool = require('../db/pool');

router.get('/widgets/:id/config', widgetCors, (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    id: req.widget.id,
    type: req.widget.type,
    title: req.widget.title,
    description: req.widget.description,
    fields: req.widget.fields,
    button_text: req.widget.button_text,
  });
});

router.options('/submissions', widgetCors);
router.post('/submissions', widgetCors, async (req, res) => {
  const ipAddress = req.ip;
  const widget = req.widget;

  // Rate limit check
  const allowed = await checkRateLimit(ipAddress, widget.id);
  if (!allowed) {
    return res.status(429).json({ error: 'Too many submissions, please try again later' });
  }
  await recordRateLimitEvent(ipAddress, widget.id);

  // Validate required fields exist
  const submittedData = req.body.data || {};
  for (const field of widget.fields) {
    if (field.required && !field.honeypot && !submittedData[field.name]) {
      return res.status(400).json({ error: `Missing required field: ${field.name}` });
    }
  }

  // Spam check
  const spam = isSpam(widget, submittedData);

  // Geo lookup — never allowed to block or fail the submission
  const geo = await lookupGeo(ipAddress);

  const result = await pool.query(
    `INSERT INTO submissions (widget_id, tenant_id, data, ip_address, country, city, geo_provider_used, spam_flag)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [widget.id, widget.tenant_id, JSON.stringify(submittedData), ipAddress, geo.country, geo.city, geo.provider, spam]
  );

  // Confirmation email: queued, never awaited inline — the response goes out regardless of email outcome
  if (submittedData.email && !spam) {
    await enqueueJob('send_confirmation_email', { email: submittedData.email, widgetId: widget.id });
  }

  res.status(201).json({ id: result.rows[0].id, status: spam ? 'flagged' : 'received' });
});

module.exports = router;