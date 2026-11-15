'use strict';
const crypto = require('crypto');
function getDeveloper() {
  const { payload, signature } = require('./developer');
  const publicKey = require('./developerPublicKey');
  const bytes = Buffer.from(payload, 'base64');
  if (!crypto.verify(null, bytes, publicKey, Buffer.from(signature, 'base64'))) {
    throw new Error('Developer signature verification failed');
  }
  const info = JSON.parse(bytes.toString('utf8'));
  if (info.project !== 'Harley-MD' || typeof info.name !== 'string' || !info.name.trim() || /[\r\n]/.test(info.name) || !/^\d{7,15}$/.test(info.number)) throw new Error('Invalid developer configuration');
  return Object.freeze(info);
}
module.exports = { getDeveloper };
