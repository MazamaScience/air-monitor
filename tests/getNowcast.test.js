// tests/getNowcast.test.js
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

test('returns an array of numbers or nulls for a valid deviceDeploymentID', () => {
  const id = monitor.data.columnNames()[1]; // skip 'datetime' column
  const result = monitor.getNowcast(id);

  assert.ok(Array.isArray(result), 'Result is an array');

  for (let i = 0; i < result.length; i++) {
    const val = result[i];
    assert.ok(
      typeof val === 'number' || val === null,
      `Index ${i}: value is number or null`
    );
  }
});

test('throws an error for unknown deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getNowcast('nonexistent-device');
  }, /not found in monitor\.data/, 'Throws error for unknown ID');
});

test('throws an error for null deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getNowcast(null);
  }, /Expected deviceDeploymentID/, 'Throws error for null input');
});

test('throws an error for object as deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getNowcast({ id: 'abc' });
  }, /Expected deviceDeploymentID/, 'Throws error for object input');
});

test.run();

