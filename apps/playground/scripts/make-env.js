'use strict';

/**
 * Writes apps/playground/.env with random secrets when it doesn't exist (CI and fresh
 * clones — .env is gitignored). No-op if .env is already present.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('.env exists, leaving it alone');
  process.exit(0);
}

const secret = () => crypto.randomBytes(16).toString('base64');
const content = `HOST=0.0.0.0
PORT=1337
APP_KEYS=${secret()},${secret()},${secret()},${secret()}
API_TOKEN_SALT=${secret()}
ADMIN_JWT_SECRET=${secret()}
TRANSFER_TOKEN_SALT=${secret()}
JWT_SECRET=${secret()}
ENCRYPTION_KEY=${secret()}
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
`;
fs.writeFileSync(envPath, content);
console.log('.env created');
