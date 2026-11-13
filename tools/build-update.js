const fs=require('fs');const path=require('path');const crypto=require('crypto');const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const v=process.argv[2];const files=process.argv.slice(3);
if(!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v||'')||!files.length)throw Error('Usage: node tools/build-update.js 3.0.9 commands/update.js lib/example.js');
const settings=fs.readFileSync(path.join(root,'settings.js'),'utf8');if(settings.match(/\bversion\s*:\s*["'](\d+\.\d+\.\d+)["']/)?.[1]!==v)throw Error('Set settings.js version to release version first');
const allowed=p=>/^(?:index|main|session-import)\.js$/.test(p)||/^(?:commands|lib)\/[a-zA-Z0-9_-]+\.js$/.test(p);
const entries=[...new Set(files)].map(p=>{if(!allowed(p))throw Error('Unsupported path: '+p);const f=path.join(root,p);if(!fs.lstatSync(f).isFile())throw Error('Not a regular file');execFileSync(process.execPath,['--check',f],{stdio:'inherit'});const b=fs.readFileSync(f);return {path:p,sha256:sha(b),content:b.toString('base64')};});
const output=JSON.stringify({version:v,packageSha256:sha(fs.readFileSync(path.join(root,'package.json'))),files:entries});if(Buffer.byteLength(output)>12*1024*1024)throw Error('Bundle too large');fs.writeFileSync(path.join(root,'harley-update.json'),output);console.log('Created harley-update.json');
