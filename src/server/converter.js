import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';

/**
 * Client for the Python XLS Conversion Service
 * 
 * This module acts as a client wrapper for the Python-based XLS conversion service,
 * which provides robust handling of legacy XLS formats that JavaScript libraries
 * cannot reliably parse.
 */

/**
 * Default URL for the Python conversion service
 * Can be overridden by setting the XLS_CONVERSION_SERVICE_URL environment variable
 */
const DEFAULT_SERVICE_URL = 'http://localhost:5001';
const SERVICE_URL = process.env.XLS_CONVERSION_SERVICE_URL || DEFAULT_SERVICE_URL;

/**
 * JWT Secret key for authentication with the Python service
 * Can be overridden by setting the JWT_SECRET_KEY environment variable
 */
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'dev-secret-key-change-in-production';

/**
 * Convert various file formats to XLSX using the Python service
 * @param {string} inputPath - Path to input file
 * @param {string} outputPath - Path to output file
 * @param {string} ext - File extension of input file
 * @returns {Promise<object>} Metadata about the conversion
 */
export async function convertXlsToXlsx(inputPath, outputPath, ext) {
  try {
    // Create a form with the file to be converted
    const form = new FormData();
    form.append('file', fs.createReadStream(inputPath));
    
    // Generate JWT token for authentication with the Python service
    const token = jwt.sign(
      { 
        sub: 'nodejs-client',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
      },
      JWT_SECRET_KEY,
      { algorithm: 'HS256' }
    );
    
    console.log(`Sending request to Python service at ${SERVICE_URL}/convert`);
    
    // Call the Python conversion service with authentication
    const response = await fetch(`${SERVICE_URL}/convert`, {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Conversion service error (${response.status}): ${errorText}`);
    }
    
    // Check content type to ensure we received an xlsx file
    const contentType = response.headers.get('content-type');
    console.log(`Received response with content type: ${contentType}`);
    
    if (!contentType || !contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      console.warn(`Warning: Unexpected content type from conversion service: ${contentType}`);
      // Continue anyway as the Python service might not set the correct content type
    }
    
    // Get the response as a buffer and write to the output path
    const fileBuffer = await response.buffer();
    console.log(`Received file buffer of size: ${fileBuffer.length} bytes`);
    
    // Ensure the buffer contains valid data before writing
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Received empty file from conversion service');
    }
    
    // Write the buffer to the output path
    fs.writeFileSync(outputPath, fileBuffer);
    console.log(`Wrote converted file to: ${outputPath}`);
    
    // Verify the file was written correctly
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Failed to write output file to ${outputPath}`);
    }
    
    // Return metadata about the conversion
    const inputStats = fs.statSync(inputPath);
    const outputStats = fs.statSync(outputPath);
    
    return {
      inputSize: inputStats.size,
      outputSize: outputStats.size,
      inputFormat: ext,
      outputFormat: '.xlsx',
      serviceUrl: SERVICE_URL
    };
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new Error(`Could not connect to conversion service at ${SERVICE_URL}. Make sure the Python service is running.`);
    }
    throw new Error(`Error converting file: ${error.message}`);
  }
}

/**
 * Create a buffer from Excel data
 * @param {Object|Array} data - Data to convert to Excel
 * @returns {Buffer} Excel file buffer
 */
/**
 * Strips potentially malicious formulas from spreadsheet data
 * @param {ExcelJS.Workbook} workbook - ExcelJS workbook object
 * @returns {ExcelJS.Workbook} Workbook with formulas removed
 */
export function stripFormulas(workbook) {
  // For each worksheet in the workbook
  workbook.eachSheet(worksheet => {
    // Look through all cells in the worksheet
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        // If cell has a formula, replace it with its value or empty string
        if (cell.formula) {
          const value = cell.value || '';
          cell.value = value;
          cell.formula = undefined;
        }
      });
    });
  });
  
  return workbook;
}

/**
 * Create a buffer from Excel data
 * @param {Object|Array} data - Data to convert to Excel
 * @returns {Promise<Buffer>} Excel file buffer
 */
export async function createXlsxBuffer(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'XLS Converter';
  workbook.lastModifiedBy = 'XLS Converter';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  const worksheet = workbook.addWorksheet('Sheet1');
  
  // Handle different data formats
  if (Array.isArray(data)) {
    if (data.length === 0) {
      // Empty data
      worksheet.addRow(['No data']);
    } else if (Array.isArray(data[0])) {
      // Array of arrays (rows/columns)
      data.forEach(row => worksheet.addRow(row));
    } else if (typeof data[0] === 'object') {
      // Array of objects
      // Extract column headers from first object
      const columns = Object.keys(data[0]).map(key => ({ header: key, key }));
      worksheet.columns = columns;
      
      // Add all rows
      worksheet.addRows(data);
    }
  } else if (typeof data === 'object') {
    // Single object
    const columns = Object.keys(data).map(key => ({ header: key, key }));
    worksheet.columns = columns;
    worksheet.addRow(data);
  } else {
    // Invalid data
    worksheet.addRow(['Invalid data']);
  }
  
  // Return as buffer
  return await workbook.xlsx.writeBuffer();
}

export default {
  stripFormulas,
  convertXlsToXlsx,
  createXlsxBuffer
};
