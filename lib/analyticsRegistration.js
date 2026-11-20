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
    return p.version===1 && p.format==='baileys-multi-file' && r?.consent===true && HEX.test(r.ticket) && Number.isFinite(r.issuedAt) && Number.isFinite(r.expiresAt) && r.issuedAt <= Date.now() && r.expiresAt > r.issuedAt && r.expiresAt > Date.now() ? r.ticket : null;
  } catch { return null; }
}

function createRegistration({
  env=process.env,
  file=path.join(__dirname,'../data/analytics-registration.json'),
  consentFile=path.join(__dirname,'../data/analytics-consent-ticket.json'),
  request=globalThis.fetch,
  now=Date.now
}={}) {
  let active=null, pending=null;

  function readJson(target) {
    try { return JSON.parse(fs.readFileSync(target,'utf8')); }
    catch(e) { if(e.code==='ENOENT') return null; throw e; }
  }

  function read() { return readJson(file); }

  function write(target,value) {
    fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
    const tmp=target+'.'+randomBytes(8).toString('hex')+'.tmp';
    try {
      fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});
      fs.renameSync(tmp,target);
    } finally {
      if(fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  }

  function currentSession() {
    return env.SESSION_ID?.trim() || '';
  }

  function sessionHash() {
    const value=currentSession();
    return value ? hash(value) : null;
  }

  function ticketFromImportedSession() {
    const value=currentSession();
    if(!value) return null;
    let saved;
    try { saved=readJson(consentFile); } catch { return null; }
    if(!saved || !HEX.test(saved.ticket || '') || saved.sessionHash!==hash(value)) return null;
    if(!Number.isFinite(saved.issuedAt) || !Number.isFinite(saved.expiresAt) ||
      saved.expiresAt<=saved.issuedAt || now()<saved.issuedAt || now()>=saved.expiresAt) return null;
    return saved.ticket;
  }

  function getTicket() {
    return ticketFromSession(currentSession()) || ticketFromImportedSession();
  }

  function origin() {
    const u=new URL(env.ANALYTICS_API_URL);
    if(u.protocol!=='https:' || u.username || u.password || u.pathname!=='/' || u.search || u.hash) throw Error('invalid origin');
    return u.origin;
  }

  function savedRegistrationMatches(state,currentHash) {
    return !!state?.id && ID.test(state.id) &&
      HEX.test(state.token || '') &&
      !!currentHash && state.sessionHash===currentHash;
  }

  function enabled() {
    if(env.ANALYTICS_ENABLED!=='1') return false;
    if(env.ANALYTICS_AUTO_REGISTER==='1' || !!getTicket()) return true;
    try {
      return savedRegistrationMatches(read(),sessionHash());
    } catch {
      return false;
    }
  }

  async function register() {
    if(!enabled()) return null;

    const base=origin();
    const currentHash=sessionHash();
    const ticket=getTicket();
    let state=read();

    if(state && (state.base!==base || !HEX.test(state.token || ''))) {
      throw Error('invalid stored credentials');
    }

    if(state?.id) {
      if(!ID.test(state.id)) throw Error('invalid stored ID');

      if(savedRegistrationMatches(state,currentHash)) {
        if(!ticket || state.ticketHash===hash(ticket)) {
          console.log(`[REGISTRATION] Reusing saved registration (instance ...${state.id.slice(-12)})`);
          return active={base,id:state.id,token:state.token,ticketHash:state.ticketHash,sessionHash:state.sessionHash};
        }
      }

      console.log('[REGISTRATION] Different session detected; creating a separate instance registration');
      state=null;
    }

    if(!ticket) {
      console.warn('[REGISTRATION] No valid consent ticket; analytics inactive. Generate a fresh opted-in session.');
      return null;
    }

    if(!state || state.ticketHash!==hash(ticket) || state.sessionHash!==currentHash) {
      console.log('[REGISTRATION] New session ticket detected; starting registration');
      state={
        base,
        token:randomBytes(32).toString('hex'),
        ticketHash:hash(ticket),
        sessionHash:currentHash
      };
      write(file,state);
    } else {
      console.log('[REGISTRATION] Resuming registration for saved session ticket');
    }

    const res=await request(base+'/api/registration/redeem',{
      method:'POST',
      redirect:'error',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ticket,tokenHash:hash(state.token)}),
      signal:AbortSignal.timeout(25000)
    });

    if(!res.ok) {
      if(res.body) await res.body.cancel().catch(()=>{});
      console.warn(`[REGISTRATION] Request rejected (${res.status})`);
      return null;
    }

    const result=await res.json();
    if(!ID.test(result.instanceId || '')) throw Error('invalid response');

    const saved={
      base,
      id:result.instanceId,
      token:state.token,
      ticketHash:hash(ticket),
      sessionHash:currentHash
    };

    write(file,saved);
    console.log('[REGISTRATION] Instance registered successfully');
    return active=saved;
  }

  function diagnostics() {
    return {
      enabled:enabled(),
      registrationFileExists:fs.existsSync(file),
      consentTicketPresent:!!getTicket()
    };
  }

  return {
    config:()=>enabled()?active:null,
    diagnostics,
    ensure() {
      if(!enabled()) return Promise.resolve(null);
      if(!pending) {
        pending=register()
          .catch(()=>{
            console.warn('[REGISTRATION] Registration unavailable; bot continues');
            return null;
          })
          .finally(()=>{pending=null;});
      }
      return pending;
    }
  };
}

const instance=createRegistration();
module.exports={
  ...instance,
  createRegistration,
  ticketFromSession
};
