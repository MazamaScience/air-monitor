// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs
// - both Luxon DateTime and string+timezone inputs to filterDatetime()

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import Monitor from '../src/index.js';

let monitor;

// test.before.each(async () => {
test.before(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  monitor = new Monitor();
  await monitor.loadCustom(baseName, baseUrl);
});

test('filterDatetime returns a Monitor instance', () => {
  const datetime = monitor.data.array('datetime');
  assert.ok(datetime.length > 0, 'Fixture has datetime values');

  const start = datetime[0];
  const end = datetime[datetime.length - 1];

  const filtered = monitor.filterDatetime(start, end);

  assert.instance(filtered, Monitor, 'Returns a Monitor instance');
  assert.is(
    filtered.data.numRows(),
    monitor.data.numRows(),
    'Full-range filter returns all rows'
  );
});

test('filterDatetime with string inputs and timezone preserves full range', () => {
  const datetime = monitor.data.array('datetime');
  assert.ok(datetime.length > 0, 'Fixture has datetime values');

  const timezone = monitor.meta.get('timezone', 0);

  const firstLocal = datetime[0].setZone(timezone);
  const lastLocal = datetime[datetime.length - 1].setZone(timezone);

  const startStr = firstLocal.toISODate(); // date-only → start of day
  const endStr = lastLocal.toISODate();    // date-only → end of day

  const filtered = monitor.filterDatetime(startStr, endStr, timezone);

  assert.instance(filtered, Monitor, 'Returns a Monitor instance');
  assert.is(
    filtered.data.numRows(),
    monitor.data.numRows(),
    'Date-only string range covers all rows'
  );
});

test('filterDatetime restricts to a narrower datetime window', () => {
  const datetime = monitor.data.array('datetime');
  const len = datetime.length;
  assert.ok(len > 10, 'Fixture has enough rows for subsetting');

  // Choose a middle window using Luxon DateTime inputs (no timezone arg needed)
  const iStart = Math.floor(len / 4);
  const iEnd = Math.floor(len / 4) + 10 < len
    ? Math.floor(len / 4) + 10
    : len - 1;

  const startDT = datetime[iStart];
  const endDT = datetime[iEnd];

  const filtered = monitor.filterDatetime(startDT, endDT);
  const filteredDates = filtered.data.array('datetime');

  assert.ok(filteredDates.length > 0, 'Filtered window is not empty');
  assert.ok(
    filteredDates[0] >= startDT.toUTC(),
    'Filtered start datetime is >= requested start'
  );
  assert.ok(
    filteredDates.at(-1) <= endDT.toUTC(),
    'Filtered end datetime is <= requested end'
  );

  assert.ok(
    filtered.data.numRows() <= monitor.data.numRows(),
    'Filtered rows <= original rows'
  );
});

test('filterDatetime with non-overlapping range returns empty data', () => {
  const datetime = monitor.data.array('datetime');
  const len = datetime.length;
  assert.ok(len > 0, 'Fixture has datetime values');

  const last = datetime[len - 1];

  const start = last.plus({ days: 1 });
  const end = last.plus({ days: 2 });

  const filtered = monitor.filterDatetime(start, end);

  assert.instance(filtered, Monitor, 'Returns a Monitor instance');
  assert.is(filtered.data.numRows(), 0, 'Non-overlapping range returns zero rows');
  assert.is(
    filtered.meta.numRows(),
    monitor.meta.numRows(),
    'Metadata is preserved even when data is empty'
  );
});

test('filterDatetime preserves the datetime column', () => {
  const datetime = monitor.data.array('datetime');
  const start = datetime[0];
  const end = datetime[datetime.length - 1];

  const filtered = monitor.filterDatetime(start, end);

  assert.ok(
    filtered.data.columnNames().includes('datetime'),
    'datetime column is present after filtering'
  );
});

test.run();
