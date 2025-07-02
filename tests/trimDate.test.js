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
  // NOTE:  'originalDates' and 'trimmedDates' are JS 'Date' objects.
  // NOTE:  They are stored in 'UTC' internally but displayed in your
  // NOTE:  computer's system timezone by default.
  // NOTE:  We use the luxon 'DateTime' object for timezone-aware manipulations.
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

    const startLocal = DateTime.fromJSDate(trimmedDates[0], { zone: tz });
    const endLocal = DateTime.fromJSDate(trimmedDates.at(-1), { zone: tz });

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

test.run();
