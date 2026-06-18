// Tests for parseData() cleaning rules, including robustness against
// deviceDeploymentIDs that contain characters which would break
// string-interpolated Arquero expressions.

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import * as aq from 'arquero';
import { DateTime } from 'luxon';
import { parseData } from '../src/utils/parse.js';

function hourlyDatetime(n) {
  const start = DateTime.fromISO('2025-01-01T00:00:00Z', { zone: 'utc' });
  return Array.from({ length: n }, (_, i) => start.plus({ hours: i }));
}

test('parseData applies NA->null, float parse, and negative->zero', () => {
  const dt = aq.table({
    datetime: hourlyDatetime(4),
    device_001: ['1.5', 'NA', '-3', '2'],
  });

  const cleaned = parseData(dt);

  assert.equal(cleaned.array('device_001'), [1.5, null, 0, 2]);
});

test('parseData maps non-finite values: NaN/+Infinity->null, -Infinity->0', () => {
  // -Infinity is caught by the negative->zero rule before the finite check,
  // so it collapses to 0; NaN and +Infinity become null.
  const dt = aq.table({
    datetime: hourlyDatetime(4),
    device_001: ['not-a-number', 'Infinity', '-Infinity', '5'],
  });

  const cleaned = parseData(dt);

  assert.equal(cleaned.array('device_001'), [null, null, 0, 5]);
});

test('parseData preserves the datetime column unchanged', () => {
  const datetimes = hourlyDatetime(3);
  const dt = aq.table({
    datetime: datetimes,
    device_001: ['1', '2', '3'],
  });

  const cleaned = parseData(dt);

  assert.is(cleaned.columnNames()[0], 'datetime');
  assert.equal(cleaned.array('datetime'), datetimes);
});

test('parseData handles deviceDeploymentIDs containing quotes/backslashes', () => {
  // Under the old string-interpolated expressions this column name produced
  // invalid generated code and threw; with aq.escape it is handled safely.
  const id = "ab'c\\d";
  const dt = aq.table({
    datetime: hourlyDatetime(3),
    [id]: ['4.2', 'NA', '-1'],
  });

  const cleaned = parseData(dt);

  assert.ok(cleaned.columnNames().includes(id), 'quirky ID column preserved');
  assert.equal(cleaned.array(id), [4.2, null, 0]);
});

test.run();
