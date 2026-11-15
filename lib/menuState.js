const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'data');
const image = path.join(dir, 'menu-custom.jpg');
const original = path.join(root, 'assets', 'bot_image.jpg');
function atomic(target, data) {
    fs.mkdirSync(dir, { recursive: true });
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    try { fs.writeFileSync(temp, data, { mode: 0o600 }); fs.renameSync(temp, target); }
    finally { try { fs.unlinkSync(temp); } catch {} }
}
function getImage() {
    for (const candidate of [image, original]) {
        try { const s = fs.statSync(candidate); if (s.isFile() && s.size > 0 && s.size <= 5*1024*1024) return fs.readFileSync(candidate); } catch {}
    }
    return null;
}
function restore() { try { fs.unlinkSync(image); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
module.exports = { getImage, restore, setImage: data => atomic(image, data) };
