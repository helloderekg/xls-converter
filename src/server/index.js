import express from 'express';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { convertXlsToXlsx } from './converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for all routes with specific options
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle OPTIONS preflight requests explicitly
app.options('*', cors());

// Try to use configured port, but fall back to other ports if unavailable
const PREFERRED_PORT = process.env.PORT || 4000;
let PORT = PREFERRED_PORT;

// Check if we're in a child process where port was reassigned
if (process.env.REASSIGNED_PORT) {
  PORT = parseInt(process.env.REASSIGNED_PORT);
  console.log(`Using reassigned port ${PORT} instead of preferred port ${PREFERRED_PORT}`);
}

// Configure multer for file uploads with size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv', '.xls', '.xlsx', '.ods', '.json'];
    
    if (!allowedExtensions.includes(ext)) {
      // Store error message in request for later handling
      req.fileValidationError = 'Only Excel, CSV, ODS and JSON files are allowed';
      return cb(null, false);
    }
    
    const allowedMimeTypes = {
      '.csv': ['text/csv', 'application/vnd.ms-excel'],
      '.xls': ['application/vnd.ms-excel'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      '.ods': ['application/vnd.oasis.opendocument.spreadsheet'],
      '.json': ['application/json', 'text/json']
    };
    
    if (!allowedMimeTypes[ext].includes(file.mimetype)) {
      // Store error message in request for later handling
      req.fileValidationError = `Invalid MIME type: ${file.mimetype} for extension ${ext}`;
      return cb(null, false);
    }
    
    cb(null, true);
  }
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid Authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
};

// Documentation endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'XLSX Conversion Service',
    endpoints: {
      '/convert': {
        method: 'POST',
        description: 'Convert csv, xls, xlsx, ods, or json to xlsx',
        request: 'multipart/form-data, field name: file',
        response: 'xlsx file as attachment',
        errors: ['File too large', 'Unsupported file type', 'Conversion error']
      },
      '/health': {
        method: 'GET',
        description: 'Health check',
        response: '{"status": "ok"}'
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// CORS test endpoint (no authentication required)
app.get('/cors-test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CORS is configured correctly', 
    origin: req.headers.origin || 'unknown' 
  });
});

