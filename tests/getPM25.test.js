// tests/getPM25.test.js
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

test('returns a rounded PM2.5 time series for a valid deviceDeploymentID', () => {
  const id = monitor.data.columnNames()[1]; // use first ID in data ('datetime' is in column 0)
  const raw = monitor.data.array(id);
  const rounded = monitor.getPM25(id);

  assert.ok(Array.isArray(rounded), 'Output is an array');
  assert.is(rounded.length, raw.length, 'Output array has same length as input');

  for (let i = 0; i < raw.length; i++) {
    const input = raw[i];
    const output = rounded[i];

    if (input === null || input === undefined || isNaN(input)) {
      assert.is(output, null, `Index ${i}: Preserves nulls and non-numeric`);
    } else {
      const expected = Math.round(input * 10) / 10;
      assert.is(output, expected, `Index ${i}: Correctly rounded to 1 decimal place`);
    }
  }
});

test('throws an error for unknown deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getPM25('nonexistent-device');
  }, /not found in monitor\.data/, 'Throws error for unknown ID');
});

test('throws an error for null deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getPM25(null);
  }, /Expected deviceDeploymentID to be a string/, 'Throws error for null ID');
});

test('throws an error for object as deviceDeploymentID', () => {
  assert.throws(() => {
    monitor.getPM25({ id: 'abc' });
  }, /Expected deviceDeploymentID/, 'Throws error for object input');
});

test.run();
