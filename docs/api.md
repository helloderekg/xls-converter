# API Reference

This document provides detailed information about the XLS to XLSX Converter API endpoints, parameters, and response formats.

## Architecture Overview

The XLS to XLSX Converter uses a hybrid architecture:

- **Core Conversion Engine**: Python-based service using pandas/xlrd for reliable XLS parsing
- **API Layer**: Express.js wrapper providing HTTP endpoints
- **Client Libraries**: JavaScript wrappers for browser and Node.js integration

This architecture was chosen due to Python's superior capabilities in handling legacy XLS/BIFF formats while still providing JavaScript-friendly interfaces.

## API Endpoints

### Convert File to XLSX

Converts various spreadsheet formats to XLSX format.

POST /convert

#### Authentication

This endpoint requires JWT authentication. Include a valid JWT token in the Authorization header:


Authorization: Bearer <your_jwt_token>


#### Request

- **Content-Type**: `multipart/form-data`
- **Body Parameters**:
  - `file` (required): The file to convert. Must be one of the supported formats.

#### Supported Input Formats

- XLS (Excel 97-2003, BIFF5-8)
- XLSX (Excel 2007+)
- CSV (Comma-Separated Values)
- ODS (OpenDocument Spreadsheet)
- JSON (Array of objects or array of arrays)

#### Response

On successful conversion, the API directly streams the converted XLSX file with:

- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Content-Disposition**: `attachment; filename="[original_filename].xlsx"`
- **Content-Length**: Size of the converted file in bytes

#### Error Responses

| Status Code | Description | Example Response |
|-------------|-------------|------------------|
| 400 | Bad Request - Invalid file format, missing file, etc. | `{ "error": "Unsupported file extension" }` |
| 401 | Unauthorized - Invalid or missing authentication token | `{ "error": "Unauthorized: missing or invalid Authorization header" }` |
| 413 | Payload Too Large - File exceeds size limit | `{ "error": "File exceeds 50MB limit" }` |
| 500 | Server Error - Internal processing error | `{ "error": "Conversion failed" }` |

### Health Check

Returns the current status of the API service.

GET /health


#### Response

{
  "status": "ok"
}


## JavaScript Client Library

The converter can also be used directly in your JavaScript application.

### Server-Side Usage

import { convertXlsToXlsx } from 'xlsx-converter';

// Convert a file from disk
const result = await convertXlsToXlsx(
  '/path/to/input.xls',  // Input file path
  '/path/to/output.xlsx', // Output file path
  '.xls'                 // File extension (for determining format)
);

// Result contains metadata about the conversion
console.log(result);
// {
//   inputSize: 1024,
//   outputSize: 2048,
//   inputFormat: '.xls',
//   outputFormat: '.xlsx',
//   timestamp: '2023-01-01T00:00:00.000Z',
//   fileHash: 'abc123...'
// }


### Browser Usage

import { createXlsxBuffer } from 'xlsx-converter/client';

// Convert File object to XLSX buffer
const xlsxBuffer = await createXlsxBuffer(fileObject);

// Use the buffer (e.g., create download link)
const blob = new Blob([xlsxBuffer], { 
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
});
const url = URL.createObjectURL(blob);

## Security Features

All API calls automatically apply security measures including:

- Formula stripping from cells to prevent formula injection attacks
- File size validation (max 50MB by default)
- MIME type verification
- File extension validation
- JWT-based authentication

For more details on security features, see the [Security Guide](./security.md).

## Rate Limits

To ensure service stability, the following rate limits apply:

- 100 requests per hour per IP address
- 10 requests per minute per user
- Maximum file size: 50MB

## Example Code

### cURL

curl -X POST https://api.example.com/convert \
  -H "Authorization: Bearer your_jwt_token" \
  -F "file=@/path/to/your/file.xls" \
  --output converted.xlsx


### Node.js

const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function convertFile(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  
  const response = await axios.post('https://api.example.com/convert', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': 'Bearer your_jwt_token'
    },
    responseType: 'arraybuffer'
  });
  
  fs.writeFileSync('converted.xlsx', response.data);
  console.log('File converted successfully!');
}

convertFile('/path/to/your/file.xls');

### Browser


document.getElementById('convertForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Please select a file');
    return;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('https://api.example.com/convert', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer your_jwt_token'
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.xlsx';
    a.click();
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Conversion failed:', error);
    alert(`Conversion failed: ${error.message}`);
  }
});