// Conversion endpoint
app.post('/convert', verifyToken, upload.single('file'), async (req, res) => {
  console.log('Received /convert request');
  try {
    // Check if file validation failed
    if (req.fileValidationError) {
      console.warn(`File validation error: ${req.fileValidationError}`);
      return res.status(400).json({ error: req.fileValidationError });
    }
    
    if (!req.file) {
      console.warn('No file submitted in request');
      return res.status(400).json({ error: 'No file part in request. Please upload a file.' });
    }
    
    console.log(`Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    const inputPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const outputPath = path.join(path.dirname(inputPath), 'converted.xlsx');
    
    console.log(`Starting conversion: ${inputPath} -> ${outputPath}`);
    const conversionResult = await convertXlsToXlsx(inputPath, outputPath, ext);
    console.log(`Conversion complete. Results: ${JSON.stringify(conversionResult)}`);
    
    // Verify the output file exists before attempting to send it
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file not found at ${outputPath} after conversion`);
    }
    
    const stats = fs.statSync(outputPath);
    console.log(`Sending file to client: ${outputPath} (${stats.size} bytes)`);
    
    // Set proper headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.xlsx"');
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file to the client instead of using res.download
    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);
    
    // Handle stream errors
    fileStream.on('error', (err) => {
      console.error(`Stream error sending file: ${err}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming converted file' });
      }
    });
    
    // Clean up when done
    fileStream.on('end', () => {
      console.log('File stream completed, cleaning up temporary files');
      setTimeout(() => {
        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          console.log('Temporary files cleaned up successfully');
        } catch (cleanupErr) {
          console.warn(`Error during file cleanup: ${cleanupErr.message}`);
        }
      }, 1000); // Small delay to ensure file stream is fully closed
    });
    
  } catch (error) {
    console.error(`Conversion error: ${error.message}`, error);
    // Clean up files in case of error
    try {
      const inputPath = req.file?.path;
      const outputPath = inputPath ? path.join(path.dirname(inputPath), 'converted.xlsx') : null;
      
      if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.warn(`Error cleaning up after conversion error: ${cleanupErr.message}`);
    }
    
    return res.status(400).json({ 
      error: `Conversion failed: ${error.message}. Try saving as CSV or contact support.`,
      details: error.stack
    });
  }
});

// Error handling for multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        error: 'File exceeds 50MB limit. Try splitting your file or contact support for larger uploads.' 
      });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Function to try binding to a port with fallback options
const startServerWithPortFallback = async (initialPort, maxAttempts = 5) => {
  let currentPort = initialPort;
  let attempts = 0;
  let boundServer = null;

  // Print debugging info about the environment
  console.log(`Debug info - NODE_ENV: ${process.env.NODE_ENV}, KEEP_ALIVE: ${process.env.KEEP_ALIVE}`);
  console.log(`Debug info - Current directory: ${process.cwd()}`);
  console.log(`Debug info - Process ID: ${process.pid}`);

  while (attempts < maxAttempts) {
    try {
      console.log(`Attempting to start XLS Conversion Service on port ${currentPort}... (Attempt ${attempts + 1}/${maxAttempts})`);
      
      // Create a promise that resolves when the server starts or rejects on error
      const serverStartPromise = new Promise((resolve, reject) => {
        try {
          const server = app.listen(currentPort, () => {
            console.log(`✅ SUCCESS: XLS Conversion Service running on port ${currentPort}`);
            
            // If this isn't the preferred port, we should log a notice for the client
            if (currentPort !== PREFERRED_PORT) {
              console.log(`⚠️ NOTICE: Using alternative port ${currentPort} instead of preferred port ${PREFERRED_PORT}. Client may need to be updated.`);
            }
            
            resolve(server);
          });

          server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
              console.error(`❌ ERROR: Port ${currentPort} is already in use. Will try next port.`);
              reject(new Error(`Port ${currentPort} in use`));
            } else {
              console.error(`❌ ERROR: Unexpected server error: ${error.message}`);
              reject(error);
            }
          });

          // Keep the server reference
          boundServer = server;
        } catch (innerError) {
          console.error(`❌ ERROR: Failed in app.listen: ${innerError.message}`);
          reject(innerError);
        }
      });

      // Wait for the server to start or error out
      await serverStartPromise;
      return boundServer; // Successfully started
    } catch (error) {
      console.error(`❌ ERROR during port binding: ${error.message}`);
      attempts++;
      if (attempts >= maxAttempts) {
        console.error(`❌ FATAL: Failed to find an available port after ${maxAttempts} attempts. Exiting.`);
        // Don't exit if keep-alive is set
        if (process.env.KEEP_ALIVE !== 'true') {
          process.exit(1);
        } else {
          console.log(`⚠️ NOTICE: KEEP_ALIVE is set. Not exiting despite port binding failure.`);
          return null;
        }
      }
      // Try the next port
      currentPort = PREFERRED_PORT + attempts;
    }
  }
  
  return null;
};

// Start server if not being imported as a module
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log('Starting server with port fallback logic...');
    // Start the server with port fallback
    const serverPromise = startServerWithPortFallback(PORT);
    
    // Use a promise to handle async startup
    serverPromise.then(server => {
      if (server) {
        console.log('Server started successfully and is listening!');
        
        // Add a keep-alive mechanism
        if (process.env.KEEP_ALIVE === 'true') {
          console.log('Keep-alive is enabled. Server will remain running.');
          // This prevents the Node.js process from exiting
          setInterval(() => {
            console.log(`SERVER HEARTBEAT - Still running on port ${server.address().port}`);
          }, 30000); // Log every 30 seconds as a heartbeat
        }
      } else {
        console.log('Server failed to start but process will be kept alive.');
        // Keep the process alive anyway
        setInterval(() => {
          console.log('Process kept alive despite server startup failure.');
        }, 30000);
      }
    }).catch(error => {
      console.error(`Failed during server startup promise: ${error.message}`);
      if (process.env.KEEP_ALIVE !== 'true') {
        process.exit(1);
      }
    });
  } catch (error) {
    console.error(`FATAL: Failed to start server: ${error.message}`);
    if (process.env.KEEP_ALIVE !== 'true') {
      process.exit(1);
    } else {
      console.log('Keep-alive is enabled. Process will continue despite errors.');
      // Keep process alive despite errors
      setInterval(() => {
        console.log('Process kept alive despite errors.');
      }, 30000);
    }
  }
}

export default app;
