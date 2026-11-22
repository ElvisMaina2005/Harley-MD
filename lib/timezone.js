const fs = require('fs'); 
const path = require('path');
function validTimezone(value) {
    if (typeof value !== 'string' || value.length > 100) return null;
    try { return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone; }
    catch { return null; }
}
function ownerTimezone(jid) {
    try {
        const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'session', 'harley-timezone.json'), 'utf8'));
        const zone = validTimezone(meta.timezone);
        if (zone) return { zone, source: 'pairing browser' };
    } catch {}
    const override = validTimezone(process.env.GREETINGS_TIMEZONE);
    if (override) return { zone: override, source: 'configured override' };
    try {
        const { parsePhoneNumberFromString } = require('libphonenumber-js');
        const moment = require('moment-timezone');
        const match = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
        const country = match && parsePhoneNumberFromString('+' + match[1])?.country;
        const zones = country ? moment.tz.zonesForCountry(country) : [];
        const defaults = { US: 'America/New_York', CA: 'America/Toronto', AU: 'Australia/Sydney', BR: 'America/Sao_Paulo', RU: 'Europe/Moscow', MX: 'America/Mexico_City', ID: 'Asia/Jakarta', NZ: 'Pacific/Auckland' };
        const zone = validTimezone(defaults[country] || zones?.[0]);
        if (zone) return { zone, source: zones.length === 1 ? 'phone country' : 'estimated country timezone' };
    } catch {}
    return { zone: 'UTC', source: 'unknown country; UTC fallback' };
}
module.exports = { validTimezone, ownerTimezone };
