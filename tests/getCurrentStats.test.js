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

test('getCurrentStatus returns a table with matching number of rows', () => {
  const status = monitor.getCurrentStatus();

  assert.is(status.numRows(), monitor.meta.numRows(), 'Status table has same number of rows as meta');
});

test('getCurrentStatus includes lastValidDatetime and lastValidPM_25 columns', () => {
  const status = monitor.getCurrentStatus();
  const columns = status.columnNames();

  assert.ok(columns.includes('lastValidDatetime'), 'Includes lastValidDatetime column');
  assert.ok(columns.includes('lastValidPM_25'), 'Includes lastValidPM_25 column');
});

test('lastValidDatetime values are Luxon UTC DateTime instances', () => {
  const status = monitor.getCurrentStatus();
  const datetimes = status.array('lastValidDatetime');

  assert.ok(
    datetimes.every(dt => DateTime.isDateTime(dt)),
    'All lastValidDatetime values are Luxon DateTime objects'
  );

  assert.ok(
    datetimes.every(dt => dt.zoneName === 'UTC'),
    'All lastValidDatetime values are in UTC'
  );
});

test('lastValidPM_25 values are finite or null', () => {
  const status = monitor.getCurrentStatus();
  const values = status.array('lastValidPM_25');

  assert.ok(
    values.every(v => v === null || (typeof v === 'number' && Number.isFinite(v))),
    'All lastValidPM_25 values are null or finite numbers'
  );
});

test('deviceDeploymentIDs in status match original meta', () => {
  const status = monitor.getCurrentStatus();
  const originalIDs = monitor.meta.array('deviceDeploymentID');
  const statusIDs = status.array('deviceDeploymentID');

  assert.ok(
    statusIDs.every(id => originalIDs.includes(id)),
    'All deviceDeploymentIDs in status are from the original meta'
  );
});

test.run();
