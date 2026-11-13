const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const settings = require('../settings');
const ROOT = path.resolve(__dirname, '..');
const REPO = 'ElvisMaina2005/Harley-MD';
const MAX = 12 * 1024 * 1024;
let busy = false;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const allowed = p => /^(?:index|main|session-import)\.js$/.test(p) || /^(?:commands|lib)\/[a-zA-Z0-9_-]+\.js$/.test(p);
function version(v) { if (!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(v)) throw Error('Invalid release version'); return v.split('.').map(Number); }
function newer(a,b) { const x=version(a), y=version(b); for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i]; return false; }
async function get(url, limit) {
  const res=await fetch(url,{headers:{'User-Agent':'Harley-MD-Updater','Accept':'application/json'},signal:AbortSignal.timeout(120000)});
  if(!res.ok) throw Error(`Update server HTTP ${res.status}`);
  const chunks=[]; let size=0;
  for await(const c of res.body){size+=c.length;if(size>limit) throw Error('Update exceeds size limit');chunks.push(Buffer.from(c));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function safeTarget(rel) {
  const dest=path.join(ROOT,rel);
  let p=ROOT;
  for(const part of rel.split('/')) {p=path.join(p,part); if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw Error('Symlink in update path');}
  return dest;
}
function atomic(dest,buf) {fs.mkdirSync(path.dirname(dest),{recursive:true});const tmp=dest+'.harley-update-'+crypto.randomBytes(6).toString('hex');try{fs.writeFileSync(tmp,buf,{mode:fs.existsSync(dest)?fs.statSync(dest).mode&0o777:0o644});fs.renameSync(tmp,dest);}finally{fs.rmSync(tmp,{force:true});}}
function install(bundle, targetVersion) {
  if(bundle.version!==targetVersion||!Array.isArray(bundle.files)||!bundle.files.length||bundle.files.length>1000) throw Error('Invalid update bundle');
  if(bundle.packageSha256!==sha(fs.readFileSync(path.join(ROOT,'package.json')))) throw Error('Dependencies differ; manual upgrade required');
  const stage=fs.mkdtempSync(path.join(ROOT,'.harley-update-'));
  const backup=path.join(ROOT,'update-backups',Date.now()+'-'+crypto.randomBytes(4).toString('hex'));
  const entries=[]; const seen=new Set(); const changed=[];
  try {
    for(const f of bundle.files){
      if(typeof f.path!=='string'||!allowed(f.path)||seen.has(f.path)||typeof f.content!=='string') throw Error('Invalid update file');
      seen.add(f.path);const buf=Buffer.from(f.content,'base64');if(sha(buf)!==f.sha256) throw Error('File checksum mismatch');
      const dest=safeTarget(f.path);const staged=path.join(stage,f.path);fs.mkdirSync(path.dirname(staged),{recursive:true});fs.writeFileSync(staged,buf);
      execFileSync(process.execPath,['--check',staged],{timeout:15000,env:{PATH:process.env.PATH||''},stdio:'pipe'});
      entries.push({rel:f.path,dest,buf});
    }
    const dest=safeTarget('settings.js');const old=fs.readFileSync(dest,'utf8');
    const pattern=/(\bversion\s*:\s*)(["'])(\d+\.\d+\.\d+)\2/;
    if(!pattern.test(old)) throw Error('Cannot locate installed version');
    const updated=old.replace(pattern,(_,prefix,q)=>prefix+q+targetVersion+q);
    entries.push({rel:'settings.js',dest,buf:Buffer.from(updated)});
    fs.mkdirSync(backup,{recursive:true,mode:0o700});
    for(const e of entries){e.existed=fs.existsSync(e.dest);if(e.existed){const b=path.join(backup,e.rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(e.dest,b);}}
    fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(entries.map(e=>({path:e.rel,existed:e.existed})),null,2));
    for(const e of entries){changed.push(e);atomic(e.dest,e.buf);}
    return backup;
  }catch(err){let failed=false;for(const e of changed.reverse()){try{if(e.existed)atomic(e.dest,fs.readFileSync(path.join(backup,e.rel)));else fs.rmSync(e.dest,{force:true});}catch{failed=true;}}if(failed)throw Error('Rollback incomplete; restore update-backups manually');throw err;}finally{fs.rmSync(stage,{recursive:true,force:true});}
}
async function updateCommand(sock,chatId,message){
  const reply=text=>sock.sendMessage(chatId,{text},{quoted:message});
  if(!message.key.fromMe) return reply('Only the bot account can use .update.');
  if(busy)return reply('An update is already running.');busy=true;
  try{
    await reply('🔄 HARLEY-MD | Checking official releases…');
    const release=await get(`https://api.github.com/repos/${REPO}/releases/latest`,1024*1024);
    const latest=String(release.tag_name||'').replace(/^v/,'');const current=String(settings.version);
    if(!newer(latest,current))return await reply(`✅ Harley-MD is up to date.\nVersion: ${current}`);
    if(release.draft||release.prerelease||!Array.isArray(release.assets)||!release.assets.some(a=>a.name==='harley-update.json'))throw Error('Official update bundle not published');
    await reply(`📦 Updating Harley-MD ${current} → ${latest}…`);
    const bundle=await get(`https://github.com/${REPO}/releases/download/${encodeURIComponent(release.tag_name)}/harley-update.json`,MAX);
    const backup=install(bundle,latest);
    console.log('[UPDATE] Installed',latest,'Backup:',backup);
    if(process.env.HARLEY_UPDATE_AUTO_RESTART==='1'){
      try{await reply(`✅ Installed ${latest}. Restarting Harley-MD…`);}catch{}
      setTimeout(()=>process.exit(0),1000);
    }else await reply(`✅ Installed ${latest}. Restart the bot from your hosting panel to activate it.`);
  }catch(err){console.error('[UPDATE]',err.message);await reply('❌ Update failed. '+err.message).catch(()=>{});}finally{busy=false;}
}
module.exports=updateCommand;
