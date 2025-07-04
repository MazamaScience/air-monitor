import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as aq from "arquero";
import { DateTime } from 'luxon';
import { validateDataTable } from '../src/utils/helpers.js';

// Helper to build a minimal valid table
function makeValidTable(n = 3) {
  const start = DateTime.utc(2025, 6, 21, 0);
  return aq.table({
    datetime: Array.from({ length: n }, (_, i) => start.plus({ hours: i })),
    deviceA: [1.1, 2.2, 3.3],
    deviceB: [10, 20, 30],
  });
}

test('validateDataTable() passes on valid hourly UTC DateTime table', () => {
  const table = makeValidTable();
  assert.not.throws(() => validateDataTable(table));
});

test('throws if datetime column is missing', () => {
  const table = aq.table({ foo: [1, 2, 3] });
  assert.throws(() => validateDataTable(table), /'datetime' column is missing/);
});

test('throws if any datetime is not a Luxon DateTime', () => {
  const table = makeValidTable();
  const bad = table.derive({ datetime: () => '2025-06-21T00:00:00Z' });
  assert.throws(() => validateDataTable(bad), /datetime is not a Luxon DateTime/);
});

test('throws if datetime is not in UTC', () => {
  const localDTs = [0, 1, 2].map(h => DateTime.local(2025, 6, 21, h));
  const table = aq.table({
    datetime: localDTs,
    deviceA: [1, 2, 3],
  });
  assert.throws(() => validateDataTable(table), /datetime is not in UTC/);
});

test('throws if datetime spacing is not 1 hour', () => {
  const base = DateTime.utc(2025, 6, 21, 0);
  const table = aq.table({
    datetime: [base, base.plus({ hours: 2 }), base.plus({ hours: 3 })],
    deviceA: [1, 2, 3],
  });
  assert.throws(() => validateDataTable(table), /datetime gap is 2 hours/);
});

test('throws if a data column contains a non-numeric, non-null value', () => {
  const table = makeValidTable();
  const bad = table.derive({
    deviceA: 'row_number() === 2 ? "NaN" : 42' // injects a string into the second row
  });
  assert.throws(() => validateDataTable(bad), /value is not numeric or null/);
});

test('passes if a data column contains nulls and numbers', () => {
  const table = makeValidTable();
  const withNull = table.derive({
    deviceA: 'row_number() === 2 ? null : 42'
  });
  assert.not.throws(() => validateDataTable(withNull));
});


test.run();
