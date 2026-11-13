'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const APIs = require('./api');
const { toWhatsAppMp4 } = require('./waVideo');
const cooldowns = new Map();
const MAX = 100 * 1024 * 1024;
let localBusy = false;
function cooldown(error) {
  const status = error.response?.status;
  const msg = String(error.message || '');
  if (/daily limit|quota exceeded/i.test(msg)) return 3600000;
  if (status === 429 || /HTTP 429|rate limit/i.test(msg)) {
    const retry = error.response?.headers?.['retry-after'];
    const ms = /^\d+$/.test(String(retry)) ? Number(retry)*1000 : Date.parse(retry)-Date.now();
    return Number.isFinite(ms) && ms > 0 ? Math.max(60000, ms) : 900000;
  }
  if ([402,404].includes(status) || /ENOTFOUND|EPROTO|HTTP (402|404)|All API endpoints failed/i.test(msg)) return 3600000;
  return 0;
}
async function tryProviders(steps, consume, report = () => {}) {
  for (const [name, run] of steps) {
    if ((cooldowns.get(name) || 0) > Date.now()) { console.log(`[MEDIA] ${name}: cooldown`); continue; }
    try {
      const result = await run();
      const url = result?.download || result?.audio || result?.downloadUrl || result?.dl_url || result?.dl || result?.url;
      if (!url || !/^https?:\/\//i.test(url) || APIs.isIpLockedCdn(url)) throw new Error('No usable media URL');
      report(name);
      const buffer = await consume(url, result);
      if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Empty media');
      console.log(`[MEDIA] ${name}: success`);
      return { buffer, title: result.title };
    } catch (error) {
      const wait = cooldown(error);
      if (wait) cooldowns.set(name, Date.now() + wait);
      console.warn(`[MEDIA] ${name}: ${error.response?.status || error.code || String(error.message).slice(0,180)}`);
    }
  }
  return null;
}
function run(bin, args, timeout, cwd, onProgress) {
  return new Promise((resolve, reject) => {
    const env = {};
    for (const k of ['PATH','HOME','USERPROFILE','SYSTEMROOT','TEMP','TMP','LANG']) if (process.env[k]) env[k] = process.env[k];
    const child = spawn(bin, args, { cwd, env, shell:false, windowsHide:true, stdio:['ignore','pipe','pipe'] });
    let tail = '', expired = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.on('data', chunk => { const m = String(chunk).match(/\[download\]\s+([\d.]+)%/); if (m) { try { onProgress?.(Number(m[1])); } catch {} } });
    child.stderr.on('data', chunk => { tail = (tail + chunk).slice(-2000); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => { clearTimeout(timer); if (expired) reject(new Error('Local downloader timed out')); else if (code === 0) resolve(); else reject(new Error(`Local downloader exited ${code}: ${tail.trim().split('\n').at(-1) || 'unknown error'}`)); });
  });
}
async function localDownload(url, kind, report = () => {}) {
  if (process.env.MEDIA_YTDLP_ENABLED !== '1') throw new Error('All download sources failed. Local downloader is not enabled.');
  const id = /^(?:https:\/\/(?:www\.)?youtube\.com\/watch\?v=|https:\/\/youtu\.be\/)([\w-]{11})(?:[&#?].*)?$/.exec(url)?.[1];
  if (!id) throw new Error('Unsupported YouTube URL for local downloader');
  if (localBusy) throw new Error('Local downloader busy; try again later');
  localBusy = true;
  let dir;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(),'harley-media-'));
    const bin = process.env.MEDIA_YTDLP_PATH || 'yt-dlp';
    const args = ['--ignore-config','--no-playlist','--no-cache-dir','--newline','--no-warnings','--socket-timeout','20','--retries','1','--fragment-retries','1','--max-filesize','100M','--match-filter','duration <= 900','-o','source.%(ext)s'];
    if (kind === 'audio') args.push('-f','bestaudio/best','-x','--audio-format','mp3','--audio-quality','128K');
    else args.push('-f','best[height<=480][ext=mp4]/best[height<=480]');
    args.push('--',`https://www.youtube.com/watch?v=${id}`);
    await run(bin,args,300000,dir,p => report({stage:'local',percent:p}));
    const files = fs.readdirSync(dir).filter(f => /^source\.(mp3|mp4|webm|mkv|mov)$/.test(f));
    if (files.length !== 1) throw new Error('No complete local media file');
    let file = path.join(dir,files[0]);
    if (fs.statSync(file).size > MAX) throw new Error('Media exceeds size limit');
    if (kind === 'video') {
      const output = path.join(dir,'output.mp4');
      await toWhatsAppMp4(file,output,report); file = output;
    }
    if (fs.statSync(file).size > MAX) throw new Error('Converted media exceeds size limit');
    return fs.readFileSync(file);
  } finally { if (dir) fs.rmSync(dir,{recursive:true,force:true}); localBusy = false; }
}
module.exports = { tryProviders, localDownload, cooldown };
