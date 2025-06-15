# XLS Converter Usage Guide

This comprehensive guide demonstrates how to use the XLS Converter in various scenarios and environments.

## Table of Contents

1. [Server-Side Usage](#server-side-usage)
   - [Basic API Server](#basic-api-server)
   - [Custom Integration](#custom-integration)
   - [Command Line](#command-line)
2. [Client-Side Usage](#client-side-usage)
   - [Browser Integration](#browser-integration)
   - [Framework Integration](#framework-integration)
3. [Advanced Usage](#advanced-usage)
   - [Handling Large Files](#handling-large-files)
   - [Batch Processing](#batch-processing)
   - [Custom File Formats](#custom-file-formats)
4. [Security Considerations](#security-considerations)
5. [Error Handling](#error-handling)
6. [Performance Optimization](#performance-optimization)

## Server-Side Usage

### Getting Started

The XLS Converter consists of multiple components that need to be started in the correct order:

1. **Start the Services**: The easiest way to get started is using the provided service starter:

```javascript
// Start both Python conversion service and Node.js wrapper
node start-services.js
```

This script starts both the Python XLS conversion service (core engine) and the Node.js wrapper service. It handles proper sequencing and provides status information.

Alternatively, you can start the components manually in this order:

```bash
# 1. Start the Python conversion service (core engine)
python src/server/xls-conversion-service.py

# 2. Start the Node.js wrapper service
node src/server/index.js

# 3. Open the client in a web browser
```

Once the server is running, you can convert files by sending a POST request to the `/convert` endpoint:

```javascript
// Example: Client sending a request with fetch
async function convertFile(fileInput) {
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  const response = await fetch('http://localhost:3000/convert', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-jwt-token'
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Error: ${response.status} ${response.statusText}`);
  }
  
  return response.blob();
}
```

### Custom Integration

You can also integrate the converter module directly in your application:

```javascript
import { convertXlsToXlsx } from './src/server/converter.js';

async function processFile(inputPath, outputPath) {
  try {
    const result = await convertXlsToXlsx(inputPath, outputPath);
    console.log('Conversion successful!');
    console.log(`Input size: ${result.inputSize} bytes`);
    console.log(`Output size: ${result.outputSize} bytes`);
    return result;
  } catch (error) {
    console.error('Conversion failed:', error);
    throw error;
  }
}
```

### Command Line

The package includes a CLI tool for quick file conversions:

```bash
# Install globally
npm install -g xlsx-converter

# Convert a file
xlsx-convert input.xls output.xlsx

# Convert with options
xlsx-convert input.xls output.xlsx --strip-formulas --password=yourpassword
```

Or use the package locally:

```bash
# Run from project directory
node ./src/cli.js input.xls output.xlsx
```

## Client-Side Usage

### Browser Integration

For browser usage, you can use the included client library:

```html
<!-- Include the client library -->
<script src="./dist/xlsx-converter-client.min.js"></script>

<script>
  // Convert file selected by user
  document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Client-side conversion
      const xlsxFile = await XlsxConverter.convert(file);
      
      // Create download link
      const url = URL.createObjectURL(xlsxFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.[^/.]+$/, '.xlsx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Conversion failed:', error);
      alert(`Conversion failed: ${error.message}`);
    }
  });
</script>
```

### Framework Integration

#### React Integration

```jsx
import { useState } from 'react';
import { convertFile } from 'xlsx-converter/client';

function XlsConverter() {
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setConverting(true);
    setError(null);
    
    try {
      const xlsxBlob = await convertFile(file);
      
      // Create download link
      const url = URL.createObjectURL(xlsxBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.[^/.]+$/, '.xlsx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        accept=".xls,.xlsx,.csv,.ods,.json"
        onChange={handleFileChange}
        disabled={converting}
      />
      {converting && <p>Converting...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

#### Vue Integration

```vue
<template>
  <div>
    <input 
      type="file" 
      accept=".xls,.xlsx,.csv,.ods,.json"
      @change="handleFileChange"
      :disabled="converting"
    />
    <p v-if="converting">Converting...</p>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script>
import { ref } from 'vue';
import { convertFile } from 'xlsx-converter/client';

export default {
  setup() {
    const converting = ref(false);
    const error = ref(null);
    
    const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      converting.value = true;
      error.value = null;
      
      try {
        const xlsxBlob = await convertFile(file);
        
        // Create download link
        const url = URL.createObjectURL(xlsxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name.replace(/\.[^/.]+$/, '.xlsx');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        error.value = err.message;
      } finally {
        converting.value = false;
      }
    };
    
    return {
      converting,
      error,
      handleFileChange
    };
  }
}
</script>
```

## Advanced Usage

### Handling Large Files

For large files, use the streaming API to reduce memory usage:

```javascript
import { createConverter } from 'xlsx-converter';

async function convertLargeFile(inputPath, outputPath) {
  const converter = createConverter({
    useStreaming: true,
    chunkSize: 1024 * 1024 // 1MB chunks
  });
  
  return new Promise((resolve, reject) => {
    converter.on('progress', (percent) => {
      console.log(`Conversion progress: ${percent}%`);
    });
    
    converter.on('error', (err) => {
      reject(err);
    });
    
    converter.on('complete', (result) => {
      resolve(result);
    });
    
    converter.start(inputPath, outputPath);
  });
}
```

### Batch Processing

Process multiple files efficiently:

```javascript
import fs from 'fs';
import path from 'path';
import { convertXlsToXlsx } from './src/server/converter.js';

async function batchConvert(inputDir, outputDir) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Get all files from input directory
  const files = fs.readdirSync(inputDir);
  
  // Process files
  const results = [];
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const stat = fs.statSync(inputPath);
    
    // Skip directories
    if (stat.isDirectory()) continue;
    
    const ext = path.extname(file).toLowerCase();
    const supportedExtensions = ['.xls', '.xlsx', '.csv', '.ods', '.json'];
    
    // Skip unsupported files
    if (!supportedExtensions.includes(ext)) continue;
    
    // Create output path
    const outputPath = path.join(
      outputDir, 
      `${path.basename(file, ext)}.xlsx`
    );
    
    try {
      console.log(`Converting ${file}...`);
      const result = await convertXlsToXlsx(inputPath, outputPath);
      results.push({
        file,
        success: true,
        inputSize: result.inputSize,
        outputSize: result.outputSize
      });
    } catch (error) {
      results.push({
        file,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

### Custom File Formats

Extend the converter to support additional file formats:

```javascript
import { registerCustomFormat } from 'xlsx-converter';

// Register a custom format handler
registerCustomFormat({
  extension: '.custom',
  mimeType: 'application/vnd.custom-format',
  
  parse: async (buffer) => {
    // Custom parsing logic
    const data = []; // Parse your custom format into a 2D array
    return data;
  }
});
```

## Security Considerations

Always implement these security practices when using the converter:

1. **Validate Input Files**:
   ```javascript
   function validateFile(file) {
     // Check file size
     if (file.size > MAX_FILE_SIZE) {
       throw new Error('File exceeds maximum size limit');
     }
     
     // Check file extension
     const ext = path.extname(file.originalname).toLowerCase();
     if (!ALLOWED_EXTENSIONS.includes(ext)) {
       throw new Error('Unsupported file format');
     }
     
     // Check MIME type
     if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
       throw new Error('Invalid file type');
     }
   }
   ```

2. **Always Strip Formulas**:
   ```javascript
   await convertXlsToXlsx(inputPath, outputPath, {
     stripFormulas: true // This is the default, but make it explicit
   });
   ```

3. **Implement Rate Limiting**:
   ```javascript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/convert', limiter);
   ```

## Error Handling

Implement robust error handling:

```javascript
try {
  const result = await convertXlsToXlsx(inputPath, outputPath);
  // Process successful result
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('File not found:', error.path);
  } else if (error.code === 'UNSUPPORTED_FORMAT') {
    console.error('Unsupported file format:', error.message);
  } else if (error.code === 'CONVERSION_FAILED') {
    console.error('Conversion failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Performance Optimization

Optimize converter performance:

```javascript
// Use the optimized settings for better performance
const result = await convertXlsToXlsx(inputPath, outputPath, {
  // Memory usage optimizations
  useStreaming: true,
  chunkSize: 1024 * 1024,
  
  // Processing optimizations
  skipEmptyCells: true,
  compressOutput: true,
  
  // Security optimizations
  stripFormulas: true,
  validateData: true
});
```

For high-volume processing, consider implementing a queue system:

```javascript
import Queue from 'bull';

// Create a queue
const conversionQueue = new Queue('xlsx-conversion');

// Add jobs to the queue
conversionQueue.add({
  inputPath: '/path/to/input.xls',
  outputPath: '/path/to/output.xlsx'
});

// Process jobs
conversionQueue.process(async (job) => {
  const { inputPath, outputPath } = job.data;
  return await convertXlsToXlsx(inputPath, outputPath);
});

// Handle completion
conversionQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});
```

For more detailed information about specific features and options, refer to the [API Documentation](./api.md) and [Security Guide](./security.md).
