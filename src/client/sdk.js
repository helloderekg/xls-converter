// Tiny JavaScript client for a running xls-converter service (e.g. the
// Docker image at derekgsayshi/xls-converter). Works in both Node.js
// (via the built-in `fetch` available since Node 18) and modern browsers.
//
// Example (Node):
//   import fs from 'node:fs';
//   import { XlsConverterClient } from 'xls-to-xlsx';
//
//   const client = new XlsConverterClient('http://localhost:4040');
//   const xlsxBuffer = await client.convert(fs.createReadStream('foo.xls'), {
//     filename: 'foo.xls',
//   });
//   fs.writeFileSync('foo.xlsx', xlsxBuffer);
//
// Example (Browser):
//   const client = new XlsConverterClient('https://my-converter.example');
//   const xlsxBlob = await client.convert(file); // file from <input type=file>
//   // download as 'foo.xlsx' …

const DEFAULT_BASE_URL = 'http://localhost:4040';

export class XlsConverterClient {
  /**
   * @param {string} [baseUrl] - Base URL of the running xls-converter service.
   * @param {object} [options]
   * @param {string} [options.token] - Bearer JWT, if the service has
   *        REQUIRE_AUTH=true.
   * @param {typeof fetch} [options.fetch] - Custom fetch implementation
   *        (e.g. for proxies). Defaults to the global `fetch`.
   */
  constructor(baseUrl = DEFAULT_BASE_URL, options = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.fetch = options.fetch || globalThis.fetch;
    if (typeof this.fetch !== 'function') {
      throw new Error(
        'XlsConverterClient: no fetch() available. Pass options.fetch ' +
        'or run on Node 18+.'
      );
    }
  }

  /** GET /health → { status, timestamp } */
  async health() {
    const res = await this.fetch(`${this.baseUrl}/health`, {
      headers: this._authHeaders(),
    });
    if (!res.ok) throw new Error(`health check failed: HTTP ${res.status}`);
    return res.json();
  }

  /**
   * POST /convert
   *
   * @param {Blob|File|ReadableStream|Buffer|Uint8Array} file - The file
   *        contents to convert. In Node.js, a stream or Buffer works; in
   *        browsers, pass a File or Blob from an <input type=file>.
   * @param {object} [options]
   * @param {string} [options.filename] - Filename to send (controls the
   *        server-side extension check). Required when `file` doesn't
   *        have a `.name` property.
   * @param {string} [options.contentType]
   * @returns {Promise<ArrayBuffer>} The converted .xlsx bytes.
   */
  async convert(file, options = {}) {
    const form = new FormData();
    const filename = options.filename || file?.name;
    if (!filename) {
      throw new Error('convert(): options.filename is required when file has no .name');
    }

    // FormData in browsers wants a Blob; in Node 18+ FormData/Blob are
    // global. If the caller hands us a Buffer/Uint8Array, wrap it.
    let body = file;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(file)) {
      body = new Blob([file], { type: options.contentType || 'application/octet-stream' });
    } else if (file instanceof Uint8Array && !(file instanceof Blob)) {
      body = new Blob([file], { type: options.contentType || 'application/octet-stream' });
    }

    form.append('file', body, filename);

    const res = await this.fetch(`${this.baseUrl}/convert`, {
      method: 'POST',
      body: form,
      headers: this._authHeaders(),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch { /* not JSON */ }
      throw new Error(`convert failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
    }
    return res.arrayBuffer();
  }

  _authHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}

export default XlsConverterClient;
