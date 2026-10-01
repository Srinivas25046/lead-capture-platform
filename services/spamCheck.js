function isSpam(widget, submittedData) {
  const honeypotField = widget.fields.find(f => f.honeypot === true);
  if (!honeypotField) return false;

  const value = submittedData[honeypotField.name];
  return typeof value === 'string' && value.trim() !== '';
}

module.exports = isSpam;