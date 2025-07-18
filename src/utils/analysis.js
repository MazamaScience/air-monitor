/**
 * Internal statistical and time-based analysis functions for the `air-monitor` package.
 * These functions operate on `Monitor` instances and are intended for use within the
 * package or by advanced users who understand the internal data model.
 *
 * Exports:
 * - internal_getTimezone() - Retrieves the IANA timezone string for a given device.
 * - internal_getPM25() - Cleans and rounds the PM2.5 time series for a device.
 * - internal_getNowcast() - Computes the NowCast value for recent PM2.5 readings.
 * - internal_getDailyStats() - Computes per-day min, max, mean, and count values.
 * - internal_getDiurnalStats() - Computes average values by hour of day across multiple days.
 *
 * All functions assume that `Monitor.meta` and `Monitor.data` have been properly parsed and
 * that each `deviceDeploymentID` is unique within the metadata table.
 */

import { pm_nowcast, dailyStats, diurnalStats } from 'air-monitor-algorithms';

import { validateDeviceID } from './helpers.js';

/**
 * Returns the Olson timezone string for a single deviceDeploymentID.
 * @param {object} monitor - Monitor instance with `.meta` table.
 * @param {string | string[]} id - A single deviceDeploymentID or array of length 1.
 * @returns {string} Olson timezone.
 * @throws {Error} If ID is not found or is invalid.
 */
export function internal_getTimezone(monitor, id) {
  // Accept either a single string or an array of length 1
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

  const ids = monitor.meta.array('deviceDeploymentID');
  const timezones = monitor.meta.array('timezone');

  const index = ids.indexOf(deviceID);
  if (index === -1) {
    throw new Error(`Device ID '${deviceID}' not found in metadata.`);
  }

  return timezones[index];
}


/**
 * Retrieves and rounds the PM2.5 time series for a given device ID.
 * Ensures all non-null values are numeric before applying rounding.
 *
 * @param {Monitor} monitor - The Monitor instance containing time-series data.
 * @param {string | string[]} id - A single deviceDeploymentID or array of length 1.
 * @returns {Array<number|null>} Cleaned PM2.5 values rounded to 1 decimal place.
 *
 * @throws {Error} If the device ID is not found or is not a string.
 */
export function internal_getPM25(monitor, id) {
  const deviceID = validateDeviceID(monitor, id);
  const data = monitor.data.array(deviceID);

  if (!Array.isArray(data)) {
    throw new Error(`Device ID '${deviceID}' not found in monitor.data`);
  }

  return data.map(v =>
    v === null || v === undefined || isNaN(v)
      ? null
      : Math.round(v * 10) / 10
  );
}

/**
 * Computes the NowCast PM2.5 value for a specified device.
 *
 * @param {Monitor} monitor - The Monitor instance containing parsed time-series data.
 * @param {string | string[]} id - A single deviceDeploymentID or array of length 1.
 * @returns {number|null} The NowCast PM2.5 value, or null if input data is invalid or missing.
 *
 * @throws {Error} If the device ID is not found or is not a string.
 */
export function internal_getNowcast(monitor, id) {
  const deviceID = validateDeviceID(monitor, id);
  const pm25 = monitor.data.array(deviceID);

  if (!Array.isArray(pm25)) {
    throw new Error(`Column for device ID '${deviceID}' is not a valid array`);
  }

  return pm_nowcast(pm25);
}


/**
 * Calculates daily statistics for the time series identified by id after the
 * time series has been trimmed to local-time day boundaries. The starting
 * hour of each local time day and statistics derived from that day's data
 * are returned in an object with `datetime`, `count`, `min`, `mean` and `max`
 * properties.
 *
 * @param {Monitor} monitor - The Monitor instance containing parsed time-series data.
 * @param {string | string[]} id - A single deviceDeploymentID or array of length 1.
 * @returns {Object} Object with `datetime`, `count`, `min`, `mean` and `max` properties.
 */
export function internal_getDailyStats(monitor, id) {
  const deviceID = validateDeviceID(monitor, id);
  const datetime = monitor.data.array('datetime');
  const pm25 = internal_getPM25(monitor, deviceID);
  const timezone = internal_getTimezone(monitor, deviceID);

  // Assert aligned input lengths
  if (datetime.length !== pm25.length) {
    throw new Error(`Datetime and PM2.5 arrays are misaligned for device '${deviceID}'`);
  }

  const daily = dailyStats(datetime, pm25, timezone);
  return {
    datetime: daily.datetime,
    count: daily.count,
    min: daily.min,
    mean: daily.mean,
    max: daily.max,
  };
}

/**
 * Calculates hour-of-day statistics for the time series identified by id after
 * the time series has been trimmed to local-time day boundaries. An array of
 * local time hours and hour-of-day statistics derived from recent data
 * are returned in an object with `hour`, `count`, `min`, `mean` and `max`
 * properties.
 *
 * @param {Monitor} monitor - The Monitor instance containing parsed time-series data.
 * @param {string} id - The deviceDeploymentID identifying the desired time series.
 * @param {number} dayCount - Number of most recent days to use.
 * @returns {Object} Object with `hour`, `count`, `min`, `mean` and `max` properties.
 */
export function internal_getDiurnalStats(monitor, id, dayCount = 7) {
  const datetime = monitor.data.array('datetime');
  const pm25 = internal_getPM25(monitor, id);
  const timezone = internal_getTimezone(monitor, id);

  // Assert aligned input lengths
  if (datetime.length !== pm25.length) {
    throw new Error(`Datetime and PM2.5 arrays are misaligned for device '${id}'`);
  }

  const diurnal = diurnalStats(datetime, pm25, timezone, dayCount);
  return {
    hour: diurnal.hour,
    count: diurnal.count,
    min: diurnal.min,
    mean: diurnal.mean,
    max: diurnal.max,
  };
}
