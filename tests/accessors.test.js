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

test('Accessors and Utilities work as expected', async () => {
  // Test getIDs
  const ids = monitor.getIDs();
  assert.ok(Array.isArray(ids), 'getIDs returns an array');
  assert.is(ids.length, 25, 'getIDs returns 25 IDs');
  assert.type(ids[0], 'string', 'IDs are strings');

  // Test count
  assert.is(monitor.count(), 25, 'count returns correct number of meta rows');

  // Test getDatetime
  const datetimes = monitor.getDatetime();
  assert.ok(Array.isArray(datetimes), 'getDatetime returns an array');
  assert.ok(DateTime.isDateTime(datetimes[0]), 'getDatetime returns Luxon DateTime objects');
  assert.is(datetimes.length, 241, 'getDatetime returns correct number of rows');

  // Check that all DateTime objects are in UTC
  const allUTC = datetimes.every(dt => dt.zoneName === 'UTC');
  assert.ok(allUTC, 'All datetimes are in UTC');

  // Test getMetadata
  const testID = ids[0];
  const field = 'locationName';
  const value = monitor.getMetadata(testID, field);
  assert.ok(typeof value === 'string' || typeof value === 'number', 'getMetadata returns a string or number');

  // Test getMetaObject
  const metaObj = monitor.getMetaObject(testID);
  assert.ok(metaObj && typeof metaObj === 'object', 'getMetaObject returns an object');
  assert.ok('deviceDeploymentID' in metaObj, 'getMetaObject includes deviceDeploymentID');
  assert.is(metaObj.deviceDeploymentID, testID, 'getMetaObject returns the correct ID');
});

test.run();
