const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');

const WIDGET_VERSION = 'v1';

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/widget.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

app.use(require('./routes/tenants'));
app.use(require('./routes/public'));
app.use(require('./routes/widgets'));

app.listen(3000, () => console.log('Server running on http://localhost:3000'));