const pool = require('../db/pool');

async function createWidget(tenantId, data) {
  const result = await pool.query(
    `INSERT INTO widgets (tenant_id, type, title, description, fields, button_text, allowed_origins)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      tenantId,
      data.type,
      data.title,
      data.description || null,
      JSON.stringify(data.fields),
      data.button_text || 'Submit',
      JSON.stringify(data.allowed_origins || []),
    ]
  );
  return result.rows[0];
}

async function listWidgets(tenantId) {
  const result = await pool.query('SELECT * FROM widgets WHERE tenant_id = $1 ORDER BY id', [tenantId]);
  return result.rows;
}

async function getWidget(tenantId, widgetId) {
  const result = await pool.query('SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2', [widgetId, tenantId]);
  return result.rows[0] || null;
}

async function getWidgetById(widgetId) {
  const result = await pool.query('SELECT * FROM widgets WHERE id = $1', [widgetId]);
  return result.rows[0] || null;
}

async function updateWidget(tenantId, widgetId, data) {
  const result = await pool.query(
    `UPDATE widgets SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       fields = COALESCE($3, fields),
       button_text = COALESCE($4, button_text),
       allowed_origins = COALESCE($5, allowed_origins),
       config_version = config_version + 1
     WHERE id = $6 AND tenant_id = $7
     RETURNING *`,
    [
      data.title ?? null,
      data.description ?? null,
      data.fields ? JSON.stringify(data.fields) : null,
      data.button_text ?? null,
      data.allowed_origins ? JSON.stringify(data.allowed_origins) : null,
      widgetId,
      tenantId,
    ]
  );
  return result.rows[0] || null;
}

async function deleteWidget(tenantId, widgetId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM submissions WHERE widget_id = $1 AND tenant_id = $2', [widgetId, tenantId]);
    const result = await client.query(
      'DELETE FROM widgets WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [widgetId, tenantId]
    );
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createWidget, listWidgets, getWidget, getWidgetById, updateWidget, deleteWidget };