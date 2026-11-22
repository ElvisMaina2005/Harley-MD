'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');
const root = path.resolve(__dirname, '..');
const keyDir = path.join(os.homedir(), '.harley-md-signing');
const keyPath = path.join(keyDir, 'developer-private.pem');
const publicPath = path.join(root, 'lib', 'developerPublicKey.js');
const dataPath = path.join(root, 'lib', 'developer.js');
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async prompt => { process.stdout.write(prompt); const result = await lines.next(); if (result.done) throw Error('Input ended'); return result.value; };
  let name, number;
  try { name = (await ask('Official developer name: ')).trim(); number = (await ask('Official contact (country code, digits only): ')).trim(); } finally { rl.close(); }
  if (!name || name.length > 100 || /[\r\n]/.test(name) || !/^\d{7,15}$/.test(number)) throw Error('Invalid name or phone number');
  fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(keyPath)) {
    if (fs.existsSync(publicPath)) throw Error('Existing public key found. Restore your original private key; do not generate a replacement.');
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
  }
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  const publicSource = `'use strict';\nmodule.exports = ${JSON.stringify(publicKey)};\n`;
  if (fs.existsSync(publicPath) && fs.readFileSync(publicPath, 'utf8').replace(/\r\n/g, '\n') !== publicSource) throw Error('Public key mismatch. Restore the official key before signing.');
  const bytes = Buffer.from(JSON.stringify({ project: 'Harley-MD', name, number }));
  const signature = crypto.sign(null, bytes, privateKey).toString('base64');
  const payload = bytes.toString('base64');
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(publicPath, publicSource);
  fs.writeFileSync(dataPath, `'use strict';\nmodule.exports = Object.freeze(${JSON.stringify({ payload, signature }, null, 2)});\n`);
  console.log('Signed developer configuration generated. Private key stays at: ' + keyPath);
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
