const crypto = require('node:crypto');

function sha256Hex(input) {
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

module.exports = { sha256Hex };
