const { getWidgetById } = require('./widgets');

async function widgetCors(req, res, next) {
  const origin = req.header('Origin');

  if (req.method === 'OPTIONS') {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Max-Age', '600');
    }
    return res.sendStatus(204);
  }

  const widgetId = req.params.id || req.body?.widget_id;

  if (!widgetId) {
    return res.status(400).json({ error: 'widget_id is required' });
  }
  if (!/^\d+$/.test(String(widgetId))) {
    return res.status(400).json({ error: 'widget_id must be a number' });
  }

  const widget = await getWidgetById(widgetId);
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' });
  }

  const allowedOrigins = widget.allowed_origins || [];
  const isAllowed = Boolean(origin) && allowedOrigins.includes(origin);

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }

  req.widget = widget;

  if (!isAllowed) {
    return res.status(403).json({ error: 'Origin not allowed for this widget' });
  }

  next();
}

module.exports = widgetCors;