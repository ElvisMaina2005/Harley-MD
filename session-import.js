
const fs = require('fs');
const path = require('path');

const PREFIX = 'HARLEY-MD:~';

function importSession() {
    const sessionDir = path.resolve(__dirname, 'session');

    // Preserve an existing working session
    if (fs.existsSync(path.join(sessionDir, 'creds.json'))) {
        console.log('Existing session found.');
        return;
    }

    const sessionId = process.env.SESSION_ID?.trim();

    if (!sessionId) {
        console.log('No SESSION_ID configured.');
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

    const payload = JSON.parse(decoded);

    if (
        payload.version !== 1 ||
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
                typeof content !== 'string'
            ) {
                throw new Error('Invalid session file.');
            }

            const data = Buffer.from(content, 'base64');

            JSON.parse(data.toString('utf8'));

            return [name, data];
        }
    );

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

        if (fs.existsSync(sessionDir)) {
            // Remove only the empty placeholder
            const placeholder = path.join(
                sessionDir,
                'upload creds file here'
            );

            if (
                fs.existsSync(placeholder) &&
                fs.statSync(placeholder).isFile() &&
                fs.statSync(placeholder).size === 0
            ) {
                fs.unlinkSync(placeholder);
            }

            if (fs.readdirSync(sessionDir).length > 0) {
                throw new Error(
                    'Session folder is not empty. Import cancelled.'
                );
            }

            fs.rmdirSync(sessionDir);
        }

        fs.renameSync(staging, sessionDir);

        console.log('Harley-MD session imported.');

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
