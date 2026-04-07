// Public npm entry point for `xls-to-xlsx`.
//
// This package can be used three different ways:
//
// 1. Pure-JS library (no Python required)
//      import { createXlsxBuffer, stripFormulas } from 'xls-to-xlsx';
//
//    These work standalone via ExcelJS — no external service needed.
//
// 2. As a client to a running converter service (Docker or local Python)
//      import { XlsConverterClient } from 'xls-to-xlsx';
//      const client = new XlsConverterClient('http://localhost:4040');
//      const xlsxBuffer = await client.convert(filePath);
//
// 3. As a server-side wrapper around the Python service (when both are
//    running on the same host or in the same Docker image)
//      import { convertXlsToXlsx } from 'xls-to-xlsx';
//      await convertXlsToXlsx('input.xls', 'out.xlsx', '.xls');

export {
  convertXlsToXlsx,
  createXlsxBuffer,
  stripFormulas,
} from './server/converter.js';

export { XlsConverterClient } from './client/sdk.js';
