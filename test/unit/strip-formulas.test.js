import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { stripFormulas } from '../../src/server/converter.js';

/* stripFormulas is exported from the package root and from xls-to-xlsx/server,
 * and it is the JS side of the "formulas are stripped" claim. It threw on every
 * workbook that contained a formula — `cell.formula` is getter-only in ExcelJS —
 * and the assignment before it would have written the { formula, result } object
 * straight back, so even without the throw nothing was stripped. Nothing in the
 * suite exercised it with a real formula, so both went unnoticed. */

function workbookWithFormulas() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('S');
  ws.addRow(['name', 'qty', 'price', 'total']);
  ws.addRow(['Alpha', 3, 9.99]);
  ws.getCell('D2').value = { formula: 'B2*C2', result: 29.97 };
  ws.addRow(['Beta', 7, 21.5]);
  ws.getCell('D3').value = { formula: 'B3*C3', result: 150.5 };
  return { wb, ws };
}

describe('stripFormulas', () => {
  it('does not throw on a workbook containing formulas', () => {
    const { wb } = workbookWithFormulas();
    expect(() => stripFormulas(wb)).not.toThrow();
  });

  it('removes the formula from every cell that had one', () => {
    const { wb, ws } = workbookWithFormulas();
    expect(ws.getCell('D2').formula).toBe('B2*C2');

    stripFormulas(wb);

    for (const addr of ['D2', 'D3']) {
      expect(ws.getCell(addr).formula, `${addr} formula`).toBeFalsy();
    }
  });

  it('keeps the computed result in place of the formula', () => {
    const { wb, ws } = workbookWithFormulas();
    stripFormulas(wb);
    expect(ws.getCell('D2').value).toBe(29.97);
    expect(ws.getCell('D3').value).toBe(150.5);
  });

  it('leaves plain cells untouched', () => {
    const { wb, ws } = workbookWithFormulas();
    stripFormulas(wb);
    expect(ws.getCell('A2').value).toBe('Alpha');
    expect(ws.getCell('B2').value).toBe(3);
    expect(ws.getCell('C2').value).toBe(9.99);
  });

  it('survives a save/load round-trip with no formulas left in the XML', async () => {
    const { wb } = workbookWithFormulas();
    stripFormulas(wb);
    const buf = await wb.xlsx.writeBuffer();

    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buf);
    const ws = reloaded.worksheets[0];

    expect(ws.getCell('D2').formula).toBeFalsy();
    expect(ws.getCell('D2').value).toBe(29.97);
  });

  it('empties a formula cell whose result ExcelJS did not retain', () => {
    // ExcelJS drops falsy results. Verified in both directions: assigning
    // { formula: 'X', result: 0 } stores {"formula":"X"} with no result key,
    // and loading a file whose sheet XML literally contains <v>0</v> also
    // yields {"formula":"1-1"} with no result key. So a zero can never reach
    // this function, and the right outcome is an empty cell rather than a
    // formula left in place. The `??` in the implementation is still correct
    // over `||`: it is what would preserve a 0 if ExcelJS ever surfaced one.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.getCell('A1').value = { formula: '1-1', result: 0 };
    expect(ws.getCell('A1').value).toEqual({ formula: '1-1' });

    stripFormulas(wb);

    expect(ws.getCell('A1').formula).toBeFalsy();
    expect(ws.getCell('A1').value).toBeNull();
  });

  it('returns the same workbook it was given', () => {
    const { wb } = workbookWithFormulas();
    expect(stripFormulas(wb)).toBe(wb);
  });

  it('is a no-op on a workbook with no formulas', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['a', 1]);
    expect(() => stripFormulas(wb)).not.toThrow();
    expect(ws.getCell('A1').value).toBe('a');
    expect(ws.getCell('B1').value).toBe(1);
  });
});
