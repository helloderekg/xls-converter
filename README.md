# XLS to XLSX Converter

A secure, reliable, and efficient XLS/XLSX conversion service with support for multiple formats, powered by a Python core service with JavaScript wrappers.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![Python Version](https://img.shields.io/badge/python-%3E%3D3.8.0-blue.svg)

## 🚀 Overview

The XLS to XLSX Converter is a modern solution for converting various spreadsheet formats (XLS, CSV, ODS, JSON) to the XLSX format. It features a **Python-based core conversion service** with JavaScript wrappers and interfaces, addressing the historical pain points of handling XLS files in JavaScript environments by providing a reliable, secure, and efficient conversion service.

### Why it Exists

Converting XLS files in JavaScript environments has been traditionally challenging due to:

- **Lack of Official Specifications**: The binary XLS/BIFF formats lack public specifications, making implementation difficult
- **JavaScript Library Limitations**: As confirmed by SheetJS documentation, "There is no official specification for any of these [BIFF2-5] formats," forcing JS libraries to rely on reverse-engineering with inconsistent results
- **Browser Limitations**: Browsers have limited capability to handle binary compound file formats (CFB)
- **Edge Cases**: Many existing libraries have significant limitations with older XLS versions or complex spreadsheets
- **Security Concerns**: Formula-based attacks and insufficient validation in many converters

### Architecture Approach

This project takes a **hybrid approach** to solve these challenges:

- **Python Core Service**: Leverages Python's robust pandas+xlrd ecosystem for reliable parsing of legacy XLS formats
- **JavaScript Wrappers**: Provides clean JS/Node.js wrappers and interfaces for web applications
- **Microservice Design**: Deployed as a standalone service or integrated directly in applications

This architecture provides a production-grade solution to these challenges, combining the reliability of Python's mature XLS parsing libraries with clean JavaScript interfaces and robust security measures.

## ✨ Features

- **Multiple Format Support**: Convert from XLS, XLSX, CSV, ODS, and JSON to XLSX
- **Security Focused**: Automatic formula stripping to prevent security vulnerabilities
- **Browser & Node.js Support**: Use either as a service or directly in the browser
- **Comprehensive Testing**: Validated against real-world edge cases
- **Authentication**: JWT-based authentication for API endpoints
- **Interactive Demo**: Browser-based demo for easy testing
- **API & Client Libraries**: Clean interfaces for integration

## 📋 Installation & Setup

### Prerequisites

- Node.js 14+ 
- Python 3.8+ with pip
- Git

### Server-Side Setup

```bash
# Clone the repository
git clone https://github.com/helloderekg/xlsx-converter.git
cd xlsx-converter

# Install JavaScript dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Start all services (Python conversion service and Node.js wrapper)
npm start
```

### Starting Individual Components

You can also start each component separately in this order:

```bash
# 1. Start the Python conversion service
npm run start:python

# 2. Start the Node.js wrapper (in another terminal)
npm run start:node

# 3. Start the web client (in another terminal)
npm run start:client
# Or use: npx serve src/client -l 4001
```

### Docker Deployment

The project includes a complete Docker setup for one-command deployment with all services running in the proper order.

```bash
# Build the Docker image
docker build -t xls-converter .

# Run the container with all ports exposed
docker run -p 4040:4040 -p 5001:5001 -p 4001:4001 xls-converter
```

The Docker container starts three services in this order:

1. Test server (API endpoint) - `http://localhost:4040`
2. Python XLS conversion service (internal service) - `http://localhost:5001`
3. Web client interface - `http://localhost:4001`

You can also use Docker Compose:

```bash
# Build and start with Docker Compose
npm run docker:build
npm run docker:up

# Stop services
npm run docker:down
```

#### Environment Variables

When using Docker, you can customize ports using environment variables:

- `PORT`: Test server port (default: 4040)
- `PYTHON_SERVICE_PORT`: Python service port (default: 5001)
- `CLIENT_PORT`: Web client port (default: 4001)

Example with custom ports:
```bash
docker run -e PORT=8080 -e PYTHON_SERVICE_PORT=8081 -e CLIENT_PORT=8082 -p 8080:8080 -p 8081:8081 -p 8082:8082 xls-converter
```

## 🛠️ Usage

### API Usage

```javascript
// Server-side example
import express from 'express';
import { convertXlsToXlsx } from 'xlsx-converter';

const app = express();

app.post('/convert', async (req, res) => {
  try {
    const result = await convertXlsToXlsx(
      req.files.input.path, 
      './output.xlsx',
      path.extname(req.files.input.name)
    );
    
    res.download('./output.xlsx');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Browser Usage

```javascript
// Browser example
import { createXlsxBuffer } from 'xlsx-converter/client';

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('file-input').files[0];
  
  try {
    const xlsxBuffer = await createXlsxBuffer(file);
    
    // Create download link
    const url = URL.createObjectURL(new Blob([xlsxBuffer]));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'converted.xlsx';
    link.click();
  } catch (error) {
    console.error('Conversion failed:', error);
  }
});
```

## 🔒 Security

The converter implements several security measures:

- **Formula Stripping**: All formulas are removed from cells to prevent formula injection attacks
- **File Size Limits**: Default 50MB maximum file size to prevent DoS attacks
- **MIME Type Validation**: Strict validation of file types
- **JWT Authentication**: Protected API endpoints
- **Input Sanitization**: Proper handling of filenames and paths

## 📈 Performance

- Handles files up to 50MB
- Benchmarked performance on large datasets
- Optimized memory usage

## 📚 Documentation

For complete documentation, visit the [docs folder](./docs/) or the [GitHub Pages site](https://helloderekg.github.io/xlsx-converter/).

- [API Reference](./docs/api.md)
- [Security Guide](./docs/security.md)
- [Browser Integration](./docs/browser.md)
- [Testing & Validation](./docs/testing.md)

## 🧪 Testing

Comprehensive tests are available in the `test` directory:

# Run all tests
npm test

# Run with coverage report
npm run test:coverage

The test suite includes:

- **Unit Tests**: Core functionality testing
- **Integration Tests**: Full API endpoint testing
- **Real-world Files**: Tests against a library of challenging XLS files
- **Edge Cases**: Handling of corrupted or unusual files
- **Performance Tests**: Benchmarks for large files

## 🔄 Related Solutions

This project was created after extensive research into existing solutions:

- **SheetJS/xlsx**: Comprehensive but with some limitations on older XLS formats
- **exceljs**: Strong XLSX support but limited XLS capabilities
- **node-xlsx**: Simple interface but lacks robust error handling
- **And more**: See our [comparison document](./docs/comparison.md)

## 🤝 Contributing

Contributions are welcome! Please see our [contributing guidelines](./CONTRIBUTING.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
