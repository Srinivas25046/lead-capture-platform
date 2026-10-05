(function () {
  const script = document.currentScript;
  const widgetId = new URL(script.src).searchParams.get('id');
  const apiBase = new URL(script.src).origin;

  fetch(`${apiBase}/widgets/${widgetId}/config`)
    .then(res => res.json())
    .then(config => renderWidget(config, apiBase, widgetId))
    .catch(err => console.error('Widget failed to load:', err));

  function renderWidget(config, apiBase, widgetId) {
    const container = document.createElement('div');
    container.style.cssText = 'border:1px solid #ddd; padding:16px; max-width:320px; font-family:sans-serif;';

    const title = document.createElement('h3');
    title.textContent = config.title;
    container.appendChild(title);

    if (config.description) {
      const desc = document.createElement('p');
      desc.textContent = config.description;
      container.appendChild(desc);
    }

    const form = document.createElement('form');
    const fieldValues = {};

    config.fields.forEach(field => {
      const input = document.createElement('input');
      input.type = field.type === 'email' ? 'email' : 'text';
      input.name = field.name;
      input.placeholder = field.name;
      input.required = field.required && !field.honeypot;

      if (field.honeypot) {
        input.style.cssText = 'position:absolute; left:-9999px;';
        input.tabIndex = -1;
        input.autocomplete = 'off';
      }

      form.appendChild(input);
      fieldValues[field.name] = input;
    });

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = config.button_text;
    form.appendChild(button);

    const status = document.createElement('p');
    container.appendChild(form);
    container.appendChild(status);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = {};
      Object.keys(fieldValues).forEach(name => {
        data[name] = fieldValues[name].value;
      });

      fetch(`${apiBase}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widget_id: widgetId, data }),
      })
        .then(res => res.json())
        .then(result => {
          status.textContent = 'Thanks for submitting!';
          form.style.display = 'none';
        })
        .catch(() => {
          status.textContent = 'Something went wrong. Please try again.';
        });
    });

    document.currentScript.parentNode.insertBefore(container, document.currentScript);
  }
})();