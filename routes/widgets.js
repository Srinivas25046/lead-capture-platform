const express = require('express');
const router = express.Router();
const requireAuth = require('../services/requireAuth');
const { createWidget, listWidgets, getWidget } = require('../services/widgets');

router.use(requireAuth); // every route below this line requires a valid API key

router.post('/widgets', async (req, res) => {
  const { type, title, fields } = req.body;
  if (!['signup_form', 'cta', 'popover'].includes(type)) {
    return res.status(400).json({ error: 'type must be one of: signup_form, cta, popover' });
  }
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: 'fields must be a non-empty array' });
  }

  const widget = await createWidget(req.tenant.id, req.body);
  res.status(201).json(widget);
});

router.get('/widgets', async (req, res) => {
  const widgets = await listWidgets(req.tenant.id);
  res.json(widgets);
});

router.get('/widgets/:id', async (req, res) => {
  const widget = await getWidget(req.tenant.id, req.params.id);
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' });
  }
  res.json(widget);
});

module.exports = router;