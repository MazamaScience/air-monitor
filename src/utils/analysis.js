/**
 * @module utils/analysis
 *
 * Internal statistical and time-based analysis functions for the `air-monitor` package.
 * These functions operate on `Monitor` instances and are intended for use within the
 * package or by advanced users who understand the internal data model.
 *
 * Exports:
 * - {@link internal_getTimezone}: Retrieves the IANA timezone string for a given device.
 * - {@link internal_getPM25}: Cleans and rounds the PM2.5 time series for a device.
 * - {@link internal_getNowcast}: Computes the NowCast value for recent PM2.5 readings.
 * - {@link internal_getDailyStats}: Computes per-day min, max, mean, and count values.
 * - {@link internal_getDiurnalStats}: Computes average values by hour of day across multiple days.
 *
 * All functions assume that `Monitor.meta` and `Monitor.data` have been properly parsed and
 * that each `deviceDeploymentID` is unique within the metadata table.
 */

import { pm_nowcast, dailyStats, diurnalStats } from 'air-monitor-algorithms';

/**
 * Returns the timezone associated with a given device deployment ID.
 *
 * @param {Monitor} monitor - The Monitor instance containing metadata.
 * @param {string} id - The deviceDeploymentID identifying the desired time series.
 * @returns {string} The timezone name (e.g., "America/New_York").
 *
 * @throws {Error} If the deviceDeploymentID is not found in the metadata.
 */
export function internal_getTimezone(monitor, id) {
  const ids = monitor.meta.array('deviceDeploymentID');
  const timezones = monitor.meta.array('timezone');

  const index = ids.indexOf(id);
  if (index === -1) {
    throw new Error(`Device ID '${id}' not found in metadata.`);
  }

  return timezones[index];
}

/**
 * Retrieves and rounds the PM2.5 time series for a given device ID.
 * Ensures all non-null values are numeric before applying rounding.
 *
 * @param {Monitor} monitor - The Monitor instance containing time-series data.
 * @param {string} id - The deviceDeploymentID identifying the desired time series.
 * @returns {Array<number|null>} Cleaned PM2.5 values rounded to 1 decimal place.
 *
 * @throws {Error} If the device ID is not found.
 */
export function internal_getPM25(monitor, id) {
  const data = monitor.data.array(id);

  if (!Array.isArray(data)) {
    throw new Error(`Device ID '${id}' not found in monitor.data`);
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
 * @param {string} id - The deviceDeploymentID identifying the desired time series.
 * @returns {number|null} The NowCast PM2.5 value, or null if input data is invalid or missing.
 *
 * @throws {Error} If the device ID is not found.
 */
export function internal_getNowcast(monitor, id) {
  const pm25 = monitor.data.array(id);

  if (!Array.isArray(pm25)) {
    throw new Error(`Device ID '${id}' not found in monitor.data`);
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
 * @param {string} id - The deviceDeploymentID identifying the desired time series.
 * @returns {Object} Object with `datetime`, `count`, `min`, `mean` and `max` properties.
 */
export function internal_getDailyStats(monitor, id) {
  const datetime = monitor.data.array('datetime');
  const pm25 = internal_getPM25(monitor, id);
  const timezone = internal_getTimezone(monitor, id);

  // Assert aligned input lengths
  if (datetime.length !== pm25.length) {
    throw new Error(`Datetime and PM2.5 arrays are misaligned for device '${id}'`);
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
