'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const API = 'https://api.github.com/repos/ElvisMaina2005/Harley-MD';
const RAW = 'https://raw.githubusercontent.com/ElvisMaina2005/Harley-MD';
const STATE = path.join(ROOT, 'data', 'update-notifications.json');
const PERIOD = 6 * 60 * 60 * 1000;
const allowed = p => /^(?:index|main|session-import|import-session|cleanup|reset-session)\.js$/.test(p) || /^(?:commands|lib)\/(?:[\w-]+\/)*[\w-]+\.js$/.test(p) || /^(?:package(?:-lock)?\.json|settings\.js)$/.test(p);
const hash = b => crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const version = s => s.match(/\bversion\s*:\s*(["'])(\d+\.\d+\.\d+)\1/)?.[2];
const shaOK = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);
let active = null;
async function get(url, max = 16 * 1024 * 1024) {
  const r = await fetch(url, {redirect:'error', headers:{'User-Agent':'Harley-MD-Notifier','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if (!r.ok) throw Error(`GitHub HTTP ${r.status}`);
  const chunks=[]; let size=0;
  for await (const c of r.body) { size+=c.length; if(size>max) throw Error('Response too large'); chunks.push(Buffer.from(c)); }
  return Buffer.concat(chunks);
}
const json = async u => JSON.parse((await get(u)).toString('utf8'));
function local(rel) {
  let p=ROOT;
  for(const part of rel.split('/')) {
    p=path.join(p,part);
    try { if(fs.lstatSync(p).isSymbolicLink()) throw Error('Symlink in application path'); }
    catch(e) { if(e.code==='ENOENT') return null; throw e; }
  }
  return fs.readFileSync(p);
}
function readState() { try { return JSON.parse(fs.readFileSync(STATE,'utf8')); } catch(e) { if(e.code==='ENOENT') return {}; throw e; } }
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE),{recursive:true});
  const tmp=STATE+'.'+crypto.randomBytes(6).toString('hex');
  try { fs.writeFileSync(tmp,JSON.stringify(s),{mode:0o600}); fs.renameSync(tmp,STATE); }
  finally { fs.rmSync(tmp,{force:true}); }
}
async function check(ctx) {
  if(active!==ctx || ctx.busy) return;
  ctx.busy=true;
  try {
    const c=await json(API+'/commits/main');
    const sha=c.sha, treeSha=c.commit?.tree?.sha;
    if(!shaOK(sha)||!shaOK(treeSha)) throw Error('Invalid commit');
    const state=readState();
    if(state[ctx.jid]===sha) return;
    const t=await json(API+'/git/trees/'+treeSha+'?recursive=1');
    if(t.truncated||!Array.isArray(t.tree)) throw Error('Incomplete tree');
    const settings=local('settings.js');
    const current=version(settings?.toString('utf8')||'');
    const remote=await get(RAW+'/'+sha+'/settings.js');
    const latest=version(remote.toString('utf8'));
    if(!current||!latest) throw Error('Cannot read version');
    let changed=0, added=0;
    const seen=new Set();
    for(const f of t.tree) {
      if(!allowed(f.path)) continue;
      if(f.type!=='blob'||!['100644','100755'].includes(f.mode)||!shaOK(f.sha)||seen.has(f.path)) throw Error('Invalid application tree');
      seen.add(f.path);
      const b=local(f.path);
      if(f.path==='settings.js') { if(hash(remote)!==f.sha) throw Error('Settings integrity mismatch'); if(current!==latest) changed++; continue; }
      if(!b) added++; else if(hash(b)!==f.sha) changed++;
    }
    if(!['settings.js','package.json','commands/update.js'].every(p=>seen.has(p))) throw Error('Incomplete source tree');
    if(!changed&&!added) return;
    if(active!==ctx) return;
    const summary=String(c.commit?.message||'No commit description').replace(/[\r\n]+/g,' ').slice(0,240);
    const date=String(c.commit?.committer?.date||'').slice(0,10);
    await ctx.sock.sendMessage(ctx.jid,{text:`🚀 *HARLEY-MD | UPDATE AVAILABLE*\n\n📦 Installed version: ${current}\n🆕 GitHub version: ${latest}\n📅 Commit date: ${date||'Unknown'}\n🔖 Commit: ${sha.slice(0,7)}\n📂 Modified: ${changed} | New: ${added}\n\n*Latest commit:* ${summary}\n\nSend *.update* to install.\nRestart manually from your hosting panel to activate changes.\n\n_Powered by Harley-MD_`});
    state[ctx.jid]=sha; saveState(state);
    console.log('[UPDATE-NOTIFIER] Owner notified:',sha.slice(0,7));
  } catch(e) { console.warn('[UPDATE-NOTIFIER]',String(e.message).slice(0,200)); }
  finally { ctx.busy=false; }
}
function stopUpdateNotifier(sock) {
  if(!active || (sock && active.sock!==sock)) return;
  clearTimeout(active.first); clearInterval(active.timer); active=null;
}
function startUpdateNotifier(sock) {
  stopUpdateNotifier();
  if(process.env.HARLEY_UPDATE_NOTIFY==='0') return;
  const jid=String(sock?.user?.id||'').replace(/:\d+@/,'@');
  if(!/^\d+@(?:s\.whatsapp\.net|lid)$/.test(jid)) return;
  const ctx={sock,jid,busy:false}; active=ctx;
  ctx.first=setTimeout(()=>check(ctx),30000); ctx.timer=setInterval(()=>check(ctx),PERIOD);
  ctx.first.unref(); ctx.timer.unref();
  console.log('[UPDATE-NOTIFIER] Active | every 6 hours');
}
module.exports={startUpdateNotifier,stopUpdateNotifier};
