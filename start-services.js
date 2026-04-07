// Local dev launcher: spawns the Python conversion service and the Node API
// gateway, forwards their output, and shuts both down on Ctrl+C.
//
// In production this script is NOT used — the docker-entrypoint.sh script
// runs the equivalent inside the container.

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue:  '\x1b[34m',
  cyan:  '\x1b[36m',
  red:   '\x1b[31m',
};

fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });

const children = [];

function launch(name, color, cmd, args) {
  console.log(`${color}[${name}]${c.reset} starting: ${cmd} ${args.join(' ')}`);
  const child = spawn(cmd, args, { cwd: __dirname, env: process.env });
  child.stdout.on('data', (d) => process.stdout.write(`${color}[${name}]${c.reset} ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`${color}[${name}]${c.reset} ${d}`));
  child.on('exit', (code, signal) => {
    console.log(`${color}[${name}]${c.reset} exited (code=${code}, signal=${signal})`);
  });
  children.push(child);
  return child;
}

console.log(`${c.blue}XLS Converter — local dev launcher${c.reset}`);

launch('PYTHON', c.green, 'python', ['src/server/xls-conversion-service.py']);

// Give Python a moment to bind its port before the Node gateway tries to
// reach it. The gateway will keep working if Python is slow, so this is
// just a courtesy to avoid noisy "connection refused" lines on startup.
setTimeout(() => {
  launch('NODE', c.cyan, 'node', ['src/server/index.js']);
}, 1500);

console.log(`${c.blue}Press Ctrl+C to stop both services${c.reset}`);

const shutdown = () => {
  console.log(`\n${c.red}Shutting down…${c.reset}`);
  for (const child of children) {
    try { child.kill(); } catch { /* ignore */ }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
