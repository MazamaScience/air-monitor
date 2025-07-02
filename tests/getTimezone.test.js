// tests/getTimezone.test.js
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';

// Setup __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test file location
const baseName = 'test';
const baseUrl = `file://${path.resolve(__dirname)}`;

// Fresh monitor instance per test
let monitor;

// test.before.each(async () => {
test.before(async () => {
  monitor = new Monitor();
  await monitor.loadCustom(baseName, baseUrl);
});

test('returns the correct Olson timezone for a valid deviceDeploymentID', () => {
  const id = monitor.meta.get('deviceDeploymentID', 0);
  const expected = monitor.meta.get('timezone', 0);
  const result = monitor.getTimezone(id);
  assert.is(result, expected, 'Returns correct timezone string');
});

test('returns the correct timezone when deviceDeploymentID is passed as [string]', () => {
  const id = monitor.meta.get('deviceDeploymentID', 0);
  const expected = monitor.meta.get('timezone', 0);
  const result = monitor.getTimezone([id]);
  assert.is(result, expected, 'Returns correct timezone from single-element array');
});

test('throws an error for unknown deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone('nonexistent-device');
  }, /not found in metadata/, 'Throws error for unknown ID');
});

test('throws error for null deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone(null);
  }, /Expected deviceDeploymentID/, 'Rejects null input');
});

test('throws error for undefined deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone(undefined);
  }, /Expected deviceDeploymentID/, 'Rejects undefined input');
});

test('throws error for empty string deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone('');
  }, /not found in metadata/, 'Rejects empty string as unknown ID');
});

test('throws error for number as deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone(12345);
  }, /Expected deviceDeploymentID/, 'Rejects numeric input');
});

test('throws error for object as deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getTimezone({ id: 'abc' });
  }, /Expected deviceDeploymentID/, 'Rejects object input');
});

test('throws error for empty array', () => {
  assert.throws(() => {
    monitor.getTimezone([]);
  }, /Expected deviceDeploymentID/, 'Rejects empty array');
});

test('throws error for array of length > 1', () => {
  assert.throws(() => {
    monitor.getTimezone(['id1', 'id2']);
  }, /Expected deviceDeploymentID/, 'Rejects array of length > 1');
});

test('throws error for array with non-string item', () => {
  assert.throws(() => {
    monitor.getTimezone([42]);
  }, /Expected deviceDeploymentID/, 'Rejects array with non-string element');
});

test.run();
