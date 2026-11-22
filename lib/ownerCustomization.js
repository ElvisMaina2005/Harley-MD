const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settings = require('../settings');
const file = path.join(__dirname, '../data/owner-customization.json');
const defaultChannel = 'https://whatsapp.com/channel/0029VbF1pVnInlqWtDAR6O0Q';
const clean = (v, max) => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f*_~`\u202a-\u202e\u2066-\u2069]/g, ' ').trim().slice(0,max) : '';
const validPrefix = v => typeof v === 'string' && /^[.!#?$%&+\-:;]$/.test(v);
const validChannel = v => typeof v === 'string' && /^https:\/\/whatsapp\.com\/channel\/[A-Za-z0-9]{10,100}$/.test(v);
function read() { let d = {}; try { d = JSON.parse(fs.readFileSync(file,'utf8')) || {}; } catch(e) { if(e.code !== 'ENOENT') throw e; } return {name:clean(d.name,60)||settings.botName||'Harley-MD',owner:clean(d.owner,60)||settings.botOwner||'Harley-MD User',footer:clean(d.footer,120)||'POWERED BY HARLEY-MD',prefix:validPrefix(d.prefix)?d.prefix:'.',channel:validChannel(d.channel)?d.channel:defaultChannel,silent:d.silent===true}; }
function change(key,value) { const d=read(); d[key]=value; fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.'+crypto.randomUUID()+'.tmp'; try {fs.writeFileSync(tmp,JSON.stringify(d,null,2),{mode:0o600});fs.renameSync(tmp,file);} finally {try{fs.unlinkSync(tmp);}catch{}} return read(); }
module.exports={read,change,clean,validPrefix,validChannel,defaultChannel};
