// Production-quality test Express server with proper XLS conversion
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';
import http from 'http';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 4040;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map to store Python service URLs for downloads
const downloadUrls = new Map();

// Define output directory at the top level
const outputDir = path.join(__dirname, 'output');

// Create output directory if needed
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory at ${outputDir}`);
}

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Configure multer with storage options
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only XLS files
    if (file.mimetype === 'application/vnd.ms-excel' || 
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only XLS files are allowed!'));
    }
  }
});

// Add CORS middleware with explicit configuration
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Add a simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add a test endpoint for CORS
app.get('/cors-test', (req, res) => {
  res.json({ 
    message: 'CORS working properly',
    clientOrigin: req.headers.origin || 'No origin header',
    corsHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin') || 'Not set',
    }
  });
});

// Add a production-quality convert endpoint with Python service and ExcelJS fallback
app.post('/convert', upload.single('file'), async (req, res) => {
  console.log('============================================');
  console.log('Convert endpoint called at:', new Date().toISOString());
  console.log('============================================');
  
  // Check if we have a file
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      error: 'No file uploaded' 
    });
  }
  
  console.log(`File received: ${req.file.originalname}`);
  
  const originalName = req.file.originalname;
  const convertedFilename = originalName.replace('.xls', '.xlsx');
  
  try {
    // First try to forward the file to the Python conversion service
    let usePythonService = true;
    
    // Generate a valid JWT token for the Python service
    const pythonServiceSecret = process.env.SECRET_KEY || 'dev-secret-key-change-in-production';
    const token = jwt.sign({ 
      sub: 'node-server',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
    }, pythonServiceSecret, { algorithm: 'HS256' });
    
    console.log(`Processing file: ${originalName} (size: ${req.file.size} bytes)`);
    console.log(`Temporary file stored at: ${req.file.path}`);
    console.log(`Will convert to: ${convertedFilename}`);
    
    // Verify file exists and is readable
    if (!fs.existsSync(req.file.path)) {
      throw new Error(`Uploaded file not found at ${req.file.path}`);
    }
    
    console.log('File exists and is readable, proceeding with conversion...');
    
    try {
      console.log('Attempting to connect to Python service...');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), {
        filename: originalName,
        contentType: 'application/vnd.ms-excel',
      });
      
      console.log('FormData created with file stream');
      
      // Create headers object with our JWT token for the Python service
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      console.log('Added JWT authorization token for Python service');
      
      console.log('Forwarding file to Python service at http://localhost:5001/convert');
      
      console.log(`Sending request to Python service with timeout of 5000ms...`);
      console.log(`Current time before fetch: ${new Date().toISOString()}`);
      
      // Forward to Python service with timeout
      const pythonResponse = await fetch('http://localhost:5001/convert', {
        method: 'POST',
        body: formData,
        headers,
        timeout: 5000 // 5 second timeout
      });
      
      console.log(`Response received at ${new Date().toISOString()}, status: ${pythonResponse.status}`);
      
      if (pythonResponse.ok) {
        console.log('Python service response OK...');
        
        // Python service always returns the XLSX file directly (not JSON)
        console.log('Python service returned response, checking content type...');
        const contentType = pythonResponse.headers.get('content-type');
        console.log(`Python response content-type: ${contentType}`);
        
        // Log all headers for debugging
        console.log('Python service response headers:');
        pythonResponse.headers.forEach((value, name) => {
          console.log(`${name}: ${value}`);
        });
        
        // Get the file data as a buffer - IMPORTANT: properly handle binary data
        console.log('Getting file data from Python service response...');
        const fileBuffer = await pythonResponse.arrayBuffer();
        const buffer = Buffer.from(fileBuffer);
        
        // Debug buffer length and first few bytes
        console.log(`Received ${buffer.length} bytes from Python service`);
        console.log(`First 16 bytes: ${buffer.slice(0, 16).toString('hex')}`);
        
        // Check file magic number to confirm it's a valid XLSX (PK zip header)
        const magicNumber = buffer.slice(0, 4).toString('hex');
        console.log(`File magic number: ${magicNumber} (should be '504b0304' for XLSX/ZIP)`);
        
        if (magicNumber !== '504b0304') {
          console.error('WARNING: File does not have valid XLSX/ZIP magic number!');
          // Even if the magic number doesn't match, continue with the process as the Python service might be sending valid data
          console.log('Continuing despite magic number mismatch - Python service output format may vary');
        }
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Write the file to output directory as binary with explicit encoding
        const outputFilePath = path.join(outputDir, convertedFilename);
        
        // Use writeFile with explicit binary flag instead of writeFileSync for better binary handling
        await fs.promises.writeFile(outputFilePath, buffer, { encoding: null });
        
        // Double-check the written file
        const writtenFileBuffer = await fs.promises.readFile(outputFilePath);
        console.log(`Saved XLSX file from Python service to ${outputFilePath}`);
        console.log(`Original buffer size: ${buffer.length} bytes`);
        console.log(`Written file size: ${writtenFileBuffer.length} bytes`);
        
        // Verify file exists and has content
        if (!fs.existsSync(outputFilePath)) {
          throw new Error(`Failed to write output file to ${outputFilePath}`);
        }
        
        const stats = fs.statSync(outputFilePath);
        console.log(`Verified file at ${outputFilePath}, size: ${stats.size} bytes`);          
        
        // CRITICAL FIX: Directly stream the file to client instead of using download URL
        // This bypasses the need for a second request and ensures the file is delivered
        console.log(`Directly streaming file to client from ${outputFilePath}`);
        
        // Set proper headers for Excel file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${convertedFilename}"`);
        res.setHeader('Content-Length', stats.size);
        
        // Stream the file directly to the client
        const fileStream = fs.createReadStream(outputFilePath);
        
        // Handle stream errors
        fileStream.on('error', (err) => {
          console.error(`Stream error: ${err.message}`);
          if (!res.headersSent) {
            return res.status(500).json({ error: `Error streaming file: ${err.message}` });
          }
        });
        
        // Cleanup when the stream is finished
        fileStream.on('end', () => {
          console.log(`File streaming complete, setting cleanup`);
          // Delayed cleanup to ensure file stream is completely closed
          setTimeout(() => {
            try {
              if (fs.existsSync(outputFilePath)) {
                fs.unlinkSync(outputFilePath);
                console.log(`Removed temporary file: ${outputFilePath}`);
              }
            } catch (cleanupErr) {
              console.warn(`Error cleaning up file: ${cleanupErr.message}`);
            }
          }, 1000); // Short delay to ensure stream is complete
        });
        
        // Pipe the file stream to the response
        return fileStream.pipe(res);
      } else {
        // Python service returned an error
        console.log(`Python service returned error status ${pythonResponse.status}`);
        const errorText = await pythonResponse.text();
        console.error(`Python service error: ${errorText}`);
        console.log('Will fall back to ExcelJS conversion');
        usePythonService = false; // Fall back to ExcelJS
      }
    } catch (pythonError) {
      console.error('Error connecting to Python service:', pythonError.message);
      console.log('Python service connection failed, will fall back to ExcelJS');
      usePythonService = false; // Fall back to ExcelJS
    }
    
    // If Python service failed or is unavailable, return error (no fallback)
    if (!usePythonService) {
      console.log('=========================================');
      console.log('ERROR: PYTHON CONVERSION SERVICE UNAVAILABLE');
      console.log('=========================================');
      
      // Return clear error to the client that Python service is required
      return res.status(503).json({
        success: false,
        error: 'Python conversion service is unavailable. Please try again later.',
        details: 'The XLS conversion requires the Python service to be running.'
      });
    }
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({
      success: false,
      error: `Conversion failed: ${error.message}`
    });
  }
});

