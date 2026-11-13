'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const REPO = 'ElvisMaina2005/Harley-MD';
const API = `https://api.github.com/repos/${REPO}`;
const LIMIT = 16 * 1024 * 1024;
let busy = false;
const allowed = p => /^(?:index|main|session-import|import-session|cleanup|reset-session)\.js$/.test(p) || /^(?:commands|lib)\/(?:[\w-]+\/)*[\w-]+\.js$/.test(p) || /^(?:package(?:-lock)?\.json|settings\.js)$/.test(p);
const blobHash = b => crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
function safe(rel) {
  if (!allowed(rel)) throw Error('Disallowed application path');
  let p = ROOT;
  for (const part of rel.split('/')) {
    p = path.join(p, part);
    try { if (fs.lstatSync(p).isSymbolicLink()) throw Error('Symlink in application path'); }
    catch(e) { if(e.code !== 'ENOENT') throw e; }
  }
  return p;
}
async function get(url, limit = LIMIT) {
  const res = await fetch(url, {redirect:'error', headers:{'User-Agent':'Harley-MD-Updater','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(90000)});
  if (!res.ok) throw Error(`GitHub HTTP ${res.status}`);
  const chunks=[]; let n=0;
  for await (const c of res.body) { n+=c.length; if(n>limit) throw Error('Download exceeds limit'); chunks.push(Buffer.from(c)); }
  return Buffer.concat(chunks);
}
const json = async url => JSON.parse((await get(url)).toString('utf8'));
function atomic(dest, buf) {
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  const tmp=dest+'.update-'+crypto.randomBytes(6).toString('hex');
  try { fs.writeFileSync(tmp,buf,{mode:fs.existsSync(dest)?fs.statSync(dest).mode&0o777:0o644}); fs.renameSync(tmp,dest); }
  finally { fs.rmSync(tmp,{force:true}); }
}
const versionPattern = /(\bversion\s*:\s*)(["'])(\d+\.\d+\.\d+)\2/;
function version(text) { const m=text.match(versionPattern); if(!m) throw Error('Cannot read Harley-MD version'); return m[3]; }
function environment() { const e={}; for(const k of ['PATH','HOME','USERPROFILE','SystemRoot','SYSTEMROOT','TEMP','TMP','TMPDIR','COMSPEC','PATHEXT','LANG','LC_ALL']) if(process.env[k])e[k]=process.env[k]; return e; }
function canonical(x) { return Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x; }
function dependencyConfig(b) { const p=JSON.parse(b); const fields=['dependencies','devDependencies','optionalDependencies','peerDependencies','peerDependenciesMeta','overrides','bundledDependencies','bundleDependencies','engines','os','cpu','libc','packageManager','workspaces','config']; const selected=Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]])); selected.lifecycle=Object.fromEntries(Object.entries(p.scripts||{}).filter(([k])=>['preinstall','install','postinstall','prepublish','preprepare','prepare','postprepare','dependencies'].includes(k))); return JSON.stringify(canonical(selected)); }
// Ignore only project identity metadata; retain all dependency resolution data.
function lockConfig(b) {
  const p=JSON.parse(b);
  delete p.name; delete p.version;
  if(p.packages && p.packages['']) {
    delete p.packages[''].name; delete p.packages[''].version;
  }
  return JSON.stringify(canonical(p));
}
// Only the verified optional peer addition may be deferred; retain the installed lock.
function deferredOptionalPeer(oldBuf,newBuf) {
  if(!oldBuf) return false;
  const a=JSON.parse(oldBuf), b=JSON.parse(newBuf);
  const key='node_modules/axios-cookiejar-support/node_modules/undici';
  const entry=b.packages?.[key];
  if(a.packages?.[key] || !entry || entry.version!=='6.29.1' || entry.optional!==true || entry.peer!==true) return false;
  delete b.packages[key];
  return lockConfig(oldBuf)===lockConfig(Buffer.from(JSON.stringify(b)));
}
async function installDependencies(stage) {
  const logs=path.join(stage,'.npm-diagnostics');
  fs.mkdirSync(logs,{recursive:true});
  try {
    await run('npm',['ci','--no-audit','--no-fund','--loglevel=verbose','--logs-dir='+logs],{cwd:stage,env:environment(),timeout:600000,maxBuffer:8*1024*1024});
  } catch(e) {
    console.error('[UPDATE] npm exit:',e.code,'signal:',e.signal,'killed:',e.killed);
    const output=[e.stderr,e.stdout].filter(Boolean).map(String).join('\n');
    let debug='';
    try {
      const files=fs.readdirSync(logs).filter(n=>n.endsWith('.log')).sort();
      if(files.length) debug=fs.readFileSync(path.join(logs,files[files.length-1]),'utf8');
    } catch {}
    // Do not print arbitrary npm output: it may contain credentials or URLs.
    const lines=(output+'\n'+debug).split(/\r?\n/);
    const codes=[...new Set(lines.flatMap(line=>line.match(/\b(?:EUSAGE|ENOSPC|ENOMEM|EACCES|EPERM|ERESOLVE|EBADENGINE|EINTEGRITY|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|E404|E401|E403|ELIFECYCLE|E2BIG|ERR_[A-Z_]+)\b/g)||[]))];
    console.error('[UPDATE] npm diagnostic codes:',codes.join(', ')||'none found');
    const reason=codes.join(', ')||String(e.signal||e.code||'unknown');
    throw Error('Dependency installation failed ('+reason+'). Existing files preserved. Check server console.');
  }
}
async function plan() {
  const commit=await json(`${API}/commits/main`);
  const sha=commit.sha; const treeSha=commit.commit?.tree?.sha;
  if(!/^[a-f0-9]{40}$/.test(sha)||!/^[a-f0-9]{40}$/.test(treeSha)) throw Error('Invalid GitHub commit');
  const tree=await json(`${API}/git/trees/${treeSha}?recursive=1`);
  if(tree.truncated||!Array.isArray(tree.tree)) throw Error('Incomplete GitHub tree');
  const entries=[]; let total=0; const seen=new Set();
  for(const f of tree.tree) {
    if(!allowed(f.path)) continue;
    if(f.type!=='blob'||!['100644','100755'].includes(f.mode)||! /^[a-f0-9]{40}$/.test(f.sha)||seen.has(f.path)) throw Error('Invalid application file in GitHub');
    seen.add(f.path); const dest=safe(f.path); const exists=fs.existsSync(dest);
    const old=exists?fs.readFileSync(dest):null;
    if(old&&blobHash(old)===f.sha) continue;
    if(!Number.isSafeInteger(f.size)||f.size<0||f.size>LIMIT||total+f.size>64*1024*1024) throw Error('Update too large');
    total+=f.size;
    const buf=await get(`https://raw.githubusercontent.com/${REPO}/${sha}/${f.path.split('/').map(encodeURIComponent).join('/')}`);
    if(blobHash(buf)!==f.sha||buf.length!==f.size) throw Error('GitHub file integrity mismatch');
    let next=buf;
    if(f.path==='settings.js') {
      if(!old) throw Error('Local settings.js missing');
      const text=old.toString('utf8'); version(text); const v=version(buf.toString('utf8'));
      next=Buffer.from(text.replace(versionPattern,(_,prefix,q)=>prefix+q+v+q));
    }
    if(f.path==='package.json' && old) {
      const local=JSON.parse(old), remote=JSON.parse(next);
      if(Object.hasOwn(local,'main')) remote.main=local.main; else delete remote.main;
      for(const k of ['start','start:optimized']) {
        if(Object.hasOwn(local.scripts||{},k)) {remote.scripts ||= {}; remote.scripts[k]=local.scripts[k];}
        else if(remote.scripts) delete remote.scripts[k];
      }
      if(JSON.stringify(canonical(local))===JSON.stringify(canonical(remote))) continue;
      next=Buffer.from(JSON.stringify(remote,null,2)+'\n');
    }
    if(old&&old.equals(next))continue;
    entries.push({rel:f.path,dest,old,buf:next});
  }
  if(!seen.has('package.json')||!seen.has('settings.js')||!seen.has('commands/update.js')) throw Error('Incomplete Harley-MD source tree');
  const pkg=entries.find(e=>e.rel==='package.json');
  const lock=entries.find(e=>e.rel==='package-lock.json');
  if(lock && (!pkg || (pkg.old && dependencyConfig(pkg.old)===dependencyConfig(pkg.buf))) && deferredOptionalPeer(lock.old,lock.buf)) {
    console.log('[UPDATE] Deferring verified optional peer addition; keeping local lock file');
    entries.splice(entries.indexOf(lock),1);
  }
  return {sha,entries,hasLock:seen.has('package-lock.json')};
}
async function install(plan) {
  const {entries,hasLock}=plan;
  const stage=fs.mkdtempSync(path.join(ROOT,'.harley-stage-'));
  const backup=path.join(ROOT,'update-backups',Date.now()+'-'+crypto.randomBytes(4).toString('hex'));
  const changed=[]; let movedOld=false,movedNew=false;
  const modules=path.join(ROOT,'node_modules');
  try {
    const pkg=entries.find(e=>e.rel==='package.json');
    const lock=entries.find(e=>e.rel==='package-lock.json');
    const deps=Boolean((lock&&(!lock.old||lockConfig(lock.old)!==lockConfig(lock.buf)))||(pkg&&(!pkg.old||dependencyConfig(pkg.old)!==dependencyConfig(pkg.buf))));
    console.log('[UPDATE] Dependency installation required:',deps,'package changed:',!!pkg,'lock changed:',!!lock);
    for(const e of entries) {
      const dest=path.join(stage,e.rel); fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,e.buf);
      if(e.rel.endsWith('.js')) await run(process.execPath,['--check',dest],{env:environment(),timeout:20000,maxBuffer:1024*1024});
      else JSON.parse(e.buf);
    }
    if(deps) {
      if(process.platform==='win32') throw Error('Dependency updates must run on the Linux hosting panel');
      if(!hasLock) throw Error('Publish a matching package-lock.json before updating dependencies');
      for(const rel of ['package.json','package-lock.json']) {
        const dest=path.join(stage,rel);if(!fs.existsSync(dest))fs.copyFileSync(safe(rel),dest);
      }
      await installDependencies(stage);
      if(!fs.existsSync(path.join(stage,'node_modules'))) throw Error('Dependency installation incomplete');
    }
    fs.mkdirSync(backup,{recursive:true,mode:0o700});
    for(const e of entries) if(e.old){const dest=path.join(backup,e.rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,e.old,{mode:0o600});}
    fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({commit:plan.sha,files:entries.map(e=>({path:e.rel,existed:!!e.old})),dependencies:deps},null,2));
    if(deps) {
      if(fs.existsSync(modules)){fs.renameSync(modules,path.join(backup,'node_modules'));movedOld=true;}
      fs.renameSync(path.join(stage,'node_modules'),modules);movedNew=true;
    }
    for(const e of entries){changed.push(e);atomic(e.dest,e.buf);}
    return backup;
  } catch(e) {
    let failed=false;
    for(const f of changed.reverse())try{if(f.old)atomic(f.dest,f.old);else fs.rmSync(f.dest,{force:true});}catch{failed=true;}
    try{if(movedNew)fs.renameSync(modules,path.join(stage,'failed-node_modules'));if(movedOld)fs.renameSync(path.join(backup,'node_modules'),modules);}catch{failed=true;}
    if(failed)throw Error('Rollback incomplete; restore update-backups manually');
    throw e;
  } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
