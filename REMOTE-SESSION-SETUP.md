# Harley-MD remote session setup for Nodex

## What changes 

The Pair Site returns a short `HARLEY-MD:~` remote reference instead of placing the full multi-file Baileys session in Nodex config vars. The bot fetches the encrypted session when it starts and periodically backs up changed auth files to the API.

## Deploy in this order

### 1. Analytics API

Add these environment variables to the Analytics API service:

- `SESSION_STORAGE_ENCRYPTION_KEY`: a newly generated 64-character hexadecimal key (32 random bytes). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `PAIR_API_KEY`: your existing 64-character pair-service key. Keep it private.
- Existing Firebase credentials and project settings must remain configured.

The encryption key stays ONLY on the Analytics API. Do not put it in Nodex or the Pair Site.

Deploy the API update and verify `/health` responds successfully.

### 2. Pair Site

Set:

- `ANALYTICS_API_URL`: the HTTPS origin of your deployed Analytics API (no path)
- `ANALYTICS_PAIR_KEY`: the same value as the Analytics API's `PAIR_API_KEY`

Deploy the updated Pair Site.

### 3. Harley-MD main bot

Deploy the updated main bot. No extra Nodex environment variables are required for remote session retrieval; the per-session access token is carried inside the compact session reference.

Generate a NEW session from the updated Pair Site. Paste the returned `HARLEY-MD:~...` value into Nodex's Session ID field and start the bot.

## Important notes

- The Analytics API stores the session encrypted with AES-256-GCM in Firestore.
- Each remote session has its own random access token. The API stores only its hash.
- The bot syncs local auth JSON files to remote storage every 60 seconds and after credential updates. A restart may lose up to the most recent sync interval if the host deletes its local filesystem.
- Firestore documents have a 1 MiB size limit. This implementation rejects session snapshots above 700 KB; your currently measured session is below that threshold.
- Keep the compact reference private: it grants access to that WhatsApp session.
- A session that was previously pasted into a public or shared place should be revoked from WhatsApp Linked Devices and regenerated.
- Existing full-size session IDs will still be recognized by the bot code, but Nodex will reject them if they exceed its config-var limit. Generate a fresh reference after all three services are deployed.
