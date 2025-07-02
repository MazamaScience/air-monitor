// tests/getDiurnalStats.test.js
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

test('returns valid diurnal stats for a known deviceDeploymentID', () => {
  const id = monitor.data.columnNames()[1]; // skip 'datetime'
  const result = monitor.getDiurnalStats(id);

  assert.ok(typeof result === 'object', 'Returns an object');

  const keys = ['hour', 'count', 'min', 'mean', 'max'];
  for (const key of keys) {
    assert.ok(Array.isArray(result[key]), `${key} is an array`);
  }

  const len = result.hour.length;
  for (const key of ['count', 'min', 'mean', 'max']) {
    assert.is(result[key].length, len, `${key} length matches hour length`);
  }
});

test('returns diurnal stats using custom dayCount value', () => {
  const id = monitor.data.columnNames()[1];
  const result = monitor.getDiurnalStats(id, 3);

  assert.ok(Array.isArray(result.hour), 'hour is an array');
  assert.ok(result.mean.length > 0, 'mean contains values');
});

test('throws an error for unknown deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getDiurnalStats('nonexistent-device');
  }, /not found/, 'Throws for unknown device ID');
});

test('throws an error for null deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getDiurnalStats(null);
  }, /Expected deviceDeploymentID/, 'Throws for null input');
});

test.run();
