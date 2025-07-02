/**
 * @module utils/helpers
 *
 * @description
 * Internal utility functions for data transformation and cleanup in the `air-monitor` package.
 * These helpers are used across modules to support scientific data processing workflows.
 *
 * - `arrayMean(arr)`: Computes the arithmetic mean of valid numeric entries in an array.
 * - `round1(table)`: Rounds numeric measurement columns in an Arquero table to 1 decimal place.
 * - `validateDeviceID(monitor, id)`: Verifies that a single ID exists in the monitor object.
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
 * Rounds all numeric columns in an Arquero time-series `data` table to 1 decimal place,
 * skipping the 'datetime' column.
 *
 * @param {aq.Table} table - The canonical data table with a 'datetime' column and one or more numeric series.
 * @returns {aq.Table} A new table with rounded values (to 1 decimal place) for all measurement columns.
 */
export function round1(table) {
  const columns = table.columnNames().filter(name => name !== 'datetime');

  const expressions = Object.fromEntries(
    columns.map(col => [
      col,
      `d => op.round(d['${col}'] * 10) / 10`
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

