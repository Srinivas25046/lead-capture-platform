const { createTenant } = require('./services/auth');
const { createWidget } = require('./services/widgets');

async function seed() {
  const tenant = await createTenant('Demo Corp');
  console.log('Created tenant, API key:', tenant.api_key);

  const widget = await createWidget(tenant.id, {
    type: 'signup_form',
    title: 'Join our newsletter',
    fields: [
      { name: 'email', type: 'email', required: true },
      { name: 'website', type: 'text', required: false, honeypot: true },
    ],
    allowed_origins: ['http://localhost:5500'],
  });
  console.log('Created widget, id:', widget.id);
}

seed();