// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';
import { DateTime } from 'luxon';
import * as aq from 'arquero';

// Build a synthetic Monitor on a gap-free hourly UTC axis where `emptyDays`
// (zero-based local-day indices) are entirely null and all other days carry
// data. Used to exercise the empty-day edge trimming.
function makeDayMonitor(nDays, emptyDays) {
  const start = DateTime.fromISO('2025-01-01T00:00:00Z', { zone: 'utc' });
  const n = nDays * 24;
  const datetime = Array.from({ length: n }, (_, i) => start.plus({ hours: i }));
  const empty = new Set(emptyDays);
  const id = 'synthetic_device_001';
  const values = datetime.map((_, i) => (empty.has(Math.floor(i / 24)) ? null : 10));
  const data = aq.table({ datetime, [id]: values });
  const meta = aq.table({ deviceDeploymentID: [id], timezone: ['UTC'] });
  return new Monitor(meta, data);
}

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

test('trimDate returns a Monitor instance', () => {
  const timezone = monitor.meta.get('timezone', 0);
  const trimmed = monitor.trimDate(timezone);
  assert.instance(trimmed, Monitor, 'Returns a Monitor instance');
});

test('trimDate trims incomplete days across timezones', () => {
  // 'originalDates' and 'trimmedDates' are Luxon DateTime objects in UTC.
  // We convert them to the desired timezone for checking 00:00–23:00 bounds.
  const timezones = [
    'America/Los_Angeles',
    'America/Denver',
    'America/New_York',
    'UTC'
  ];

  const originalDates = monitor.data.array('datetime');

  for (const tz of timezones) {
    const trimmed = monitor.trimDate(tz);
    const trimmedDates = trimmed.data.array('datetime');

    const startLocal = trimmedDates[0].setZone(tz);
    const endLocal = trimmedDates.at(-1).setZone(tz);

    assert.is(startLocal.hour, 0, `Start of trimmed data is 00:00 in ${tz}`);
    assert.is(endLocal.hour, 23, `End of trimmed data is 23:00 in ${tz}`);
    assert.ok(trimmedDates.length <= originalDates.length, `Trimmed rows <= original for ${tz}`);
  }
});

test('trimDate preserves the datetime column', () => {
  const timezone = monitor.meta.get('timezone', 0);
  const trimmed = monitor.trimDate(timezone);

  assert.ok(trimmed.data.columnNames().includes('datetime'), 'datetime column is present');
  assert.ok(trimmed.data.numRows() > 0, 'Trimmed data is not empty');
});

test('trimDate removes ALL fully-empty days at both edges', () => {
  // 6 UTC days: days 0,1 (leading) and 4,5 (trailing) empty; days 2,3 have data.
  const m = makeDayMonitor(6, [0, 1, 4, 5]);
  const trimmed = m.trimDate('UTC');
  const dt = trimmed.data.array('datetime');

  // Only days 2 and 3 should remain (48 hours).
  assert.is(dt.length, 48, 'two empty days trimmed from each edge');
  assert.is(dt[0].toISO(), DateTime.fromISO('2025-01-03T00:00:00Z', { zone: 'utc' }).toISO());
  assert.is(dt.at(-1).toISO(), DateTime.fromISO('2025-01-04T23:00:00Z', { zone: 'utc' }).toISO());
});

test('trimDate on all-empty data yields an empty result', () => {
  const m = makeDayMonitor(4, [0, 1, 2, 3]);
  const trimmed = m.trimDate('UTC');

  assert.is(trimmed.data.numRows(), 0, 'all days empty -> no rows');
  assert.ok(trimmed.data.columnNames().includes('datetime'), 'datetime column preserved');
});

test.run();
