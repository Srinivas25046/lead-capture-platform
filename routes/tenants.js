const express = require('express');
const router = express.Router();
const { createTenant } = require('../services/auth');

router.post('/tenants', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required' });
  }

  const tenant = await createTenant(name.trim());
  res.status(201).json(tenant); // { id, name, api_key } — the ONLY time api_key is ever shown
});

module.exports = router;