'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes,createHash} = require('node:crypto');
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9_-]{16,100}$/;
const hash = s => createHash('sha256').update(s).digest('hex');
function ticketFromSession(value) {
  try {
    if (!value?.startsWith('HARLEY-MD:~')) return null;
    const p = JSON.parse(Buffer.from(value.slice('HARLEY-MD:~'.length),'base64').toString('utf8'));
    const r = p.metadata?.analyticsRegistration;
    return p.version===1 && p.format==='baileys-multi-file' && r?.consent===true && HEX.test(r.ticket) ? r.ticket : null;
  } catch { return null; }
}
function createRegistration({env=process.env, file=path.join(__dirname,'../data/analytics-registration.json'), request=globalThis.fetch}={}) {
  let active=null, pending=null;
  const enabled=()=>env.ANALYTICS_ENABLED==='1' && env.ANALYTICS_AUTO_REGISTER==='1';
  function origin() {
    const u=new URL(env.ANALYTICS_API_URL);
    if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' || u.search || u.hash) throw Error('invalid origin');
    return u.origin;
  }
  function read() { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch(e) { if(e.code==='ENOENT') return null; throw e; } }
  function write(value) {
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
    const tmp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
    try { fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'}); fs.renameSync(tmp,file); }
    finally { if(fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  }
  async function register() {
    if(!enabled()) return null;
    const base=origin();
    let state=read();
    if(state && (state.base!==base || !HEX.test(state.token))) throw Error('invalid stored credentials');
    if(state?.id) {
      if(!ID.test(state.id)) throw Error('invalid stored ID');
      console.log(`[REGISTRATION] Reusing saved registration (instance ...${state.id.slice(-12)})`);
      return active={base,id:state.id,token:state.token};
    }
    const ticket=ticketFromSession(env.SESSION_ID?.trim());
    if(!ticket) { console.warn('[REGISTRATION] No consent ticket; analytics inactive. Generate a fresh opted-in session.'); return null; }
    if(!state || state.ticketHash!==hash(ticket)) {
      console.log('[REGISTRATION] New session ticket detected; starting registration');
      state={base,token:randomBytes(32).toString('hex'),ticketHash:hash(ticket)};
      write(state); // persist before network request, allowing idempotent retries
    } else {
      console.log('[REGISTRATION] Resuming registration for saved session ticket');
    }
    const res=await request(base+'/api/registration/redeem',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket,tokenHash:hash(state.token)}),signal:AbortSignal.timeout(25000)});
    if(!res.ok) { if(res.body) await res.body.cancel().catch(()=>{}); console.warn(`[REGISTRATION] Request rejected (${res.status})`); return null; }
    const result=await res.json();
    if(!ID.test(result.instanceId || '')) throw Error('invalid response');
    const saved={base,id:result.instanceId,token:state.token};
    write(saved);
    console.log('[REGISTRATION] Instance registered successfully');
    return active=saved;
  }
  function diagnostics() {
    return {
      enabled: enabled(),
      registrationFileExists: fs.existsSync(file),
      consentTicketPresent: !!ticketFromSession(env.SESSION_ID?.trim())
    };
  }
  return {config:()=>enabled()?active:null, diagnostics, ensure(){
    if(!enabled()) return Promise.resolve(null);
    if(!pending) pending=register().catch(()=>{console.warn('[REGISTRATION] Registration unavailable; bot continues');return null;}).finally(()=>{pending=null;});
    return pending;
  }};
}
const instance=createRegistration();
module.exports={...instance,createRegistration,ticketFromSession};
