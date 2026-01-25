const crypto = require('node:crypto');

function pad2(num) {
  return String(num).padStart(2, '0');
}

function pad3(num) {
  return String(num).padStart(3, '0');
}

function generateRunId(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hours = pad2(date.getUTCHours());
  const minutes = pad2(date.getUTCMinutes());
  const seconds = pad2(date.getUTCSeconds());
  const millis = pad3(date.getUTCMilliseconds());
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${millis}Z_${suffix}`;
}

module.exports = { generateRunId };
