import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import Monitor from '../src/index.js';

// Setup __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Accessors and Utilities work as expected', async () => {
  const monitor = new Monitor();

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  await monitor.loadCustom(baseName, baseUrl);

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
  assert.ok(datetimes[0] instanceof Date, 'getDatetime returns Date objects');
  assert.is(datetimes.length, 241, 'getDatetime returns correct number of rows');

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
