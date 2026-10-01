const express = require('express');
const router = express.Router();
const widgetCors = require('../services/cors');

router.get('/widgets/:id/config', widgetCors, (req, res) => {
  res.json({
    id: req.widget.id,
    type: req.widget.type,
    title: req.widget.title,
    description: req.widget.description,
    fields: req.widget.fields,
    button_text: req.widget.button_text,
  });
});

module.exports = router;