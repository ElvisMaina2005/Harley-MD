'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { saveAnalyticsConsent } = require('../lib/analyticsConsent');

function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harley-consent-'));
    return {
        dir,
        file: path.join(dir, 'data', 'analytics-consent-ticket.json'),
        cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
    };
}

function payload(overrides = {}) {
    return {
        metadata: {
            analyticsRegistration: {
                consent: true,
                ticket: 'a'.repeat(64),
                issuedAt: 900,
                expiresAt: 2000,
                ...overrides
            }
        }
    };
}

test('saves valid consent bound to the current session hash', () => {
    const f = fixture();
    try {
        const sessionId = 'test-session';
        assert.equal(saveAnalyticsConsent(payload(), sessionId, { file: f.file, now: () => 1000 }), true);
        const saved = JSON.parse(fs.readFileSync(f.file, 'utf8'));
        assert.equal(saved.ticket, 'a'.repeat(64));
        assert.equal(saved.sessionHash, createHash('sha256').update(sessionId).digest('hex'));
        assert.equal(saved.issuedAt, 900);
        assert.equal(saved.expiresAt, 2000);
    } finally {
        f.cleanup();
    }
});

test('declined or missing consent removes an existing ticket', () => {
    const f = fixture();
    try {
        fs.mkdirSync(path.dirname(f.file), { recursive: true });
        fs.writeFileSync(f.file, '{}');
        assert.equal(saveAnalyticsConsent(payload({ consent: false }), 'session', { file: f.file, now: () => 1000 }), false);
        assert.equal(fs.existsSync(f.file), false);
    } finally {
        f.cleanup();
    }
});

test('rejects expired consent', () => {
    const f = fixture();
    try {
        assert.equal(saveAnalyticsConsent(payload(), 'session', { file: f.file, now: () => 2000 }), false);
        assert.equal(fs.existsSync(f.file), false);
    } finally {
        f.cleanup();
    }
});

test('rejects consent issued in the future', () => {
    const f = fixture();
    try {
        assert.equal(saveAnalyticsConsent(payload({ issuedAt: 1001 }), 'session', { file: f.file, now: () => 1000 }), false);
        assert.equal(fs.existsSync(f.file), false);
    } finally {
        f.cleanup();
    }
});

test('rejects malformed ticket values', () => {
    const f = fixture();
    try {
        assert.equal(saveAnalyticsConsent(payload({ ticket: 'not-a-ticket' }), 'session', { file: f.file, now: () => 1000 }), false);
        assert.equal(fs.existsSync(f.file), false);
    } finally {
        f.cleanup();
    }
});