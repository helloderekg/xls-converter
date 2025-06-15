/**
 * XLS Converter - Stand-alone Test Script
 * 
 * This script demonstrates the core functionality of the XLS/XLSX converter
 * without requiring a running server. It's useful for quick testing and validation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { convertXlsToXlsx } from '../src/server/converter.js';

// Setup paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const testFilesDir = path.join(__dirname, 'test/files');
const outputDir = path.join(__dirname, 'standalone-test-output');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Run a basic conversion test on each file type
 */
async function runBasicTests() {
  console.log(`${colors.blue}XLS CONVERTER - STAND-ALONE TEST${colors.reset}`);
  console.log(`${colors.blue}=================================${colors.reset}\n`);
  
  // Check if Python service is running
  console.log(`${colors.cyan}CHECKING${colors.reset} - Python XLS Conversion Service status...`);
  try {
    // Try to call the health endpoint to check if service is running
    const response = await fetch(process.env.XLS_CONVERSION_SERVICE_URL || 'http://localhost:5001/health');
    if (response.ok) {
      console.log(`${colors.green}SUCCESS${colors.reset} - Python XLS Conversion Service is running!\n`);
    } else {
      console.log(`${colors.red}ERROR${colors.reset} - Python XLS Conversion Service returned unexpected status: ${response.status}\n`); 
      console.log(`${colors.yellow}INFO${colors.reset} - Make sure to start the Python service with: python src/server/xls-conversion-service.py`); 
      return;
    }
  } catch (error) {
    console.log(`${colors.red}ERROR${colors.reset} - Cannot connect to Python XLS Conversion Service!\n`);
    console.log(`${colors.yellow}INFO${colors.reset} - Make sure the Python service is running with: python src/server/xls-conversion-service.py`);
    console.log(`${colors.yellow}INFO${colors.reset} - Service expected at: ${process.env.XLS_CONVERSION_SERVICE_URL || 'http://localhost:5001'}`);
    return;
  }
  
  // Test cases - each file type
  const testCases = [
    { type: 'XLS', path: path.join(testFilesDir, 'xls/basic-data.xls') },
    { type: 'XLSX', path: path.join(testFilesDir, 'xlsx/basic-data.xlsx') },
    { type: 'CSV', path: path.join(testFilesDir, 'csv/basic-data.csv') },
    { type: 'JSON', path: path.join(testFilesDir, 'json/basic-data.json') }
  ];
  
  // Loop through test cases
  for (const test of testCases) {
    try {
      // Skip if file doesn't exist
      if (!fs.existsSync(test.path)) {
        console.log(`${colors.yellow}SKIPPED${colors.reset} - ${test.type}: File not found at ${test.path}`);
        continue;
      }
      
      console.log(`${colors.cyan}TESTING${colors.reset} - ${test.type} Conversion: ${path.basename(test.path)}`);
      
      const outputPath = path.join(outputDir, `${test.type.toLowerCase()}-converted.xlsx`);
      const startTime = Date.now();
      
      // Perform conversion through Python service
      const result = await convertXlsToXlsx(test.path, outputPath, path.extname(test.path));
      const duration = Date.now() - startTime;
      
      // Verify result
      const success = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;
      
      if (success) {
        console.log(`${colors.green}PASSED${colors.reset} - Converted successfully in ${duration}ms`);
        console.log(`         Input size: ${(result.inputSize / 1024).toFixed(2)} KB`);
        console.log(`         Output size: ${(result.outputSize / 1024).toFixed(2)} KB`);
        console.log(`         Output file: ${outputPath}`);
      } else {
        console.log(`${colors.red}FAILED${colors.reset} - Conversion failed or produced empty file`);
      }
      
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.log(`${colors.red}ERROR${colors.reset} - ${test.type}: ${error.message}`);
      console.log(''); // Empty line for readability
    }
  }
}

/**
 * Test formula stripping security feature
 */
async function testFormulaSecurity() {
  console.log(`${colors.blue}TESTING FORMULA SECURITY${colors.reset}`);
  console.log(`${colors.blue}=======================${colors.reset}\n`);
  
  const formulaFile = path.join(testFilesDir, 'xlsx/formulas.xlsx');
  
  // Skip if file doesn't exist
  if (!fs.existsSync(formulaFile)) {
    console.log(`${colors.yellow}SKIPPED${colors.reset} - Formula test: File not found at ${formulaFile}`);
    return;
  }
  
  try {
    const outputPath = path.join(outputDir, 'formulas-stripped.xlsx');
    const startTime = Date.now();
    
    console.log(`${colors.cyan}TESTING${colors.reset} - Formula stripping: ${path.basename(formulaFile)}`);
    
    // Perform conversion with formula stripping
    await convertXlsToXlsx(formulaFile, outputPath);
    const duration = Date.now() - startTime;
    
    console.log(`${colors.green}COMPLETE${colors.reset} - Processed file in ${duration}ms`);
    console.log(`         Output file: ${outputPath}`);
    console.log('         All formulas should be stripped in this file');
    
    console.log(''); // Empty line for readability
    
  } catch (error) {
    console.log(`${colors.red}ERROR${colors.reset} - Formula test: ${error.message}`);
    console.log(''); // Empty line for readability
  }
}

/**
 * Test error handling with invalid inputs
 */
async function testErrorHandling() {
  console.log(`${colors.blue}TESTING ERROR HANDLING${colors.reset}`);
  console.log(`${colors.blue}======================${colors.reset}\n`);
  
  const testCases = [
    { name: 'Non-existent file', path: path.join(testFilesDir, 'non-existent.xls') },
    { name: 'Unsupported format', path: path.join(__dirname, 'package.json') }
  ];
  
  for (const test of testCases) {
    try {
      console.log(`${colors.cyan}TESTING${colors.reset} - ${test.name}: ${path.basename(test.path)}`);
      
      const outputPath = path.join(outputDir, 'should-fail.xlsx');
      await convertXlsToXlsx(test.path, outputPath);
      
      console.log(`${colors.red}FAILED${colors.reset} - Expected error but got success`);
      console.log(''); // Empty line for readability
      
    } catch (error) {
      console.log(`${colors.green}PASSED${colors.reset} - Correctly threw error: ${error.message}`);
      console.log(''); // Empty line for readability
    }
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    // Run basic conversion tests
    await runBasicTests();
    
    // Test formula security
    await testFormulaSecurity();
    
    // Test error handling
    await testErrorHandling();
    
    console.log(`${colors.blue}ALL TESTS COMPLETE${colors.reset}`);
    console.log(`Check the output directory: ${outputDir}`);
    
  } catch (error) {
    console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  }
}

// Execute tests
runAllTests().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
