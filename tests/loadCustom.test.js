import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import Monitor from "../src/index.js";
import { validateDataTable } from '../src/utils/helpers.js';

// Setup __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('loadCustom successfully loads data from a local directory', async () => {
  // Create monitor object
  let monitor = new Monitor();

  // Test data for Utah generated on 2025-07-01
  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  try {
    await monitor.loadCustom(baseName, baseUrl);
  } catch (err) {
    assert.unreachable(`loadCustom threw an error: ${err.message}`);
  }

  // Basic validation
  assert.is(monitor.meta._nrows, 25, 'meta has 25 rows.');
  assert.is(monitor.data._nrows, 241, 'meta has 241 rows.');
  assert.ok(monitor.meta.columnNames().includes('deviceDeploymentID'), 'meta includes expected columns');
  assert.ok(monitor.data.columnNames().includes('datetime'), 'data includes datetime column');

  // Higher level validation
  const ids = monitor.getIDs();
  assert.ok(ids.length > 0, 'getIDs returns some devices');
  assert.is(monitor.getTimezone(ids[0]), 'America/Denver', 'getTimezone works');
  assert.ok(Array.isArray(monitor.getPM25(ids[0])), 'getPM25 returns an array');
  assert.not.throws(() => validateDataTable(monitor.data), 'monitor.data is valid');
});

test.run();
