'use strict';
const { randomUUID } = require('node:crypto');
const settings = require('../settings');
const queue = [];
let running = false, timer = null, socket = null, warned = false;
function config() {
  if (process.env.ANALYTICS_ENABLED !== '1') return null;
  try {
    const url = new URL(process.env.ANALYTICS_API_URL);
    const id = process.env.ANALYTICS_INSTANCE_ID || '', token = process.env.ANALYTICS_INSTANCE_TOKEN || '';
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^[a-zA-Z0-9_-]{16,100}$/.test(id) || !/^[a-f0-9]{64}$/i.test(token)) throw Error();
    return { base: url.origin, id, token };
  } catch { if (!warned) { warned = true; console.warn('[ANALYTICS] Invalid configuration; disabled'); } return null; }
}
const version = () => /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(settings.version) ? settings.version : null;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const item = queue.shift();
      const cfg = config(); if (!cfg) continue;
      if (item.kind === 'heartbeat' && item.socket !== socket) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (item.kind === 'heartbeat' && item.socket !== socket) break;
        try {
          const res = await fetch(`${cfg.base}/api/${item.kind}`, { method:'POST', redirect:'error', headers:{Authorization:`Bearer ${cfg.token}`, 'X-Instance-Id':cfg.id, 'Content-Type':'application/json'}, body:JSON.stringify(item.body), signal:AbortSignal.timeout(25000) });
          const status = res.status;
          if (res.body) await res.body.cancel().catch(()=>{});
          if (res.ok) { console.log(`[ANALYTICS] ${item.kind} recorded`); break; }
          if (![408,429].includes(status) && status < 500) { console.warn(`[ANALYTICS] ${item.kind} rejected (${status})`); break; }
        } catch { /* Never log request or credential details. */ }
        if (attempt === 3) console.warn(`[ANALYTICS] ${item.kind} delivery failed`);
        else await sleep(2000 * 2 ** attempt);
      }
    }
  } finally { running = false; }
}
function enqueue(kind, fields, owner = null, eventId = randomUUID()) {
  try {
    const v = version(); if (!config() || !v) return;
    if (queue.length >= 200) { console.warn('[ANALYTICS] Queue full; event dropped'); return; }
    queue.push({kind, socket:owner, body:{eventId, version:v, ...fields}});
    void drain().catch(()=>console.warn('[ANALYTICS] Delivery stopped'));
  } catch { /* Analytics must never interrupt bot functionality. */ }
}
function recordCommand(command, success) { if (/^[a-z0-9_-]{1,40}$/.test(command)) enqueue('commands',{command,success:success===true}); }
const codes = new Set(['COMMAND_EXCEPTION','MESSAGE_HANDLER','CONNECTION_CLOSED','SESSION_CONFLICT','STARTUP_FAILURE']);
function recordError(code) { if (codes.has(code)) enqueue('errors',{code}); }
function startHeartbeat(owner) {
  if (!config() || !owner || socket === owner) return;
  stopHeartbeat(); socket = owner;
  const beat = () => { if (socket === owner) enqueue('heartbeat',{uptimeSeconds:Math.floor(process.uptime())},owner); };
  beat(); timer = setInterval(beat,300000); timer.unref();
}
function stopHeartbeat(owner) { if (owner && owner !== socket) return; clearInterval(timer); timer=null; socket=null; }
function recordMedia(kind, fields, eventId) { if (["media-operations","provider-attempts"].includes(kind)) enqueue(kind, fields, null, eventId); }
const connectionStates = new Set(['connected','disconnected','reconnecting','startup_failure']);
let lastConnectionState = null;
function recordConnection(state, code) {
  if (!connectionStates.has(state) || state === lastConnectionState) return;
  if (!config() || !version()) return;
  const fields = {state};
  if (codes.has(code)) fields.code = code;
  lastConnectionState = state;
  enqueue('connection', fields);
}
module.exports={recordCommand,recordError,startHeartbeat,stopHeartbeat,recordMedia,recordConnection};
