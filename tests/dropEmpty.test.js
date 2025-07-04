// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';

// test.before.each(async () => {
test.before(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  monitor = new Monitor();
  await monitor.loadCustom(baseName, baseUrl);
});

let monitor;

test('dropEmpty returns a Monitor instance', () => {
  const result = monitor.dropEmpty();
  assert.instance(result, Monitor, 'dropEmpty returns a Monitor');
});

test('dropEmpty preserves series with valid data', () => {
  const dropped = monitor.dropEmpty();

  const allCols = dropped.data.columnNames().filter(c => c !== 'datetime');
  const validCounts = dropped.data
    .rollup(Object.fromEntries(
      allCols.map(col => [col, `d => op.valid(d['${col}'])`])
    ))
    .object(0);

  for (const [col, count] of Object.entries(validCounts)) {
    assert.ok(count > 0, `Time series '${col}' has at least one valid value`);
  }

  assert.ok(
    dropped.meta.array('deviceDeploymentID').every(id => allCols.includes(id)),
    'Meta matches the retained columns'
  );
});

test('dropEmpty removes series with only missing values', () => {
  // Step 1: Pick an existing deviceDeploymentID (i.e., a column in data and a row in meta)
  const targetID = monitor.meta.array('deviceDeploymentID')[0];
  assert.ok(monitor.data.columnNames().includes(targetID), 'Target column exists in data');

  // Step 2: Replace all values in that column with null
  const modifiedData = monitor.data.derive({ [targetID]: () => null });

  // Step 3: Build a new Monitor with the modified data
  const includesEmpty = new Monitor(monitor.meta, modifiedData);

  // Step 4: Run dropEmpty()
  const result = includesEmpty.dropEmpty();

  // Step 5: Verify that the column is removed from data
  assert.not.ok(result.data.columnNames().includes(targetID), 'Column with only nulls is dropped from data');

  // Step 6: Verify that the row is removed from meta
  assert.not.ok(result.meta.array('deviceDeploymentID').includes(targetID), 'Row is dropped from meta');

  // Step 7: Assert that exactly one row was removed
  assert.is(
    result.meta.numRows(),
    monitor.meta.numRows() - 1,
    'Meta table has one fewer row after dropping empty series'
  );
});

test('dropEmpty keeps datetime column', () => {
  const dropped = monitor.dropEmpty();
  assert.ok(dropped.data.columnNames().includes('datetime'), 'datetime column is preserved');
});

test.run();
