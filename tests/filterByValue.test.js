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

test('filterByValue returns filtered monitor by string metadata value', () => {
  const row = monitor.meta.objects()[0];
  const locationName = row.locationName;

  const filtered = monitor.filterByValue('locationName', locationName);

  assert.ok(filtered.meta.numRows() > 0, 'Meta table is not empty');
  assert.ok(filtered.meta.array('locationName').every(tz => tz === locationName), 'All meta rows match locationName');
  assert.ok(filtered.data.columnNames().includes('datetime'), 'Data includes datetime column');
  assert.is(filtered.data.columnNames().length, filtered.meta.numRows() + 1, 'Data columns = meta rows + datetime');
});

test('filterByValue returns filtered monitor by numeric metadata value', () => {
  const col = monitor.meta.columnNames().find(c => typeof monitor.meta.get(c, 0) === 'number');
  assert.ok(col, 'Found numeric column');

  const value = monitor.meta.get(col, 0);
  const filtered = monitor.filterByValue(col, value);

  assert.ok(filtered.meta.numRows() > 0, 'Meta table is not empty');
  assert.ok(filtered.meta.array(col).every(v => v === value), 'All meta rows match numeric value');
  assert.ok(filtered.data.columnNames().includes('datetime'), 'Data includes datetime column');
});

test('filterByValue throws if column is missing', () => {
  assert.throws(() => {
    monitor.filterByValue('not_a_column', 'anything');
  }, /Column 'not_a_column' not found/);
});

test('filterByValue throws if numeric parsing fails', () => {
  const col = monitor.meta.columnNames().find(c => typeof monitor.meta.get(c, 0) === 'number');
  assert.ok(col, 'Found numeric column');

  assert.throws(() => {
    monitor.filterByValue(col, 'not-a-number');
  }, /could not be parsed as a number/);
});

test('filterByValue throws if column type is unsupported', () => {
  const badMonitor = new Monitor();
  badMonitor.meta = monitor.meta.derive({ dummy: () => ({ nested: true }) });

  assert.throws(() => {
    badMonitor.filterByValue('dummy', 'anything');
  }, /Unsupported column type/);
});

test('filterByValue supports chaining on the returned Monitor', () => {
  const deploymentType = monitor.meta.get('deploymentType', 0);
  const instrumentDescription = monitor.meta.get('instrumentDescription', 0);

  const filtered = monitor
    .filterByValue('deploymentType', deploymentType)
    .filterByValue('instrumentDescription', instrumentDescription);

  assert.ok(filtered.meta.numRows() > 0, 'Chained filters return non-empty meta');
  assert.ok(filtered.meta.array('deploymentType').every(v => v === deploymentType), 'All rows match deploymentType');
  assert.ok(filtered.meta.array('instrumentDescription').every(v => v === instrumentDescription), 'All rows match instrumentDescription');
  assert.ok(filtered.data.columnNames().includes('datetime'), 'Data includes datetime after chaining');
});

test('filterByValue returns a Monitor instance', () => {
  const value = monitor.meta.get('timezone', 0);
  const result = monitor.filterByValue('timezone', value);
  assert.instance(result, Monitor, 'Result is an instance of Monitor');
});

test.run();