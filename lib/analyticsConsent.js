'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');

const fingerprint = value => createHash('sha256').update(value).digest('hex');

function saveAnalyticsConsent(payload, sessionId, {
    file = path.join(__dirname, '..', 'data', 'analytics-consent-ticket.json'),
    now = Date.now
} = {}) {
    const consent = payload?.metadata?.analyticsRegistration;
    const valid = consent?.consent === true &&
        typeof consent.ticket === 'string' &&
        /^[a-f0-9]{64}$/.test(consent.ticket) &&
        Number.isFinite(consent.issuedAt) &&
        Number.isFinite(consent.expiresAt) &&
        consent.expiresAt > consent.issuedAt &&
        now() >= consent.issuedAt &&
        now() < consent.expiresAt;

    if (!valid) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
        return false;
    }

    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = file + '.' + randomBytes(6).toString('hex') + '.tmp';

    try {
        fs.writeFileSync(tmp, JSON.stringify({
            ticket: consent.ticket,
            sessionHash: fingerprint(sessionId),
            issuedAt: consent.issuedAt,
            expiresAt: consent.expiresAt
        }), { mode: 0o600, flag: 'wx' });
        fs.renameSync(tmp, file);
    } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }

    return true;
}

module.exports = { saveAnalyticsConsent };