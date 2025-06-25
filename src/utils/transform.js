/**
 * @module utils/transform
 *
 * Utility functions for transforming and restructuring Monitor objects.
 * These internal functions operate on the underlying `meta` and `data` tables
 * and return plain `{ meta, data }` objects, enabling consistent post-processing.
 *
 * Internal functions:
 * - {@link internal_collapse} – Collapses multiple time series into a single column using aggregation.
 * - {@link internal_combine} – Merges two monitor objects, dropping duplicated IDs in the second.
 * - {@link internal_select} – Subsets a monitor by selected deviceDeploymentIDs.
 * - {@link internal_filterByValue} – Filters by a metadata field and matching value.
 * - {@link internal_dropEmpty} – Removes time series columns with no valid data.
 * - {@link internal_trimDate} – Trims time series to full local-time days.
 *
 * Helper functions:
 * - {@link arrayMean} – Computes the mean of an array, skipping null/NaN/invalid values.
 * - {@link round1} – Rounds all non-datetime columns in a data table to 1 decimal place.
 */

import * as aq from 'arquero';
const op = aq.op;

import { DateTime } from 'luxon';

/**
 * Collapse a Monitor object into a single time series.
 *
 * Collapses data from all time series into a single time series using the
 * function provided in the `FUN` argument (typically 'mean'). The single time
 * series result will be located at the mean longitude and latitude.
 *
 * When `FUN === "quantile"`, the `FUN_arg` argument specifies the quantile
 * probability.
 *
 * Available function names are those defined at:
 * https://uwdata.github.io/arquero/api/op#aggregate-functions
 *
 * @param {Monitor} monitor - The Monitor instance to collapse.
 * @param {string} deviceID - The name of the resulting time series column.
 * @param {string} FUN - The aggregate function name (e.g. "mean", "sum", "quantile").
 * @param {number} FUN_arg - An optional argument for the aggregator (e.g. quantile prob).
 * @returns {{ meta: aq.Table, data: aq.Table }} A Monitor object with a single time series.
 */
export function internal_collapse(monitor, deviceID = "generatedID", FUN = "mean", FUN_arg = 0.8) {
  const meta = monitor.meta;
  const data = monitor.data;

  // ----- Create new_meta ---------------------------------------------------

  const longitude = arrayMean(meta.array("longitude"));
  const latitude = arrayMean(meta.array("latitude"));
  // TODO:  Could create new locationID based on geohash
  const locationID = "xxx";
  const deviceDeploymentID = `xxx_${deviceID}`;

  // Start with first row and override key fields
  let new_meta = meta.slice(0, 1).derive({
    locationID: aq.escape(locationID),
    locationName: aq.escape(deviceID),
    longitude: aq.escape(longitude),
    latitude: aq.escape(latitude),
    elevation: aq.escape(null),
    houseNumber: aq.escape(null),
    street: aq.escape(null),
    city: aq.escape(null),
    zip: aq.escape(null),
    deviceDeploymentID: aq.escape(deviceDeploymentID),
    deviceType: aq.escape(null),
    deploymentType: aq.escape(null),
  });

  // ----- Create new_data ---------------------------------------------------

  // NOTE: Arquero provides no support for row-wise or matrix ops,
  // so we fold → pivot → fold → rebuild

  const ids = monitor.getIDs();
  const datetime = monitor.getDatetime();

  let transformed = data
    .derive({ utcDatestamp: 'd => op.format_utcdate(d.datetime)' })
    .select(aq.not('datetime'));

  const datetimeColumns = transformed.array('utcDatestamp');

  // Build aggregation function string
  let valueExpression;
  if (FUN === 'count') {
    valueExpression = '() => op.count()';
  } else if (FUN === 'quantile') {
    valueExpression = `d => op.quantile(d.value, ${FUN_arg})`;
  } else {
    valueExpression = `d => op.${FUN}(d.value)`;
  }

  const new_data = transformed
    .fold(ids)
    .pivot(
      { key: 'd => d.utcDatestamp' },
      { value: valueExpression }
    )
    .fold(datetimeColumns)
    .derive({ datetime: 'd => op.parse_date(d.key)' })
    .rename({ value: deviceID })
    .select(['datetime', deviceID]);

  return { meta: new_meta, data: round1(new_data) };
}

/**
 * Combines two Monitor objects by merging their metadata and time series data.
 * If any deviceDeploymentIDs in `monitorB` are already present in `monitorA`,
 * they will be dropped from `monitorB` before merging.
 *
 * @param {Monitor} monitorA - The base Monitor instance.
 * @param {Monitor} monitorB - The Monitor instance to merge in.
 * @returns {{ meta: aq.Table, data: aq.Table }} A combined monitor object.
 */
export function internal_combine(monitorA, monitorB) {
  const idsA = new Set(monitorA.meta.array('deviceDeploymentID'));
  const idsB = monitorB.meta.array('deviceDeploymentID');

  // Identify overlapping and unique IDs
  const overlappingIDs = idsB.filter(id => idsA.has(id));
  const uniqueIDs = idsB.filter(id => !idsA.has(id));

  // Filter monitorB's meta and data to include only unique IDs
  const metaB = monitorB.meta
    .params({ ids: uniqueIDs })
    .filter('op.includes(ids, d.deviceDeploymentID)');

  const dataB = monitorB.data.select(['datetime', ...uniqueIDs]);

  // Combine everything
  const combinedMeta = monitorA.meta.concat(metaB);
  const combinedData = monitorA.data.join(dataB); // joins on 'datetime'

  return { meta: combinedMeta, data: round1(combinedData) };
}