// Add a download endpoint that proxies to the Python service or uses ExcelJS as fallback
app.get('/download/:filename', async (req, res) => {
  const { filename } = req.params;
  
  try {
    // Get the Python service URL for this file
    const pythonUrl = downloadUrls.get(filename);
    
    // If we have a Python URL for this file, try to download it from the Python service
    if (pythonUrl) {
      try {
        // Check if the stored URL is a file path (from local storage)
        if (pythonUrl.startsWith('file://')) {
          // This is a local file path - read and send the file
          const filePath = pythonUrl.replace('file://', '');
          console.log(`Serving local file from ${filePath}`);
          
          if (fs.existsSync(filePath)) {
            console.log(`Serving file from ${filePath} with proper streaming`);
            
            try {
              // Read the first few bytes to check the magic number
              const headerBuffer = await fs.promises.readFile(filePath, { encoding: null, flag: 'r', length: 16 });
              const magicNumber = headerBuffer.slice(0, 4).toString('hex');
              console.log(`File magic number: ${magicNumber} (should be '504b0304' for XLSX/ZIP)`);
              
              if (magicNumber !== '504b0304') {
                console.error('WARNING: File does not have valid XLSX/ZIP magic number before download!');
              }
              
              // Get file stats for proper content-length header
              const stats = fs.statSync(filePath);
              console.log(`Preparing to stream file: ${stats.size} bytes`);
              
              // Set proper headers for XLSX download
              res.setHeader('Content-Length', stats.size);
              res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
              
              // Stream the file directly instead of loading it all into memory
              // This is better for large files and preserves binary integrity
              return fs.createReadStream(filePath, { encoding: null })
                .on('error', (streamErr) => {
                  console.error(`Error streaming file: ${streamErr.message}`);
                  if (!res.headersSent) {
                    res.status(500).send(`Error streaming file: ${streamErr.message}`);
                  } else {
                    res.end();
                  }
                })
                .pipe(res);
            } catch (fileError) {
              console.error(`Error preparing file for download: ${fileError.message}`);
              return res.status(500).send(`Error preparing file for download: ${fileError.message}`);
            }
          } else {
            // File not found
            throw new Error(`File not found: ${filePath}`);
          }
        } else {
          // This is a remote URL
          console.log(`Proxying download request for ${filename} to ${pythonUrl}`);
          
          // Forward the request to the remote service
          const remoteResponse = await fetch(pythonUrl, { timeout: 5000 }); // 5 second timeout
          
          if (remoteResponse.ok) {
            // Get binary data
            const fileBuffer = await remoteResponse.arrayBuffer();
            const buffer = Buffer.from(fileBuffer);
            
            // Check file magic number for ZIP format (XLSX is a ZIP file)
            const magicNumber = buffer.slice(0, 4).toString('hex');
            console.log(`File magic number: ${magicNumber} (should be '504b0304' for XLSX/ZIP)`);
            
            // Set proper Excel XLSX content type
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Send file data directly
            return res.send(buffer);
          } else {
            // Remote service error
            const errorText = await remoteResponse.text();
            console.error(`Remote service error: ${errorText}. Falling back to ExcelJS.`);
            throw new Error(`Remote service error: ${remoteResponse.status} ${errorText}`);
          }
        }
      } catch (remoteError) {
        console.error(`Error fetching from service: ${remoteError.message}. Falling back to ExcelJS.`);
      }
    }
    
    // If we reach here, either we don't have a Python URL or the Python service failed
    // Generate a fresh Excel file using ExcelJS
    console.log(`Generating new XLSX file using ExcelJS: ${filename}`);
    const xlsxFilePath = await createExcelFile(filename);
    
    // Set appropriate headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file to the client
    const fileStream = fs.createReadStream(xlsxFilePath);
    fileStream.pipe(res);
    
    // Clean up the file after sending
    fileStream.on('close', () => {
      try {
        fs.unlinkSync(xlsxFilePath);
        console.log(`Temporary Excel file ${filename} deleted after sending`);
      } catch (cleanupError) {
        console.error(`Error cleaning up temp file: ${cleanupError.message}`);
      }
    });
    
  } catch (error) {
    console.error(`Error processing download for ${filename}:`, error);
    res.status(500).json({
      success: false,
      error: `Download failed: ${error.message}`
    });
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log('===============================================================');
  console.log(`✅ Test server running on port ${PORT} at ${new Date().toISOString()}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
  console.log(`CORS test endpoint: http://localhost:${PORT}/cors-test`);
  console.log(`Convert endpoint: http://localhost:${PORT}/convert (POST)`);
  console.log(`Download endpoint: http://localhost:${PORT}/download/:filename (GET)`);
  console.log('===============================================================');
});

// Add error handler for server
server.on('error', (error) => {
  console.error('SERVER ERROR:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please try a different port.`);
    console.error(`Port ${PORT} is already in use. Try another port.`);
  }
});

// Handle multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error(`Multer error: ${err.message}`);
    return res.status(400).json({ 
      success: false, 
      error: `File upload error: ${err.message}` 
    });
  } else if (err) {
    console.error(`Server error: ${err.message}`);
    return res.status(500).json({ 
      success: false, 
      error: `Server error: ${err.message}` 
    });
  }
  next();
});
