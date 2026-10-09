const express = require('express');
const router = express.Router();
const requireAuth = require('../services/requireAuth');
const {
  createWidget,
  listWidgets,
  getWidget,
  updateWidget,
  deleteWidget,
} = require('../services/widgets');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
const WIDGET_VERSION = '2';
const WIDGET_TYPES = ['signup_form', 'cta', 'popover'];

function withEmbed(widget) {
  return {
    ...widget,
    embed_snippet: `<script src="${PUBLIC_BASE_URL}/widget.js?id=${widget.id}&v=${WIDGET_VERSION}"></script>`,
  };
}

function isNumericId(value) {
  return /^\d+$/.test(String(value));
}

router.use('/widgets', requireAuth);

router.post('/widgets', async (req, res) => {
  const { type, title, fields, allowed_origins } = req.body;

  if (!WIDGET_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type must be one of: signup_form, cta, popover' });
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  if (!Array.isArray(fields) || fields.length === 0) {
    return res.status(400).json({ error: 'fields must be a non-empty array' });
  }
  if (allowed_origins !== undefined && !Array.isArray(allowed_origins)) {
    return res.status(400).json({ error: 'allowed_origins must be an array' });
  }

  const widget = await createWidget(req.tenant.id, req.body);
  res.status(201).json(withEmbed(widget));
});

router.get('/widgets', async (req, res) => {
  const widgets = await listWidgets(req.tenant.id);
  res.json(widgets.map(withEmbed));
});

router.get('/widgets/:id', async (req, res) => {
  if (!isNumericId(req.params.id)) {
    return res.status(400).json({ error: 'Widget id must be a number' });
  }
  const widget = await getWidget(req.tenant.id, req.params.id);
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' });
  }
  res.json(withEmbed(widget));
});

router.put('/widgets/:id', async (req, res) => {
  if (!isNumericId(req.params.id)) {
    return res.status(400).json({ error: 'Widget id must be a number' });
  }

  const { title, fields, allowed_origins } = req.body;
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (fields !== undefined && (!Array.isArray(fields) || fields.length === 0)) {
    return res.status(400).json({ error: 'fields must be a non-empty array' });
  }
  if (allowed_origins !== undefined && !Array.isArray(allowed_origins)) {
    return res.status(400).json({ error: 'allowed_origins must be an array' });
  }

  const updated = await updateWidget(req.tenant.id, req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Widget not found' });
  }
  res.json(withEmbed(updated));
});

router.delete('/widgets/:id', async (req, res) => {
  if (!isNumericId(req.params.id)) {
    return res.status(400).json({ error: 'Widget id must be a number' });
  }
  const deleted = await deleteWidget(req.tenant.id, req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Widget not found' });
  }
  res.status(204).send();
});

module.exports = router;