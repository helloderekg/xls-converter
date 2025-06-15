import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import app from '../../src/server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('XLS Converter API Integration Tests', () => {
  const tempDir = path.join(__dirname, '../../temp');
  const JWT_SECRET = 'test-secret';
  let token;
  
  beforeEach(() => {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create a test token
    token = jwt.sign({ sub: 'test-user' }, JWT_SECRET);
    
    // Set environment variable for JWT verification
    process.env.JWT_SECRET = JWT_SECRET;
  });
  
  afterEach(() => {
    // Clean up any test files created
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch (error) {
          // Ignore errors during cleanup
        }
      });
    }
  });
  
  describe('GET /', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('/convert');
      expect(response.body.endpoints).toHaveProperty('/health');
    });
  });
  
  describe('GET /health', () => {
    it('should return OK status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('POST /convert', () => {
    it('should reject requests without authorization', async () => {
      const response = await request(app)
        .post('/convert')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });
    
    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/convert')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });
    
    it('should reject requests without file', async () => {
      const response = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('No file part in request');
    });
    
    it('should reject unsupported file types', async () => {
      const response = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('test'), 'test.txt')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should convert JSON to XLSX', async () => {
      const testData = JSON.stringify([
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ]);
      
      const response = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .buffer(true) // Ensure response is treated as a buffer for binary data
        .responseType('blob') // Specify we expect binary data
        .attach('file', Buffer.from(testData), 'test.json')
        .expect(200)
        .expect('Content-Type', /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
      
      // Save the response to a file to verify it's a valid Excel file
      const outputPath = path.join(tempDir, 'output.xlsx');
      fs.writeFileSync(outputPath, response.body);
      
      // Verify the file exists and is a valid Excel file
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Use ExcelJS to validate the file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(outputPath);
      
      // Verify the workbook has at least one worksheet
      expect(workbook.worksheets.length).toBeGreaterThan(0);
      
      // Verify the contents of the Excel file
      const worksheet = workbook.worksheets[0];
      expect(worksheet).toBeDefined();
    });
  });
  
  // Performance benchmarking test
  describe('Performance benchmarks', () => {
    it('should handle conversion within acceptable time', async () => {
      // Create a larger dataset to test performance
      const testData = [];
      for (let i = 0; i < 1000; i++) {
        testData.push({
          id: i,
          name: `Test Name ${i}`,
          value: Math.random() * 1000
        });
      }
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/convert')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(JSON.stringify(testData)), 'large.json')
        .expect(200);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // The conversion should complete within a reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });
});
