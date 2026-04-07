# XLS to XLSX Converter

Secure, **zero-CVE** XLS/XLSX/CSV/ODS/JSON conversion. Ships as both an
**npm package** (for use as a JS library or client SDK) and a **Docker image**
(for the full Python + Node service).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Python Version](https://img.shields.io/badge/python-%3E%3D3.8.0-blue.svg)
![Docker Scout](https://img.shields.io/badge/docker%20scout-0%20CVE-success.svg)
![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)

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

- Node.js **18+** (for the bundled `fetch` and modern ESM)
- Python 3.8+ with pip
- Git

### Server-Side Setup

```bash
git clone https://github.com/helloderekg/xls-converter.git
cd xls-converter

npm install
pip install -r requirements.txt

# Start both services together
npm start
```

`npm start` runs [start-services.js](./start-services.js), which spawns the
Python conversion service and the Node API gateway and forwards their logs.

### Starting individual components

```bash
npm run start:python   # Flask conversion service on :5001
npm run start:node     # Node API gateway on :4040
npm run start:client   # Static demo client on :4001 (python http.server)
```

### Docker Deployment

The project ships as a **zero-CVE container image** built on
[Chainguard's Wolfi base](https://images.chainguard.dev/), with Python and
Node.js bundled in a single hardened image. `docker scout` reports
**0 critical / 0 high / 0 medium / 0 low** vulnerabilities.

Docker Hub: https://hub.docker.com/r/derekgsayshi/xls-converter

```bash
# Pull
docker pull derekgsayshi/xls-converter:1.2.0

# Run (Node API on 4040, Python on 5001, demo client on 4001)
docker run --rm \
  -p 4040:4040 -p 5001:5001 -p 4001:4001 \
  derekgsayshi/xls-converter:1.2.0
```

Or build it yourself:

```bash
npm run docker:build   # builds :1.2.0 and :latest
npm run docker:run     # runs the image with default port mapping
npm run docker:scan    # runs `docker scout cves` against the image
```

The container starts three services on startup:

1. Python XLS conversion service - `http://localhost:5001` (internal)
2. Node API gateway              - `http://localhost:4040` (`/health`, `/convert`, `/cors-test`)
3. Static web client             - `http://localhost:4001`

#### Environment variables

| Variable                   | Default | Used by | Purpose                                              |
|----------------------------|---------|---------|------------------------------------------------------|
| `PORT`                     | `4040`  | Node    | Public API gateway port                              |
| `PYTHON_SERVICE_PORT`      | `5001`  | Python  | Internal conversion service port                     |
| `CLIENT_PORT`              | `4001`  | static  | Web demo port                                        |
| `SECRET_KEY`               | dev key | both    | JWT secret. **Must be the same** in Node and Python. |
| `REQUIRE_AUTH`             | `false` | Node    | Require Bearer JWT for `POST /convert`               |
| `XLS_CONVERSION_SERVICE_URL` | `http://localhost:5001` | Node | Where to forward conversion requests |

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

There are three ways to use this project, depending on what you actually
need:

### Mode 1 — Pure-JS library (no Python required)

For building XLSX files from JS data, or stripping formulas from existing
workbooks. These helpers run anywhere ExcelJS runs.

```bash
npm install xlsx-converter
```

```javascript
import { createXlsxBuffer, stripFormulas } from 'xlsx-converter';

// Build an XLSX from an array of objects
const buffer = await createXlsxBuffer([
  { name: 'Alice', score: 91 },
  { name: 'Bob',   score: 87 },
]);
fs.writeFileSync('out.xlsx', Buffer.from(buffer));

// Or harden an existing ExcelJS workbook against formula-injection
import ExcelJS from 'exceljs';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile('untrusted.xlsx');
stripFormulas(wb);
await wb.xlsx.writeFile('safe.xlsx');
```

### Mode 2 — Client SDK against a running converter service

Use this when you need to convert legacy `.xls` (or `.csv`/`.ods`) files —
that path needs the Python service running somewhere. The simplest way to
get a service is to `docker run` the image (see Mode 3 below).

```javascript
import fs from 'node:fs';
import { XlsConverterClient } from 'xlsx-converter';

const client = new XlsConverterClient('http://localhost:4040');

// Health check
console.log(await client.health()); // → { status: 'ok', timestamp: ... }

// Convert a file
const xlsxBytes = await client.convert(
  fs.readFileSync('legacy.xls'),
  { filename: 'legacy.xls', contentType: 'application/vnd.ms-excel' }
);
fs.writeFileSync('legacy.xlsx', Buffer.from(xlsxBytes));
```

In a browser:

```javascript
import { XlsConverterClient } from 'xlsx-converter/client';

const client = new XlsConverterClient('https://your-converter.example');
const file = document.querySelector('input[type=file]').files[0];
const xlsxBytes = await client.convert(file);

const url = URL.createObjectURL(new Blob([xlsxBytes]));
const a = document.createElement('a');
a.href = url;
a.download = file.name.replace(/\.[^.]+$/, '.xlsx');
a.click();
```

If the server has `REQUIRE_AUTH=true`, pass a Bearer JWT:

```javascript
const client = new XlsConverterClient('https://your-converter.example', {
  token: yourSignedJwt,
});
```

### Mode 3 — Full service via Docker (Python + Node bundled)

The `derekgsayshi/xls-converter` image bundles the Python conversion engine,
the Node API gateway, and the static web demo in a single zero-CVE container.

```bash
docker run --rm \
  -p 4040:4040 -p 5001:5001 -p 4001:4001 \
  derekgsayshi/xls-converter:1.2.0
```

Then `POST` your file to `http://localhost:4040/convert` (or open the demo
at `http://localhost:4001/`).

## 🔒 Security

### Application-level controls
- **Formula Stripping**: All formulas are removed from cells to prevent formula injection attacks
- **File Size Limits**: Default 50MB maximum file size to prevent DoS attacks
- **MIME Type Validation**: Strict validation of file types
- **JWT Authentication**: Protected API endpoints
- **Input Sanitization**: Proper handling of filenames and paths

### Container hardening (v1.2.0)
- **Zero CVEs**: Built on `cgr.dev/chainguard/wolfi-base`, which is rebuilt nightly
  against the latest CVE fixes. `docker scout cves` reports `0C / 0H / 0M / 0L`.
- **No build tools at runtime**: No `gcc`, no `npm`, no `curl` in the final image —
  only `python`, `nodejs`, and `busybox` (which provides `wget` for the healthcheck).
- **Non-root user**: The container runs as `appuser`, not root.
- **Multi-stage build**: Build dependencies (`build-base`, `npm`) live only in the
  intermediate stage and are dropped from the final image.
- **Lockfile regenerated in build**: `package-lock.json` is excluded from the build
  context and regenerated against the current `overrides`, so vulnerability scanners
  read fresh resolved versions instead of stale lockfile entries.
- **Single source of truth for the Node server** (new in 1.2.0): the old
  `test-server.js` (which had a dead `createExcelFile` reference and was
  drifting away from the canonical server) was deleted. Both local dev and
  the Docker image now run [src/server/index.js](./src/server/index.js).
- **JWT env var unified** (new in 1.2.0): Server↔Python auth uses `SECRET_KEY`
  on both sides. Previously the Node side read `JWT_SECRET_KEY` and the
  Python side read `SECRET_KEY` — same default value, so it worked in dev,
  but would silently break in any prod deployment that set a custom secret.

## 📈 Performance

- Handles files up to 50MB
- Benchmarked performance on large datasets
- Optimized memory usage

## 📚 Documentation

For complete documentation, visit the [docs folder](./docs/)

- [API Reference](./docs/api.md)
- [Security Guide](./docs/security.md)
- [Browser Integration](./docs/browser.md)
- [Usage Guide](./docs/usage.md)
- [Comparison with other libraries](./docs/comparison.md)
- [Why this exists](./docs/why.md)

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
