const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/widget.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(__dirname, 'public', 'widget.js'));
});

app.use(require('./routes/tenants'));
app.use(require('./routes/public'));
app.use(require('./routes/widgets'));
app.use(require('./routes/dashboard'));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large (max 10kb)' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));