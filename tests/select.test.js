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

test('select() accepts a single ID string', () => {
  const ids = monitor.getIDs();
  const singleID = ids[0];

  const selected = monitor.select(singleID);

  assert.equal(selected.getIDs(), [singleID]);
  assert.is(selected.meta.numRows(), 1);
  assert.equal(selected.data.columnNames(), ['datetime', singleID]);
});

test('select() accepts an array of IDs and preserves order', () => {
  const ids = monitor.getIDs();
  const subset = [ids[2], ids[0], ids[1]];

  const selected = monitor.select(subset);

  // Check that meta rows and data columns are in the same order
  assert.equal(selected.getIDs(), subset);
  assert.equal(selected.data.columnNames(), ['datetime', ...subset]);
});

test('select() throws an error on empty array', () => {
  assert.throws(() => {
    monitor.select([]);
  }, /non-empty string or array/);
});

test('select() throws an error if ID not found', () => {
  assert.throws(() => {
    monitor.select(['not-a-real-id']);
  }, /deviceDeploymentID 'not-a-real-id' not found/);
});

test('select() throws if IDs include duplicates', () => {
  const id = monitor.getIDs()[0];

  assert.throws(() => {
    monitor.select([id, id]);
  }, /duplicate deviceDeploymentID/i);
});


test('select() throws if input includes null or undefined', () => {
  const id = monitor.getIDs()[0];

  assert.throws(() => {
    monitor.select([id, null]);
  }, /deviceDeploymentID 'null' not found/);

  assert.throws(() => {
    monitor.select([undefined]);
  }, /deviceDeploymentID 'undefined' not found/);
});

test('select() throws if input is a number or boolean', () => {
  assert.throws(() => {
    monitor.select(42);
  }, /non-empty string or array/);

  assert.throws(() => {
    monitor.select(true);
  }, /non-empty string or array/);
});

test('select() throws if array includes non-string values', () => {
  const id = monitor.getIDs()[0];

  assert.throws(() => {
    monitor.select([id, 123]);
  }, /deviceDeploymentID '123' not found/);

  assert.throws(() => {
    monitor.select([id, {}]);
  }, /deviceDeploymentID '\[object Object\]' not found/);
});

test.run();

