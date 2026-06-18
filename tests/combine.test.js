// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';

test.before(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  fullMonitor = new Monitor();
  await fullMonitor.loadCustom(baseName, baseUrl);
});

let fullMonitor;

test('combine() merges metadata and time series correctly', () => {
  const allIDs = fullMonitor.getIDs();

  // Create a 2-series subset
  const monitor2 = fullMonitor.select(allIDs.slice(0, 2));

  // Create a 3-series subset (including overlap with monitor2)
  const monitor3 = fullMonitor.select(allIDs.slice(1, 4));

  // Combine monitor2 and monitor3
  const combined = monitor2.combine(monitor3);

  // Metadata should include only unique deviceDeploymentIDs
  const expectedIDs = new Set([...allIDs.slice(0, 2), ...allIDs.slice(2, 4)]);
  const combinedIDs = new Set(combined.getIDs());
  assert.equal(combinedIDs, expectedIDs);

  // Meta row count should match number of unique IDs
  assert.is(combined.meta.numRows(), expectedIDs.size);

  // Data columns should match ['datetime', ...deviceDeploymentIDs]
  const expectedCols = ['datetime', ...[...expectedIDs]];
  assert.equal(combined.data.columnNames(), expectedCols);

  // Data row count should match original monitor row count
  assert.is(combined.data.numRows(), fullMonitor.data.numRows());

  // All numeric values should be finite or null, and rounded to 1 decimal place
  const numericCols = combined.data.columnNames().filter(c => c !== 'datetime');
  for (const col of numericCols) {
    const values = combined.data.array(col);
    for (const val of values) {
      assert.ok(
        Number.isFinite(val) || val === null,
        `Value in ${col} must be finite or null, got ${val}`
      );
      if (Number.isFinite(val)) {
        const rounded = Math.round(val * 10) / 10;
        assert.is(val, rounded, `Value ${val} in ${col} not rounded to 1 decimal`);
      }
    }
  }
});

test('combine() with disjoint monitors merges all series', () => {
  const allIDs = fullMonitor.getIDs();
  const mid = Math.floor(allIDs.length / 2);

  const monitorA = fullMonitor.select(allIDs.slice(0, mid));
  const monitorB = fullMonitor.select(allIDs.slice(mid));

  const combined = monitorA.combine(monitorB);

  const expectedIDs = new Set([...monitorA.getIDs(), ...monitorB.getIDs()]);
  assert.equal(new Set(combined.getIDs()), expectedIDs);
  assert.is(combined.meta.numRows(), expectedIDs.size);
});

test('combine() of time-disjoint monitors yields a gap-free hourly axis', () => {
  const allIDs = fullMonitor.getIDs();

  // Two monitors covering non-overlapping time ranges. Without reindexing, the
  // join_full union would leave a multi-day hole in the datetime axis.
  const a = fullMonitor.select(allIDs.slice(0, 2)).filterDatetime('2025-06-21', '2025-06-22', 'UTC');
  const b = fullMonitor.select(allIDs.slice(2, 4)).filterDatetime('2025-06-25', '2025-06-26', 'UTC');

  const combined = a.combine(b);
  const dt = combined.data.array('datetime');

  // Datetime axis must be strictly increasing and spaced exactly 1 hour apart.
  for (let i = 1; i < dt.length; i++) {
    const diff = Math.round(dt[i].diff(dt[i - 1], 'hours').hours);
    assert.is(diff, 1, `gap before row ${i}: ${dt[i - 1].toISO()} -> ${dt[i].toISO()}`);
  }

  // The interior hours present in neither input must have been filled in, so the
  // combined axis is longer than the simple sum of the two input row counts.
  assert.ok(
    dt.length > a.data.numRows() + b.data.numRows(),
    'interior hours should be null-filled, not dropped'
  );

  // Filled cells must be null (not undefined/NaN), preserving the data invariant.
  const numericCols = combined.data.columnNames().filter(c => c !== 'datetime');
  for (const col of numericCols) {
    for (const val of combined.data.array(col)) {
      assert.ok(
        Number.isFinite(val) || val === null,
        `Value in ${col} must be finite or null, got ${val}`
      );
    }
  }
});

test('combine() with fully overlapping monitor does not duplicate data', () => {
  const copy = fullMonitor.select(fullMonitor.getIDs()); // clone
  const combined = fullMonitor.combine(copy);

  assert.equal(combined.getIDs(), fullMonitor.getIDs());
  assert.is(combined.meta.numRows(), fullMonitor.meta.numRows());
  assert.equal(combined.data.columnNames(), fullMonitor.data.columnNames());
  assert.is(combined.data.numRows(), fullMonitor.data.numRows());
});

test.run();
