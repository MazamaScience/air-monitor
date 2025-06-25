/**
 * Utility functions for parsing and cleaning raw CSV data into normalized
 * `meta` and `data` tables used by the Monitor class.
 *
 * These functions:
 * - Replace string `'NA'` with `null`
 * - Convert numeric fields to floats
 * - Optionally restrict metadata columns to core subsets
 * - Replace negative measurements (e.g. PM2.5) with zero
 *
 * Intended for internal use only.
 */

import * as aq from 'arquero';
const op = aq.op;

const FLOAT_COLUMNS = ['longitude', 'latitude', 'elevation'];

/**
 * Parses and cleans a metadata table.
 *
 * - Replaces string `'NA'` values with `null`
 * - Converts longitude, latitude, and elevation to floats
 * - Restricts output columns to `metadataNames` unless `useAllColumns` is true
 *
 * @param {aq.Table} dt - Raw Arquero table from CSV.
 * @param {boolean} [useAllColumns=false] - Whether to retain all columns.
 * @param {string[]} [metadataNames=[]] - Subset of columns to keep if `useAllColumns` is false.
 * @returns {aq.Table} Cleaned and optionally filtered metadata table.
 */
export function parseMeta(dt, useAllColumns = false, metadataNames = []) {
  const columns = dt.columnNames();
  const selectedColumns = useAllColumns ? columns : metadataNames;

  // Replace 'NA' with null
  const values1 = {};
  columns.forEach(col => {
    values1[col] = aq.escape(d => d[col] === 'NA' ? null : d[col]);
  });

  // Parse longitude, latitude, and elevation as floats (if present)
  const floatValues = {};
  FLOAT_COLUMNS.filter(col => columns.includes(col)).forEach(col => {
    floatValues[col] = aq.escape(d => parseFloat(d[col]));
  });

  return dt.derive(values1).derive(floatValues).select(selectedColumns);
}

/**
 * Parses and cleans a time-series measurement table.
 *
 * - Skips the first column (assumed to be `datetime`)
 * - Replaces string `'NA'` with `null`
 * - Converts all values to floats
 * - Replaces negative values with zero
 *
 * @param {aq.Table} dt - Raw Arquero table from CSV.
 * @returns {aq.Table} Cleaned data table suitable for use in a Monitor object.
 */
export function parseData(dt) {
  const ids = dt.columnNames().splice(1); // remove 'datetime'

  // NOTE:  2025-06-25
  // NOTE:  I tried replacing the string expressions with aq.escape() but never
  // NOTE:  got it to work. For now, we'll stick with the string expressions.

  // Replace 'NA' with null, and parse as float
  let values1 = {};
  ids.forEach(id => {
    values1[id] = `d => d['${id}'] === 'NA' ? null : op.parse_float(d['${id}'])`;
  });

  // Replace negative values with zero
  let values2 = {};
  ids.forEach(id => {
    values2[id] = `d => d['${id}'] < 0 ? 0 : d['${id}']`;
  });

  // Return the modified data table
  return dt.derive(values1).derive(values2);
}
