const path = require('node:path');
if (!process.env.SB_RELEASE_DIR) throw new Error('SB_RELEASE_DIR is required');
module.exports = { apps: [{
  name: 'sportbuddy-api', script: path.join(process.env.SB_RELEASE_DIR, 'server.js'),
  cwd: process.env.SB_RELEASE_DIR, interpreter: process.execPath,
  instances: 1, exec_mode: 'fork', autorestart: true,
  kill_timeout: 12000, min_uptime: 10000, max_restarts: 5,
  env: { NODE_ENV: 'production', PORT: '3001', SB_RELEASE_ID: process.env.SB_RELEASE_ID || 'legacy' }
}] };
