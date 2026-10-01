const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(require('./routes/tenants'));

app.listen(3000, () => console.log('Server running on http://localhost:3000'));