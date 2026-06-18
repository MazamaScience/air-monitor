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

  // Clean each measurement column by walking its raw values directly rather
  // than via dt.derive(aq.escape(...)). The escape path hands each per-column
  // expression a full row proxy, which makes derive() scale ~O(columns^2) and
  // turns a real provider load (~1,500 columns) into a ~90s operation; the
  // array walk below is the same work in a few milliseconds. Referencing
  // columns by name through dt.array(id) also keeps the original safety
  // property — deviceDeploymentIDs containing quotes/backslashes are never
  // interpolated into generated code.
  const columns = { datetime: dt.array('datetime') };
  ids.forEach(id => {
    const src = dt.array(id);
    const out = new Array(src.length);
    for (let i = 0; i < src.length; i++) {
      // Step 1: 'NA' -> null, otherwise parse as float.
      let value = src[i] === 'NA' ? null : parseFloat(src[i]);
      // Step 2: negative values -> 0 (also folds -Infinity to 0).
      if (value < 0) value = 0;
      // Step 3: remaining non-finite values (NaN, +Infinity) -> null.
      if (value != null && !Number.isFinite(value)) value = null;
      out[i] = value;
    }
    columns[id] = out;
  });

  const cleaned = aq.table(columns);

  // Final check: ensure datetime is valid + hourly, and all data are numeric or null
  validateDataTable(cleaned);

  return cleaned;
}
