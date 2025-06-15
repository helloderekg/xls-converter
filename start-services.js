/**
 * XLS to XLSX Converter - Service Starter
 * 
 * This script starts both the Python core conversion service and the Node.js wrapper.
 * It handles proper sequencing, environment setup, and provides status information.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log(`${colors.blue}XLS CONVERTER - SERVICE STARTER${colors.reset}`);
console.log(`${colors.blue}===============================${colors.reset}\n`);

// Start Python service (the core conversion engine)
console.log(`${colors.cyan}STARTING${colors.reset} - Python XLS Conversion Service (core engine)...`);
const pythonProcess = spawn('python', ['src/server/xls-conversion-service.py'], {
  stdio: 'pipe',
  shell: true,
  cwd: __dirname
});

pythonProcess.stdout.on('data', (data) => {
  console.log(`${colors.green}[PYTHON]${colors.reset} ${data.toString().trim()}`);
});

pythonProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  
  // Check if the line contains error keywords or is actually an INFO message
  if ((output.toLowerCase().includes('error') && !output.toLowerCase().includes('info')) || 
      output.toLowerCase().includes('exception') || 
      output.toLowerCase().includes('critical') || 
      output.toLowerCase().includes('fatal')) {
    console.log(`${colors.red}[PYTHON ERROR]${colors.reset} ${output}`);
  } else if (output.toLowerCase().includes('info')) {
    console.log(`${colors.green}[PYTHON INFO]${colors.reset} ${output}`);
  } else if (output.toLowerCase().includes('warn')) {
    console.log(`${colors.yellow}[PYTHON WARNING]${colors.reset} ${output}`);
  } else {
    // It's debug info or other output
    console.log(`${colors.cyan}[PYTHON DEBUG]${colors.reset} ${output}`);
  }
});

// Wait for Python service to initialize
setTimeout(() => {
  // Start Node.js wrapper service
  console.log(`${colors.cyan}STARTING${colors.reset} - Node.js Wrapper Service...`);
  
  // Test multiple ports to find an available one
  const TEST_PORTS = [4002, 4003, 4004, 4005, 4006];
  const NODE_PORT = TEST_PORTS[0]; // Start with first port
  
  // Create a special flag file to force the Node server to remain running
  fs.writeFileSync(path.join(__dirname, 'server-keep-alive'), 'true', 'utf8');
  
  console.log(`${colors.blue}[NODE]${colors.reset} Attempting to start server on port ${NODE_PORT}`);
  
  const nodeProcess = spawn('node', ['src/server/index.js'], {
    stdio: 'pipe',
    shell: true,
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: NODE_PORT,
      KEEP_ALIVE: 'true', // Tell server to stay alive
      XLS_CONVERSION_SERVICE_URL: 'http://localhost:5001',
      DEBUG: 'express:router,express:application:error' // Only show important routing and actual errors
    }
  });

  nodeProcess.stdout.on('data', (data) => {
    console.log(`${colors.blue}[NODE]${colors.reset} ${data.toString().trim()}`);
  });

  nodeProcess.stderr.on('data', (data) => {
    const output = data.toString().trim();
    
    // Only show as error if it contains actual error keywords
    if (output.toLowerCase().includes('error') || 
        output.toLowerCase().includes('exception') || 
        output.toLowerCase().includes('fail')) {
      console.log(`${colors.red}[NODE ERROR]${colors.reset} ${output}`);
    } else {
      // It's just debug info, show as regular Node output
      console.log(`${colors.blue}[NODE DEBUG]${colors.reset} ${output}`);
    }
  });
  
  // Check if Node.js process starts successfully
  nodeProcess.on('error', (error) => {
    console.log(`${colors.red}[NODE PROCESS ERROR]${colors.reset} Failed to start Node.js process: ${error.message}`);
  });

  nodeProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.log(`${colors.red}[NODE EXIT]${colors.reset} Node.js process exited with code ${code} and signal ${signal}`);
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}SHUTTING DOWN${colors.reset} - Terminating services...`);
    nodeProcess.kill();
    pythonProcess.kill();
    process.exit();
  });

}, 3000); // Give Python service 3 seconds to start

console.log(`\n${colors.yellow}INFO${colors.reset} - Press Ctrl+C to stop all services`);
