const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {createRegistration,ticketFromSession}=require('../lib/analyticsRegistration');
const ticket='a'.repeat(64), id='12345678-1234-1234-1234-123456789012';
const session=consent=>'HARLEY-MD:~'+Buffer.from(JSON.stringify({version:1,format:'baileys-multi-file',metadata:{analyticsRegistration:{ticket,consent,issuedAt:Date.now()-60000,expiresAt:Date.now()+840000}}})).toString('base64');
function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'harley-reg-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return {file:path.join(dir,'data','registration.json'),env:{ANALYTICS_ENABLED:'1',ANALYTICS_AUTO_REGISTER:'1',ANALYTICS_API_URL:'https://example.com',SESSION_ID:session(true)}};}
test('requires consent',()=>{assert.equal(ticketFromSession(session(false)),null);assert.equal(ticketFromSession(session(true)),ticket);});
test('registers once and reuses credentials after restart',async t=>{const o=setup(t);let calls=0;const request=async(url,opts)=>{calls++;assert.equal(url,'https://example.com/api/registration/redeem');const b=JSON.parse(opts.body);assert.equal(b.ticket,ticket);assert.match(b.tokenHash,/^[a-f0-9]{64}$/);return {ok:true,json:async()=>({instanceId:id})};};const a=createRegistration({...o,request});const [x,y]=await Promise.all([a.ensure(),a.ensure()]);assert.deepEqual(x,y);assert.equal(x.id,id);assert.deepEqual(await createRegistration({...o,request}).ensure(),x);assert.equal(calls,1);});
test('retry retains token hash',async t=>{const o=setup(t);let hashes=[];const request=async(u,v)=>{hashes.push(JSON.parse(v.body).tokenHash);if(hashes.length===1)throw Error();return {ok:true,json:async()=>({instanceId:id})};};assert.equal(await createRegistration({...o,request}).ensure(),null);assert.equal((await createRegistration({...o,request}).ensure()).id,id);assert.equal(hashes[0],hashes[1]);});
test('disabled or missing consent never requests',async t=>{const o=setup(t);const request=()=>assert.fail('unexpected request');o.env.SESSION_ID=session(false);assert.equal(await createRegistration({...o,request}).ensure(),null);o.env.ANALYTICS_ENABLED='0';assert.equal(await createRegistration({...o,request}).ensure(),null);});

const {createHash}=require('node:crypto');
const sessionHash=value=>createHash('sha256').update(value).digest('hex');

test('registers using a valid imported consent ticket',async t=>{
  const o=setup(t);
  const consentFile=path.join(path.dirname(o.file),'consent.json');
  const sessionId='remote-session-reference-one';
  const now=1800000000000;
  o.env.SESSION_ID=sessionId;
  o.env.ANALYTICS_AUTO_REGISTER='0';
  fs.mkdirSync(path.dirname(consentFile),{recursive:true});
  fs.writeFileSync(consentFile,JSON.stringify({
    ticket,
    sessionHash:sessionHash(sessionId),
    issuedAt:now-60000,
    expiresAt:now+840000
  }));
  let calls=0;
  const request=async()=>{calls++;return {ok:true,json:async()=>({instanceId:id})};};
  const result=await createRegistration({...o,consentFile,now:()=>now,request}).ensure();
  assert.equal(result.id,id);
  assert.equal(calls,1);
});

test('rejects an expired imported consent ticket',async t=>{
  const o=setup(t);
  const consentFile=path.join(path.dirname(o.file),'consent.json');
  const sessionId='remote-session-reference-expired';
  const now=1800000000000;
  o.env.SESSION_ID=sessionId;
  o.env.ANALYTICS_AUTO_REGISTER='0';
  fs.mkdirSync(path.dirname(consentFile),{recursive:true});
  fs.writeFileSync(consentFile,JSON.stringify({
    ticket,
    sessionHash:sessionHash(sessionId),
    issuedAt:now-16*60*1000,
    expiresAt:now-1
  }));
  const request=()=>assert.fail('expired ticket must not be redeemed');
  const registration=createRegistration({...o,consentFile,now:()=>now,request});
  assert.equal(registration.diagnostics().consentTicketPresent,false);
  assert.equal(await registration.ensure(),null);
});

test('a different session receives a separate instance registration',async t=>{
  const o=setup(t);
  const consentFile=path.join(path.dirname(o.file),'consent.json');
  const now=1800000000000;
  o.env.ANALYTICS_AUTO_REGISTER='0';
  const firstSession='remote-session-reference-first';
  const secondSession='remote-session-reference-second';
  const saveTicket=(sessionId,value)=>fs.writeFileSync(consentFile,JSON.stringify({
    ticket:value,
    sessionHash:sessionHash(sessionId),
    issuedAt:now-60000,
    expiresAt:now+840000
  }));
  fs.mkdirSync(path.dirname(consentFile),{recursive:true});
  let calls=0;
  const request=async(url,opts)=>{
    calls++;
    const body=JSON.parse(opts.body);
    assert.equal(body.ticket,calls===1?ticket:'b'.repeat(64));
    return {ok:true,json:async()=>({instanceId:calls===1?id:'22345678-1234-1234-1234-123456789012'})};
  };
  o.env.SESSION_ID=firstSession;
  saveTicket(firstSession,ticket);
  const registration=createRegistration({...o,consentFile,now:()=>now,request});
  const first=await registration.ensure();
  o.env.SESSION_ID=secondSession;
  saveTicket(secondSession,'b'.repeat(64));
  const second=await registration.ensure();
  assert.notEqual(first.id,second.id);
  assert.equal(calls,2);
});

test('malformed imported consent file fails closed',async t=>{
  const o=setup(t);
  const consentFile=path.join(path.dirname(o.file),'consent.json');
  o.env.ANALYTICS_AUTO_REGISTER='0';
  o.env.SESSION_ID='remote-session-reference-malformed';
  fs.mkdirSync(path.dirname(consentFile),{recursive:true});
  fs.writeFileSync(consentFile,'{not-json');
  const request=()=>assert.fail('malformed consent must not be redeemed');
  const registration=createRegistration({...o,consentFile,request});
  assert.equal(registration.diagnostics().consentTicketPresent,false);
  assert.equal(registration.diagnostics().enabled,false);
  assert.equal(await registration.ensure(),null);
});