
const fs = require('fs');
const path = require('path');
const { createHash, randomBytes } = require('crypto');
const MARKER = 'harley-session-fingerprint.json';
const fingerprint = value => createHash('sha256').update(value).digest('hex');
function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function sameIdentity(a, b) {
    // Stable public identity and noise keys identify the linked device.
    return a?.registered === true && b?.registered === true &&
        a.noiseKey?.public && a.signedIdentityKey?.public &&
        JSON.stringify(a.noiseKey.public) === JSON.stringify(b.noiseKey?.public) &&
        JSON.stringify(a.signedIdentityKey.public) === JSON.stringify(b.signedIdentityKey?.public);
}
function writeMarker(dir, hash) {
    const tmp = path.join(dir, MARKER + '.tmp-' + randomBytes(6).toString('hex'));
    try {
        fs.writeFileSync(tmp, JSON.stringify({ sha256: hash }), { mode: 0o600, flag: 'wx' });
        fs.renameSync(tmp, path.join(dir, MARKER));
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

const PREFIX = 'HARLEY-MD:~';
const { validTimezone } = require('./lib/timezone');

function importSession() {
    const sessionDir = path.resolve(__dirname, 'session');

    const sessionId = process.env.SESSION_ID?.trim();
    const existing = readJson(path.join(sessionDir, 'creds.json'));
    if (!sessionId) {
        console.log(existing ? 'Existing session found.' : 'No SESSION_ID configured.');
        return;
    }
    const hash = fingerprint(sessionId);
    const marker = readJson(path.join(sessionDir, MARKER));
    if (existing?.registered === true && marker?.sha256 === hash) {
        console.log('Existing session found (same SESSION_ID).');
        return;
    }

    if (!sessionId.startsWith(PREFIX)) {
        throw new Error('Invalid Harley-MD session prefix.');
    }

    const encoded = sessionId.slice(PREFIX.length);

    const decoded = Buffer.from(
        encoded,
        'base64'
    ).toString('utf8');

    let payload;
    try { payload = JSON.parse(decoded); } catch { throw new Error('Invalid session payload.'); }

    if (
        !payload || payload.version !== 1 ||
        payload.format !== 'baileys-multi-file' ||
        !payload.files ||
        !payload.files['creds.json']
    ) {
        throw new Error('Invalid session format.');
    }

    // Validate session files
    const files = Object.entries(payload.files).map(
        ([name, content]) => {
            if (
                !/^[a-zA-Z0-9_.@+-]+\.json$/.test(name) ||
                name.includes('..') ||
                name === 'harley-timezone.json' ||
                name === MARKER ||
                typeof content !== 'string'
            ) {
                throw new Error('Invalid session file.');
            }

            const data = Buffer.from(content, 'base64');

            let parsed;
            try { parsed = JSON.parse(data.toString('utf8')); } catch { throw new Error(`Invalid session JSON file: ${name}`); }
            if (name === 'creds.json' && parsed?.registered !== true) throw new Error('Session credentials are not registered. Generate a fresh SESSION_ID.');

            return [name, data];
        }
    );

    const incoming = JSON.parse(files.find(([name]) => name === 'creds.json')[1].toString('utf8'));
    if (!incoming.noiseKey?.public || !incoming.noiseKey?.private || !incoming.signedIdentityKey?.public || !incoming.signedIdentityKey?.private || !incoming.me?.id) {
        throw new Error('Session credentials are incomplete. Generate a fresh SESSION_ID.');
    }
    // Upgrade legacy installations without resetting their live ratchet state.
    if (sameIdentity(existing, incoming)) {
        writeMarker(sessionDir, hash);
        console.log('Existing session found (fingerprint initialized).');
        return;
    }
    const staging = fs.mkdtempSync(
        path.join(__dirname, '.session-import-')
    );

    try {
        for (const [name, data] of files) {
            fs.writeFileSync(
                path.join(staging, name),
                data,
                { mode: 0o600 }
            );
        }

        const timezone = validTimezone(payload.metadata?.timezone);
        if (timezone) {
            fs.writeFileSync(path.join(staging, 'harley-timezone.json'), JSON.stringify({ timezone }), { mode: 0o600 });
        }

        writeMarker(staging, hash);
        let backup;
        if (fs.existsSync(sessionDir)) {
            // Keep the entire old session, including its fingerprint and timezone.
            backup = path.join(__dirname, 'session-backup-' + Date.now() + '-' + randomBytes(6).toString('hex'));
            fs.renameSync(sessionDir, backup);
        }
        try {
            fs.renameSync(staging, sessionDir);
        } catch (error) {
            if (backup && !fs.existsSync(sessionDir)) fs.renameSync(backup, sessionDir);
            throw error;
        }
        console.log(backup ? 'New Harley-MD session imported. Previous session backed up.' : 'Harley-MD session imported.');

    } finally {
        if (fs.existsSync(staging)) {
            fs.rmSync(staging, {
                recursive: true,
                force: true
            });
        }
    }
}

module.exports = { importSession };