async function updateCommand(sock,chatId,message) {
  const reply=text=>sock.sendMessage(chatId,{text},{quoted:message});
  if(!message.key.fromMe||!/@(?:s\.whatsapp\.net|lid)$/.test(chatId))return reply('Use .update from the bot account in a private chat.');
  if(busy)return reply('An update is already running.');busy=true;
  let restarting=false;
  try {
    await reply('🔄 HARLEY-MD | Checking GitHub main…');
    const p=await plan();
    if(!p.entries.length)return await reply(`✅ Harley-MD is up to date.\nCommit: ${p.sha.slice(0,7)}`);
    const added=p.entries.filter(e=>!e.old).length;
    await reply(`📦 HARLEY-MD UPDATE\nModified: ${p.entries.length-added}\nNew: ${added}\nCommit: ${p.sha.slice(0,7)}\nInstalling…`);
    const backup=await install(p);
    console.log('[UPDATE] Installed',p.sha,'Backup:',backup);
    const v=version(fs.readFileSync(safe('settings.js'),'utf8'));
    if(process.env.HARLEY_UPDATE_AUTO_RESTART==='1'){
      restarting=true;
      try{await reply(`✅ Installed Harley-MD ${v}.\nFiles updated: ${p.entries.length}\nRestarting…`);}catch{}
      setTimeout(()=>process.exit(0),1000);
    }else await reply(`✅ Installed Harley-MD ${v}.\nFiles updated: ${p.entries.length}\nRestart from your hosting panel to activate.`);
  }catch(e){console.error('[UPDATE]',e.message);await reply('❌ Update failed. '+(e.code==='ENOENT'?'Required file or npm executable missing.':String(e.message).slice(0,500))).catch(()=>{});}
  finally{if(!restarting)busy=false;}
}
module.exports=updateCommand;
