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

import { validateDataTable } from './helpers.js';

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
 * - Replaces non-finite values (e.g. NaN, Infinity) with null
 * - Validates the final table using validateDataTable()
 *
 * @param {aq.Table} dt - Raw Arquero table from CSV.
 * @returns {aq.Table} Cleaned data table suitable for use in a Monitor object.
 * @throws {Error} If validation fails after cleaning.
 */
export function parseData(dt) {
  const ids = dt.columnNames().slice(1); // skip 'datetime'

  // Replace 'NA' with null, then parse as float
  const values1 = {};
  ids.forEach(id => {
    values1[id] = `d => d['${id}'] === 'NA' ? null : op.parse_float(d['${id}'])`;
  });

  // Replace negative values with zero
  const values2 = {};
  ids.forEach(id => {
    values2[id] = `d => d['${id}'] < 0 ? 0 : d['${id}']`;
  });

  // Replace non-finite values (e.g. NaN, Infinity) with null
  const values3 = {};
  ids.forEach(id => {
    values3[id] = `d => d['${id}'] != null && !op.is_finite(d['${id}']) ? null : d['${id}']`;
  });

  const cleaned = dt.derive(values1).derive(values2).derive(values3);

  // Final check: ensure datetime is valid + hourly, and all data are numeric or null
  validateDataTable(cleaned);

  return cleaned;
}
