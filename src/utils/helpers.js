import { DateTime } from 'luxon';

import Monitor from '../index.js';

/**
 * Internal utility functions for data transformation and cleanup in the `air-monitor` package.
 * These helpers are used across modules to support scientific data processing workflows.
 *
 * - `arrayMean()`: Computes the arithmetic mean of valid numeric entries in an array.
 * - `round1()`: Rounds numeric measurement columns in an Arquero table to 1 decimal place.
 * - `validateDeviceID()`: Verifies that a single ID exists in the monitor object.
 *
 * All functions in this file are pure and side-effect-free.
 * Intended for internal use within the package.
 */

/**
 * Computes the arithmetic mean of an array of numbers, ignoring non-numeric values.
 *
 * @param {Array<*>} arr - The input array (may contain nulls, strings, or other types).
 * @returns {number|null} The mean of valid numbers, or null if none are found.
 */
export function arrayMean(arr) {
  const valid = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return valid.length > 0 ? sum / valid.length : null;
}

/**
 * round1
 *
 * Round all numeric columns (except 'datetime') to 1 decimal place.
 * Converts non-finite values (NaN, Infinity, undefined) to `null`.
 *
 * @param {aq.Table} table - Input table with 'datetime' as the first column.
 * @returns {aq.Table} - New table with rounded numeric values and nulls.
 */
export function round1(table) {
  const columns = table.columnNames().filter(name => name !== 'datetime');

  const expressions = Object.fromEntries(
    columns.map(col => [
      col,
      // Wrap in finite check — if not finite, return null
      `d => op.is_finite(d['${col}']) ? op.round(d['${col}'] * 10) / 10 : null`
    ])
  );

  return table.derive(expressions);
}

/**
 * Validates and resolves a deviceDeploymentID.
 * Accepts either a string or a single-element string array.
 * Verifies that the resolved ID exists in monitor.data.
 *
 * @param {Monitor} monitor - The Monitor instance containing time-series data.
 * @param {string | string[]} id - A single string or a single-element array.
 * @returns {string} A validated deviceDeploymentID string.
 *
 * @throws {Error} If input is invalid or the ID does not exist in monitor.data.
 */
export function validateDeviceID(monitor, id) {
  let deviceID;

  if (typeof id === 'string') {
    deviceID = id;
  } else if (Array.isArray(id) && id.length === 1 && typeof id[0] === 'string') {
    deviceID = id[0];
  } else {
    throw new Error(
      `Expected deviceDeploymentID to be a string or a single-element string array. Received: ${JSON.stringify(id)}`
    );
  }

  const availableIDs = monitor.data.columnNames();
  if (!availableIDs.includes(deviceID)) {
    throw new Error(`Device ID '${deviceID}' not found in monitor.data`);
  }

  return deviceID;
}

/**
 * Asserts that the value is a Monitor instance.
 * Useful for verifying return types of public methods.
 * @param {*} result - The value to check.
 * @param {string} methodName - Name of the method returning the value (for error messages).
 */
export function assertIsMonitor(result, methodName = 'unknown') {
  if (!(result instanceof Monitor)) {
    throw new Error(`${methodName}() must return a Monitor instance`);
  }
}

/**
 * Browser-safe assert function.
 * Throws an Error if the condition is false.
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Validates a Monitor data table with the following requirements:
 * - Must contain a 'datetime' column with only valid Luxon UTC DateTime objects
 * - Datetimes must be in strictly increasing order, spaced exactly 1 hour apart
 * - All other columns must be numeric
 *
 * @param {aq.Table} table - The Arquero table to validate.
 * @throws {Error} If validation fails.
 */
export function validateDataTable(table) {
  assert(table.columnNames().includes('datetime'), `'datetime' column is missing`);

  const datetimes = table.array('datetime');
  const n = datetimes.length;

  for (let i = 0; i < n; i++) {
    const dt = datetimes[i];
    assert(DateTime.isDateTime(dt), `Row ${i}: datetime is not a Luxon DateTime`);
    assert(dt.isValid, `Row ${i}: datetime is invalid: ${dt.invalidReason}`);
    assert(dt.zoneName === 'UTC', `Row ${i}: datetime is not in UTC`);
  }

  for (let i = 1; i < n; i++) {
    const prev = datetimes[i - 1];
    const curr = datetimes[i];
    const diff = curr.diff(prev, 'hours').hours;
    assert(diff === 1, `Row ${i}: datetime gap is ${diff} hours (expected 1 hour)`);
  }

  for (const col of table.columnNames()) {
    if (col === 'datetime') continue;

    const colData = table.array(col);
    for (let i = 0; i < colData.length; i++) {
      const val = colData[i];
      const isValid =
        val === null ||
        (typeof val === 'number' && Number.isFinite(val));

      assert(isValid, `Row ${i}, column '${col}': value is not numeric or null`);
    }
  }
}