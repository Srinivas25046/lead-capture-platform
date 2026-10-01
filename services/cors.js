const { getWidgetById } = require('./widgets');

async function widgetCors(req, res, next) {
  const widgetId = req.params.id || req.body?.widget_id;
  const origin = req.header('Origin');

  if (!widgetId) {
    return res.status(400).json({ error: 'widget_id is required' });
  }

  const widget = await getWidgetById(widgetId);
  if (!widget) {
    return res.status(404).json({ error: 'Widget not found' });
  }

  const allowedOrigins = widget.allowed_origins || [];
  const isAllowed = allowedOrigins.includes(origin);

  if (origin && isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }

  req.widget = widget; // pass it forward so the route doesn't have to look it up again

  if (req.method === 'OPTIONS') {
    return res.sendStatus(isAllowed ? 204 : 403);
  }

  if (!isAllowed) {
    return res.status(403).json({ error: 'Origin not allowed for this widget' });
  }

  next();
}

module.exports = widgetCors;