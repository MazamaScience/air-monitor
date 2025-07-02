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

test('returns a valid daily stats object for a known deviceDeploymentID', () => {
  const id = monitor.data.columnNames()[1]; // skip 'datetime'
  const result = monitor.getDailyStats(id);

  assert.ok(typeof result === 'object', 'Result is an object');
  const keys = ['datetime', 'count', 'min', 'mean', 'max'];
  for (const key of keys) {
    assert.ok(Array.isArray(result[key]), `result.${key} is an array`);
  }

  const len = result.datetime.length;
  for (const key of ['count', 'min', 'mean', 'max']) {
    assert.is(result[key].length, len, `${key} array has same length as datetime`);
  }
});

test('throws an error for unknown deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getDailyStats('nonexistent-device');
  }, /not found/, 'Throws error for unknown ID');
});

test('throws an error for null deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getDailyStats(null);
  }, /Expected deviceDeploymentID/, 'Throws error for null input');
});

test.run();
