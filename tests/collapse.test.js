import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';

let monitor;

// Load test data once before all tests
// test.before.each(async () => {
test.before(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  monitor = new Monitor();
  await monitor.loadCustom(baseName, baseUrl);
});

test('collapse() reduces all time series into one with correct values and structure', () => {
  const collapsed = monitor.collapse('collapsedID', 'mean');

  // 1. Result should have only one time series in meta
  assert.is(collapsed.meta.numRows(), 1);
  assert.ok(collapsed.meta.columnNames().includes('deviceDeploymentID'));
  assert.ok(collapsed.meta.get('deviceDeploymentID', 0).startsWith('xxx_collapsedID'));

  // 2. Result data should have same number of rows as input
  assert.is(collapsed.data.numRows(), monitor.data.numRows());

  // 3. Result data should have exactly ['datetime', 'collapsedID'] columns
  assert.equal(collapsed.data.columnNames(), ['datetime', 'collapsedID']);

  // 4. All values in collapsedID should be numeric or null
  const values = collapsed.data.array('collapsedID');
  for (const v of values) {
    assert.ok(
      Number.isFinite(v) || v === null,
      `Value must be number or null, got ${v}`
    );
  }

  // 5. All numeric values should be rounded to 1 decimal place
  for (const v of values) {
    if (typeof v === 'number') {
      const rounded = Math.round(v * 10) / 10;
      assert.is(
        v,
        rounded,
        `Value ${v} is not rounded to 1 decimal place`
      );
    }
  }
});

test.run();
