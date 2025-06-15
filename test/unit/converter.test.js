import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
// Import directly for testing without mocking
import { convertXlsToXlsx } from '../../src/server/converter.js';

// For actual service testing, we need these global variables
let pythonServiceRunning = false;
const DEFAULT_SERVICE_URL = 'http://localhost:5001';
const SERVICE_URL = process.env.XLS_CONVERSION_SERVICE_URL || DEFAULT_SERVICE_URL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('XLS Converter Unit Tests', () => {
  const tempDir = path.join(__dirname, '../../temp');
  
  beforeEach(() => {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Clean up any test files created
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        try {
          const filePath = path.join(tempDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.warn(`Failed to delete test file: ${file}`, err);
          // Continue anyway, don't fail the test for cleanup issues
        }
      });
    }
  });
  
  // Check if Python service is running before tests
  beforeEach(async () => {
    // Try to connect to the Python service
    try {
      const response = await fetch(`${SERVICE_URL}/health`);
      pythonServiceRunning = response.ok;
      if (!pythonServiceRunning) {
        console.warn('⚠️ Python conversion service is not running. Some tests will be skipped.');
      } else {
        console.log('✅ Python conversion service is running, tests will proceed.');
      }
    } catch (error) {
      pythonServiceRunning = false;
      console.warn('⚠️ Python conversion service is not running. Some tests will be skipped.');
    }
  });
  
  // Note: createXlsxBuffer has been removed as part of client-side conversion refactoring
  // All conversion is now done by the Python service
  
  describe('convertXlsToXlsx with Python service', () => {
    it('should handle JSON conversion using the Python service', async function() {
      // Skip test if Python service is not running
      if (!pythonServiceRunning) {
        console.warn('  Skipping JSON conversion test - Python service not available');
        return;
      }
      
      const testData = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      const inputPath = path.join(tempDir, 'test.json');
      const outputPath = path.join(tempDir, 'output.xlsx');
      
      fs.writeFileSync(inputPath, JSON.stringify(testData));
      
      const result = await convertXlsToXlsx(inputPath, outputPath, '.json');
      
      // Check that file exists
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Validate the file with ExcelJS library
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(outputPath);
        expect(workbook.worksheets.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('Error reading output file:', error);
        expect.fail('Output file is not a valid XLSX file');
      }
    });
    
    it('should throw appropriate error for unsupported file types', async function() {
      // This test can run without Python service since it should fail early with a validation error
      const inputPath = path.join(tempDir, 'test.txt');
      const outputPath = path.join(tempDir, 'output.xlsx');
      
      fs.writeFileSync(inputPath, 'This is not a supported file');
      
      try {
        await convertXlsToXlsx(inputPath, outputPath, '.txt');
        // If we get here, the function didn't throw as expected
        expect(true).toBe(false, 'Expected error was not thrown');
      } catch (error) {
        // Check for either connection error or validation error based on service availability
        const isConnectionError = error.message.includes('Could not connect to conversion service');
        const isValidationError = error.message.includes('Conversion service error');
        
        expect(isConnectionError || isValidationError).toBe(
          true, 
          `Expected either connection error or validation error, but got: ${error.message}`
        );
      }
    });
  });
});
