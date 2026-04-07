// Integration tests for the consolidated Node API gateway.
//
// These tests import the Express app directly (not over HTTP) so they
// run without starting a real server. /convert tests that exercise the
// Python service are gated on whether it's running locally.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET_KEY = 'test-secret';
const PYTHON_URL = process.env.XLS_CONVERSION_SERVICE_URL || 'http://localhost:5001';

// Probe the Python service once. Tests that need it are skipped if it's
// not running so the suite still passes in CI without the full stack.
let pythonRunning = false;
beforeAll(async () => {
  try {
    const r = await fetch(`${PYTHON_URL}/health`);
    pythonRunning = r.ok;
  } catch {
    pythonRunning = false;
  }
  if (!pythonRunning) {
    console.warn(`⚠️  Python service not reachable at ${PYTHON_URL}; /convert tests will be skipped.`);
  }
});

// Import the app AFTER setting env vars so it picks them up.
process.env.SECRET_KEY = SECRET_KEY;
process.env.REQUIRE_AUTH = 'true';
const { default: app } = await import('../../src/server/index.js');

describe('XLS Converter API — integration', () => {
  const tempDir = path.join(__dirname, '../../temp');
  const token = jwt.sign({ sub: 'test-user' }, SECRET_KEY);

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (!fs.existsSync(tempDir)) return;
    for (const f of fs.readdirSync(tempDir)) {
      try { fs.unlinkSync(path.join(tempDir, f)); } catch { /* ignore */ }
    }
  });

  describe('GET /', () => {
    it('returns the endpoint catalog', async () => {
      const res = await request(app).get('/').expect(200).expect('Content-Type', /json/);
      expect(res.body.service).toBe('xls-converter');
      expect(res.body.endpoints).toHaveProperty('POST /convert');
      expect(res.body.endpoints).toHaveProperty('GET /health');
    });
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/health').expect(200).expect('Content-Type', /json/);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /cors-test', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/cors-test').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /convert (REQUIRE_AUTH=true)', () => {
    it('rejects requests without an Authorization header', async () => {
      const res = await request(app).post('/convert').expect(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('rejects requests with an invalid token', async () => {
      const res = await request(app)
        .post('/convert')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('rejects authenticated requests with no file', async () => {
      const res = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(res.body.error).toMatch(/No file uploaded/);
    });

    it('rejects unsupported file extensions', async () => {
      const res = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('plain text'), 'test.txt')
        .expect(400);
      expect(res.body.error).toBeTruthy();
    });

    it('converts JSON to XLSX (requires Python service)', async () => {
      if (!pythonRunning) {
        console.warn('  ↳ skipped (no Python service)');
        return;
      }

      const testData = JSON.stringify([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]);

      const res = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true)
        .responseType('blob')
        .attach('file', Buffer.from(testData), {
          filename: 'test.json',
          contentType: 'application/json',
        })
        .expect(200)
        .expect('Content-Type', /spreadsheetml\.sheet/);

      const outputPath = path.join(tempDir, 'output.xlsx');
      fs.writeFileSync(outputPath, res.body);
      expect(fs.existsSync(outputPath)).toBe(true);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(outputPath);
      expect(wb.worksheets.length).toBeGreaterThan(0);
    });
  });
});
