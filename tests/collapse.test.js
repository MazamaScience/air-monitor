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

test('collapse() reduces all time series into one with correct values and structure', () => {
  const collapsed = monitor.collapse('collapsedID', 'mean');

  // 1. Result should have only one time series in meta, and its
  //    deviceDeploymentID must equal the deviceID we passed in (which is also
  //    the name of the single data column) so the two tables stay aligned.
  assert.is(collapsed.meta.numRows(), 1);
  assert.ok(collapsed.meta.columnNames().includes('deviceDeploymentID'));
  assert.is(collapsed.meta.get('deviceDeploymentID', 0), 'collapsedID');

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

test('collapse returns a Monitor instance', () => {
  const result = monitor.collapse('collapsedID', 'mean');
  assert.instance(result, Monitor, 'collapse returns a Monitor');
});

test('collapsed Monitor is self-consistent: getIDs() resolves through accessors (H4)', () => {
  const collapsed = monitor.collapse('collapsedID', 'mean');

  // The id reported by meta must match the single data column...
  const ids = collapsed.getIDs();
  assert.equal(ids, ['collapsedID'], 'getIDs() returns the collapsed deviceID');
  assert.equal(
    collapsed.data.columnNames(),
    ['datetime', 'collapsedID'],
    'data column name matches the meta deviceDeploymentID'
  );

  // ...so the idiomatic getIDs() -> accessor round-trip must not throw.
  // Before the H4 fix this raised:
  //   Error: Device ID 'xxx_collapsedID' not found in monitor.data
  const id = ids[0];
  assert.not.throws(
    () => collapsed.getPM25(id),
    'getPM25 resolves the id returned by getIDs()'
  );

  const pm25 = collapsed.getPM25(id);
  assert.is(pm25.length, monitor.data.numRows(), 'PM2.5 series spans every hour');

  // Other id-keyed accessors should resolve the same id without throwing.
  assert.not.throws(() => collapsed.getNowcast(id), 'getNowcast resolves the id');
  assert.not.throws(() => collapsed.getMetaObject(id), 'getMetaObject resolves the id');
  assert.is(
    collapsed.getMetaObject(id).deviceDeploymentID,
    id,
    'getMetaObject returns the matching metadata row'
  );
});

test.run();
