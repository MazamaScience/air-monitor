// src/utils/transform.js

import * as aq from 'arquero';
const op = aq.op;

export function internal_collapse(monitor, deviceID = 'generatedID', FUN = 'sum', FUN_arg = 0.8) {
  const meta = monitor.meta;
  const data = monitor.data;

  const longitude = arrayMean(meta.array('longitude'));
  const latitude = arrayMean(meta.array('latitude'));
  const locationID = 'xxx';
  const deviceDeploymentID = `xxx_${deviceID}`;

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

  const ids = meta.array('deviceDeploymentID')

  let dataWithStamp = data
    .derive({ utcDatestamp: d => op.format_utcdate(d.datetime) })
    .select(aq.not('datetime'));

  const datetimeColumns = dataWithStamp.array('utcDatestamp');

  let valueExpression;
  if (FUN === 'count') {
    valueExpression = d => op.count();
  } else if (FUN === 'quantile') {
    valueExpression = d => op.quantile(d.value, FUN_arg);
  } else {
    valueExpression = d => op[FUN](d.value);
  }

  const new_data = dataWithStamp
    .fold(ids)
    .pivot({ key: d => d.utcDatestamp }, { value: valueExpression })
    .fold(datetimeColumns)
    .derive({ datetime: d => op.parse_date(d.key) })
    .rename({ value: deviceID })
    .select(['datetime', deviceID]);

  return { meta: new_meta, data: new_data };
}

export function internal_combine(monitorA, monitorB) {
  const meta = monitorA.meta.concat(monitorB.meta);
  const data = monitorA.data
    .join_full(monitorB.data, 'datetime')
    .orderby('datetime');

  return { meta, data };
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

  return { meta, data };
}

export function internal_filterByValue(monitor, columnName, value) {
  const col = monitor.meta.get(columnName);
  let filterFn;

  if (typeof col === 'number') {
    filterFn = d => d[columnName] === parseFloat(value);
  } else {
    filterFn = d => d[columnName] === value.toString();
  }

  const meta = monitor.meta.filter(filterFn);
  const ids = meta.array('deviceDeploymentID');
  const data = monitor.data.select(['datetime', ...ids]);

  return { meta, data };
}

export function internal_dropEmpty(monitor) {
  const dt = monitor.data;
  const ids = dt.columnNames().filter(c => c !== 'datetime');

  // Count valid values per column
  const countRow = dt.rollup(
    Object.fromEntries(ids.map(id => [id, d => op.valid(d[id])]))
  ).object(0);

  const validIDs = Object.entries(countRow)
    .filter(([_, count]) => count > 0)
    .map(([id]) => id);

  const data = dt.select(['datetime', ...validIDs]);
  const meta = monitor.meta
    .params({ ids: validIDs })
    .filter((d, $) => op.includes($.ids, d.deviceDeploymentID));

  return { meta, data };
}

export function internal_trimDate(monitor, timezone) {
  const localTime = monitor.data.array('datetime').map(d => new Date(d));
  const localHours = localTime.map(d => aq.op.tz(d, timezone).getHours());

  const start = localHours[0] === 0 ? 0 : 24 - localHours[0];
  const end = localHours.at(-1) === 23 ? localHours.length - 1 : localHours.length - localHours.at(-1) - 1;

  const data = monitor.data.slice(start, end);
  const meta = monitor.meta;

  return { meta, data };
}

// ----- Utilities -------------------------------------------------------------

/**
 * Computes the arithmetic mean of an array of numbers, ignoring non-numeric values.
 *
 * @param {Array<*>} arr - The input array (may contain nulls, strings, or other types).
 * @returns {number|null} The mean of valid numbers, or null if none are found.
 */
function arrayMean(arr) {
  const valid = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return valid.length > 0 ? sum / valid.length : null;
}
