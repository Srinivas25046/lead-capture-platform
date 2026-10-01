const pool = require('../db/pool');

async function createWidget(tenantId, data) {
  const result = await pool.query(
    `INSERT INTO widgets (tenant_id, type, title, description, fields, button_text, allowed_origins)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [tenantId, data.type, data.title, data.description || null, JSON.stringify(data.fields), data.button_text || 'Submit', JSON.stringify(data.allowed_origins || [])]
  );
  return result.rows[0];
}

async function listWidgets(tenantId) {
  const result = await pool.query('SELECT * FROM widgets WHERE tenant_id = $1', [tenantId]);
  return result.rows;
}

async function getWidget(tenantId, widgetId) {
  const result = await pool.query('SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2', [widgetId, tenantId]);
  return result.rows[0] || null;
}

async function getWidgetById(widgetId) {
  // used by PUBLIC routes — deliberately does NOT filter by tenant, since the visitor doesn't have a tenant context
  const result = await pool.query('SELECT * FROM widgets WHERE id = $1', [widgetId]);
  return result.rows[0] || null;
}

module.exports = { createWidget, listWidgets, getWidget, getWidgetById };