# Browser Integration Guide

This guide explains how to integrate the XLS to XLSX Converter into browser-based applications.

## Quick Start

### Method 1: Using the API Service (Recommended)

The simplest approach is to use our API service from your browser application:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XLS Converter Example</title>
</head>
<body>
  <h1>XLS to XLSX Converter</h1>
  
  <form id="upload-form">
    <input type="file" id="file-input" accept=".xls,.xlsx,.csv,.ods,.json">
    <button type="submit">Convert to XLSX</button>
  </form>
  
  <div id="status"></div>
  
  <script>
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusDiv = document.getElementById('status');
      const fileInput = document.getElementById('file-input');
      const file = fileInput.files[0];
      
      if (!file) {
        statusDiv.textContent = 'Please select a file';
        return;
      }
      
      statusDiv.textContent = 'Converting...';
      
      try {
        // Create form data with the file
        const formData = new FormData();
        formData.append('file', file);
        
        // Get JWT token (in a real app, you would obtain this securely)
        const token = 'YOUR_JWT_TOKEN';
        
        // Make the API request
        // Try multiple API endpoints in case some are unavailable
        const apiUrls = [
          'http://localhost:4002/convert',
          'http://localhost:4040/convert',
          'http://localhost:4000/convert'
        ];
        
        let response;
        let error;
        
        // Try each endpoint in sequence
        for (const apiUrl of apiUrls) {
          try {
            response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${await response.text()}`);
        }
        
        // Get the converted file as a blob
        const blob = await response.blob();
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.xlsx';
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        statusDiv.textContent = 'Conversion successful!';
        
      } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
        console.error(error);
      }
    });
  </script>
</body>
</html>

### Method 2: Using the Client Library

For more advanced use cases or offline functionality, you can use our client library directly in the browser:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XLS Converter Client Library Example</title>
  <!-- Include SheetJS library -->
  <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
  <!-- Include our client library -->
  <script src="path/to/xlsx-converter-client.js"></script>
</head>
<body>
  <h1>XLS to XLSX Converter (Client-Side)</h1>
  
  <form id="upload-form">
    <input type="file" id="file-input" accept=".xls,.xlsx,.csv,.ods,.json">
    <button type="submit">Convert to XLSX</button>
  </form>
  
  <div id="status"></div>
  
  <script>
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusDiv = document.getElementById('status');
      const fileInput = document.getElementById('file-input');
      const file = fileInput.files[0];
      
      if (!file) {
        statusDiv.textContent = 'Please select a file';
        return;
      }
      
      statusDiv.textContent = 'Converting...';
      
      try {
        // Use the client library to convert the file
        const xlsxBuffer = await XlsxConverter.createXlsxBuffer(file);
        
        // Create a download link for the converted file
        const blob = new Blob([xlsxBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.xlsx';
        a.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        statusDiv.textContent = 'Conversion successful!';
        
      } catch (error) {
        statusDiv.textContent = `Error: ${error.message}`;
        console.error(error);
      }
    });
  </script>
</body>
</html>

## Integration Options

### 1. CDN Integration

Include our client library from a CDN:

<script src="https://cdn.example.com/xlsx-converter/latest/xlsx-converter.min.js"></script>

This creates a global `XlsxConverter` object with available methods.

### 2. NPM/Yarn Installation

npm install @helloderekg/xlsx-converter
# or
yarn add @helloderekg/xlsx-converter

Then import in your JS application:

import { createXlsxBuffer } from '@helloderekg/xlsx-converter/client';

### 3. Module Bundlers (Webpack, Rollup, etc.)
// In your JavaScript file
import { createXlsxBuffer } from '@helloderekg/xlsx-converter/client';

// In your application code
async function handleFileConversion(file) {
  try {
    const xlsxBuffer = await createXlsxBuffer(file);
    // Handle the converted file...
  } catch (error) {
    console.error('Conversion failed:', error);
  }
}

## Usage with Popular Frameworks

### React
import React, { useState } from 'react';
import { createXlsxBuffer } from '@helloderekg/xlsx-converter/client';

function XlsConverter() {
  const [status, setStatus] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = document.getElementById('file-input').files[0];
    
    if (!file) {
      setStatus('Please select a file');
      return;
    }
    
    setStatus('Converting...');
    
    try {
      const xlsxBuffer = await createXlsxBuffer(file);
      
      // Create download link
      const blob = new Blob([xlsxBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted.xlsx';
      a.click();
      
      URL.revokeObjectURL(url);
      setStatus('Conversion successful!');
      
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    }
  };
  
  return (
    <div>
      <h1>XLS to XLSX Converter</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" id="file-input" accept=".xls,.xlsx,.csv,.ods,.json" />
        <button type="submit">Convert</button>
      </form>
      <div>{status}</div>
    </div>
  );
}

export default XlsConverter;

### Vue.js

<template>
  <div>
    <h1>XLS to XLSX Converter</h1>
    <form @submit.prevent="convertFile">
      <input type="file" ref="fileInput" accept=".xls,.xlsx,.csv,.ods,.json" />
      <button type="submit">Convert</button>
    </form>
    <div>{{ status }}</div>
  </div>
</template>

<script>
import { createXlsxBuffer } from '@helloderekg/xlsx-converter/client';

export default {
  data() {
    return {
      status: ''
    };
  },
  methods: {
    async convertFile() {
      const file = this.$refs.fileInput.files[0];
      
      if (!file) {
        this.status = 'Please select a file';
        return;
      }
      
      this.status = 'Converting...';
      
      try {
        const xlsxBuffer = await createXlsxBuffer(file);
        
        // Create download link
        const blob = new Blob([xlsxBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'converted.xlsx';
        a.click();
        
        URL.revokeObjectURL(url);
        this.status = 'Conversion successful!';
        
      } catch (error) {
        this.status = `Error: ${error.message}`;
        console.error(error);
      }
    }
  }
};
</script>
```

## Advanced Configuration

### Custom Formula Handling

By default, all formulas are stripped from Excel files for security reasons. To customize this behavior:

```javascript
import { createXlsxBuffer, setFormulaHandlingStrategy } from '@helloderekg/xlsx-converter/client';

// Available strategies: 'strip', 'preserve', 'sanitize'
setFormulaHandlingStrategy('sanitize');

// Then continue with normal usage
const xlsxBuffer = await createXlsxBuffer(file);
```

### Error Handling

The converter provides detailed error information to help diagnose issues:

try {
  const xlsxBuffer = await createXlsxBuffer(file);
  // Success
} catch (error) {
  if (error.code === 'UNSUPPORTED_FORMAT') {
    console.error('File format is not supported:', error.message);
  } else if (error.code === 'CONVERSION_FAILED') {
    console.error('Conversion failed:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}

## Browser Compatibility

The client library supports:

- Chrome 49+
- Firefox 52+
- Safari 10+
- Edge 14+

For older browsers, we recommend using the API service approach.

## Data Privacy

When using client-side conversion:
- No data is sent to any servers
- All processing happens locally in the browser
- No temporary files are created on the user's system

This makes it suitable for handling sensitive or confidential spreadsheet data.

## File Size Limitations

Browser-based conversion is subject to memory limitations of the browser. We recommend:
- Files under 10MB for most devices
- Files under 50MB for high-end devices

For larger files, use the API service which has more robust handling.

## Performance Optimization

To improve performance when handling large files:

1. Use Web Workers for background processing
2. Implement progress indicators
3. Consider using streaming approaches for very large files

Example with Web Worker:

// main.js
document.getElementById('convert-btn').addEventListener('click', async () => {
  const file = document.getElementById('file-input').files[0];
  const worker = new Worker('converter-worker.js');
  
  worker.onmessage = (e) => {
    if (e.data.type === 'progress') {
      updateProgressBar(e.data.percent);
    } else if (e.data.type === 'complete') {
      downloadFile(e.data.buffer);
    } else if (e.data.type === 'error') {
      showError(e.data.message);
    }
  };
  
  const fileArrayBuffer = await file.arrayBuffer();
  worker.postMessage({
    type: 'convert',
    fileData: fileArrayBuffer,
    fileName: file.name
  });
});

// converter-worker.js
importScripts('xlsx-converter-client.js');

self.onmessage = async (e) => {
  if (e.data.type === 'convert') {
    try {
      // Register progress callback
      XlsxConverter.onProgress((percent) => {
        self.postMessage({ type: 'progress', percent });
      });
      
      const buffer = await XlsxConverter.convertArrayBuffer(
        e.data.fileData,
        e.data.fileName
      );
      
      self.postMessage({ 
        type: 'complete', 
        buffer: buffer 
      }, [buffer]);
      
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        message: error.message 
      });
    }
  }
};
