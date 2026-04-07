// XLS Converter — Node API gateway.
//
// This is the single canonical Node server. It exposes:
//   GET  /            — service info / endpoint catalog
//   GET  /health      — liveness probe
//   GET  /cors-test   — sanity check for CORS
//   POST /convert     — multipart upload, returns the converted .xlsx
//
// The actual conversion work is done by the Python Flask service in
// `src/server/xls-conversion-service.py`. This server is just a thin
// auth-and-routing layer in front of it.
//
// Auth model:
//   - Server → Python: always required. JWT signed with SECRET_KEY.
//   - Client → Server: disabled by default so the bundled web demo works
//     out of the box. Set REQUIRE_AUTH=true to require a Bearer JWT
//     signed with SECRET_KEY for /convert.
//
// Env vars:
//   PORT          (default 4040)
//   SECRET_KEY    (default 'dev-secret-key-change-in-production')
//   REQUIRE_AUTH  (default 'false')
//   XLS_CONVERSION_SERVICE_URL  (default 'http://localhost:5001')

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

const PORT = parseInt(process.env.PORT, 10) || 4040;
const SECRET_KEY = process.env.SECRET_KEY || 'dev-secret-key-change-in-production';
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.ods', '.json'];
const ALLOWED_MIME_TYPES = {
  '.csv':  ['text/csv', 'application/vnd.ms-excel'],
  '.xls':  ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ods':  ['application/vnd.oasis.opendocument.spreadsheet'],
  '.json': ['application/json', 'text/json'],
};

const app = express();

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());

// Multer storage — temp dir lives at <repo>/temp so it's writable inside the
// container's /app/temp (created by docker-entrypoint.sh).
const tempDir = path.join(__dirname, '../../temp');
fs.mkdirSync(tempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${file.fieldname}-${suffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      req.fileValidationError = 'Only Excel, CSV, ODS and JSON files are allowed';
      return cb(null, false);
    }
    if (!ALLOWED_MIME_TYPES[ext].includes(file.mimetype)) {
      req.fileValidationError = `Invalid MIME type ${file.mimetype} for extension ${ext}`;
      return cb(null, false);
    }
    cb(null, true);
  },
});

// Optional client → server JWT verification.
const verifyToken = (req, res, next) => {
  if (!REQUIRE_AUTH) return next();
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
  }
  try {
    req.user = jwt.verify(authHeader.slice('Bearer '.length), SECRET_KEY);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
};

// ---------- Routes ----------

app.get('/', (req, res) => {
  res.json({
    service: 'xls-converter',
    endpoints: {
      'GET /health':    'Liveness probe',
      'GET /cors-test': 'CORS sanity check',
      'POST /convert':  'multipart/form-data, field "file" → returns xlsx',
    },
    formats: ALLOWED_EXTENSIONS,
    auth: REQUIRE_AUTH ? 'Bearer JWT (SECRET_KEY)' : 'disabled',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/cors-test', (req, res) => {
  res.json({ status: 'ok', origin: req.headers.origin || 'unknown' });
});

app.post('/convert', verifyToken, upload.single('file'), async (req, res) => {
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });
  }

  const inputPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const outputPath = path.join(path.dirname(inputPath), `converted-${Date.now()}.xlsx`);

  const cleanup = () => {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  };

  try {
    console.log(`/convert: ${req.file.originalname} (${req.file.size} bytes)`);
    await convertXlsToXlsx(inputPath, outputPath, ext);

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Converter did not produce ${outputPath}`);
    }
    const stats = fs.statSync(outputPath);
    const downloadName = `${path.basename(req.file.originalname, ext)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Length', stats.size);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.on('error', (err) => {
      console.error(`Stream error: ${err.message}`);
      cleanup();
      if (!res.headersSent) res.status(500).json({ error: 'Error streaming file' });
    });
    fileStream.on('close', cleanup);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`/convert failed: ${error.message}`);
    cleanup();
    res.status(502).json({ error: `Conversion failed: ${error.message}` });
  }
});

// Map multer's typed errors to clean JSON responses.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds 50MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

// Auto-start when run directly (skipped during `vitest` import).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`xls-converter API listening on http://0.0.0.0:${PORT}`);
    console.log(`  GET  /health`);
    console.log(`  GET  /cors-test`);
    console.log(`  POST /convert  (auth: ${REQUIRE_AUTH ? 'required' : 'disabled'})`);
  });
}

export default app;
