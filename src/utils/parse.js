/**
 * Utility functions for parsing and cleaning raw CSV data into normalized
 * `meta` and `data` tables used by the Monitor class.
 *
 * These functions:
 * - Replace string `'NA'` with `null`
 * - Convert numeric fields to floats
 * - Optionally restrict metadata columns to core subsets
 * - Clamp negative measurements (e.g. PM2.5) to zero
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
  // const columns = dt.columnNames().slice(1); // skip 'datetime'

  // const values = {};
  // columns.forEach(col => {
  //   values[col] = aq.escape(d => {
  //     const val = d[col] === 'NA' ? null : op.parse_float(d[col]);
  //     return val < 0 ? 0 : val;
  //   });
  // });

  // const returnDT = dt.derive(values);

  // return returnDT;
  // //return dt.derive(values);

  const ids = dt.columnNames().splice(1); // remove 'datetime'

  // Replace 'NA' with null
  let values1 = {};
  ids.map(
    (id) =>
      (values1[id] = `d => d['${id}'] === 'NA' ? null : op.parse_float(d['${id}'])`)
  );

  // Lift up negative values to zero
  // NOTE:  'null <= 0' evaluates to true. So we have to test with '< 0'.
  let values2 = {};
  ids.map(
    (id) =>
      (values2[id] = `d => d['${id}'] < 0 ? 0 : d['${id}']`)
  );
  // Return the modified data table
  return dt.derive(values1).derive(values2);

}
