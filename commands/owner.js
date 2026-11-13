'use strict';
const { getDeveloper } = require('../lib/developerVerifier');
async function ownerCommand(sock, chatId) {
  let info;
  try { info = getDeveloper(); } catch {
    return sock.sendMessage(chatId, { text: '⚠️ Harley-MD developer information could not be verified. Please install the official update.' });
  }
  const name = info.name.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, `TEL;TYPE=CELL;waid=${info.number}:${info.number}`, 'END:VCARD'].join('\r\n');
  return sock.sendMessage(chatId, { contacts: { displayName: info.name, contacts: [{ vcard }] } });
}
module.exports = ownerCommand;