/**
 * Subsets and reorders time series columns and corresponding metadata
 * for the specified deviceDeploymentIDs.
 *
 * Ensures that the returned `meta` rows appear in the same order as `ids`,
 * and that all specified columns are included in the `data` table.
 *
 * @param {Monitor} monitor - The Monitor instance containing metadata and data.
 * @param {string[]} ids - An array of deviceDeploymentIDs to select and order.
 * @returns {{ meta: aq.Table, data: aq.Table }} A subset of the monitor with selected columns.
 *
 * @throws {Error} If `ids` is not a non-empty array.
 */
export function internal_select(monitor, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array of deviceDeploymentIDs');
  }

  // Reorder meta rows to match the order of `ids`
  const metaRows = ids.map(id => {
    const row = monitor.meta.objects().find(r => r.deviceDeploymentID === id);
    if (!row) {
      throw new Error(`deviceDeploymentID '${id}' not found in metadata`);
    }
    return row;
  });
  const meta = aq.from(metaRows);

  // Subset and reorder columns in the data table
  const data = monitor.data.select(['datetime', ...ids]);

  return { meta: meta, data: round1(data) };
}

/**
 * Filters a monitor object to include only records where a given metadata field equals the specified value.
 *
 * @param {Monitor} monitor - The Monitor instance containing metadata and data.
 * @param {string} columnName - Name of the metadata column to filter on.
 * @param {string|number} value - Value to match in the specified column.
 * @returns {{ meta: aq.Table, data: aq.Table }} A filtered monitor object.
 *
 * @throws {Error} If the specified column does not exist in monitor.meta.
 */
export function internal_filterByValue(monitor, columnName, value) {
  if (!monitor.meta.columnNames().includes(columnName)) {
    throw new Error(`Column '${columnName}' not found in metadata`);
  }

  const colType = typeof monitor.meta.get(columnName);
  let filterExpression;

  if (colType === 'number') {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) {
      throw new Error(`Value '${value}' could not be parsed as a number`);
    }
    filterExpression = `d => op.equal(d.${columnName}, ${parsedValue})`;
  } else if (colType === 'string') {
    const escaped = value.toString().replace(/'/g, "\\'");
    filterExpression = `d => op.equal(d.${columnName}, '${escaped}')`;
  } else {
    throw new Error(`Unsupported column type for filtering: ${colType}`);
  }

  const meta = monitor.meta.filter(filterExpression);
  const ids = meta.array('deviceDeploymentID');
  const data = monitor.data.select(['datetime', ...ids]);

  return { meta: meta, data: round1(data) };
}

/**
 * Drops time series from the monitor that contain only missing values.
 *
 * A value is considered missing if it is null, undefined, NaN, or an invalid string (e.g. 'NA').
 * The resulting monitor object includes only the deviceDeploymentIDs with at least one valid observation.
 *
 * @param {Monitor} monitor - The Monitor instance containing metadata and data.
 * @returns {{ meta: aq.Table, data: aq.Table }} A new monitor object with empty time series removed.
 */
export function internal_dropEmpty(monitor) {
  const data = monitor.data;
  const ids = data.columnNames().filter(c => c !== 'datetime');

  // Count valid (non-null, non-NaN, non-'NA') values for each time series column
  const countRow = data
    // arquero pattern to compute column-wise aggregations
    .rollup(Object.fromEntries(ids.map(id => [id, "d => op.valid(d['" + id + "'])"])))
    .object(0); // Get the single row as an object


  // Keep only the IDs with at least one valid value
  const validIDs = Object.entries(countRow)
    .filter(([_, count]) => count > 0)
    .map(([id]) => id);

  const filteredData = data.select(['datetime', ...validIDs]);

  const filteredMeta = monitor.meta
    .params({ ids: validIDs })
    .filter((d, $) => op.includes($.ids, d.deviceDeploymentID));

  return { meta: filteredMeta, data: round1(filteredData) };
}

/**
 * Trims the time-series data to full local-time days using Luxon.
 * Removes partial days at the start and end of the series.
 *
 * @param {Monitor} monitor - The Monitor instance with datetime-ordered data.
 * @param {string} timezone - An IANA timezone string (e.g., "America/New_York").
 * @returns {{ meta: aq.Table, data: aq.Table }} A subset of the monitor with trimmed data.
 *
 * @throws {Error} If the datetime column is missing or empty.
 */
export function internal_trimDate(monitor, timezone) {
  const datetime = monitor.data.array('datetime');
  if (!datetime || datetime.length === 0) {
    throw new Error('No datetime values found in monitor.data');
  }

  const localTime = datetime.map((jsDate) =>
    DateTime.fromJSDate(jsDate, { zone: timezone })
  );

  const hours = localTime.map((t) => t.hour);

  const start = hours[0] === 0 ? 0 : 24 - hours[0];
  const end = hours[hours.length - 1] === 23
    ? hours.length - 1
    : hours.length - hours[hours.length - 1] - 1;

  const data = monitor.data.slice(start, end);
  const meta = monitor.meta;

  return { meta: meta, data: round1(data) };
}


// ----- Utilities -------------------------------------------------------------

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
