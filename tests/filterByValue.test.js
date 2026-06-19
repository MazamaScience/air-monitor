// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import * as aq from 'arquero';
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

test('filterByValue works when the first row of the column is null', () => {
  const target = 'sentinel';
  const nullFirstMonitor = new Monitor();
  // Build a string column whose first row is null and remaining rows are valid.
  // op.row_number() is 1-based, so row 1 is the first row.
  nullFirstMonitor.meta = monitor.meta.derive({
    nullableCol: `d => op.row_number() === 1 ? null : '${target}'`,
  });
  nullFirstMonitor.data = monitor.data;

  const filtered = nullFirstMonitor.filterByValue('nullableCol', target);

  assert.ok(filtered.meta.numRows() > 0, 'Meta table is not empty');
  assert.ok(
    filtered.meta.array('nullableCol').every(v => v === target),
    'All meta rows match the target value'
  );
  // The null first row should have been excluded.
  assert.is(filtered.meta.numRows(), monitor.meta.numRows() - 1, 'Null first row excluded');
});

test('filterByValue throws if the column is entirely null', () => {
  const allNullMonitor = new Monitor();
  allNullMonitor.meta = monitor.meta.derive({ allNull: () => null });

  assert.throws(() => {
    allNullMonitor.filterByValue('allNull', 'anything');
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

test('filterByValue handles a column name containing a dot', () => {
  // Regression: the old string-interpolated expression `d.${columnName}` broke
  // for names with dots (d.foo.bar is a nested lookup, not a column access).
  const colName = 'meta.source';
  const target = 'test-value';
  const dotColMonitor = new Monitor();
  dotColMonitor.meta = monitor.meta.derive({ [colName]: aq.escape(() => target) });
  dotColMonitor.data = monitor.data;

  const filtered = dotColMonitor.filterByValue(colName, target);

  assert.ok(filtered.meta.numRows() > 0, 'Returns non-empty result');
  assert.ok(
    filtered.meta.array(colName).every(v => v === target),
    'All rows match the target value'
  );
});

test('filterByValue handles a string value containing a backslash', () => {
  // Regression: the old escaping only handled single quotes, not backslashes,
  // so a value like "path\\to\\file" produced an invalid generated expression.
  const target = 'path\\to\\file';
  const backslashMonitor = new Monitor();
  backslashMonitor.meta = monitor.meta.derive({ pathCol: aq.escape(() => target) });
  backslashMonitor.data = monitor.data;

  const filtered = backslashMonitor.filterByValue('pathCol', target);

  assert.ok(filtered.meta.numRows() > 0, 'Returns non-empty result');
  assert.ok(
    filtered.meta.array('pathCol').every(v => v === target),
    'All rows match the backslash value'
  );
});

test.run();