// src/Monitor.js

// arquero provides dplyr-like operations for manipulating tables
import * as aq from 'arquero';

// npm install github:MazamaScience/air-monitor-algorithms
import {
  dailyStats,
  diurnalStats,
  pm_nowcast
} from "air-monitor-algorithms";

// module imports
import {
  internal_loadLatest,
  internal_loadDaily,
  internal_loadAnnual,
  internal_loadCustom
} from './utils/load.js';
import {
  internal_getTimezone,
  internal_getPM25,
  internal_getNowcast,
  internal_getDailyStats,
  internal_getDiurnalStats
} from './utils/analysis.js';
import {
  internal_collapse,
  internal_combine,
  internal_select,
  internal_filterByValue,
  internal_dropEmpty,
  internal_trimDate
} from './utils/transform.js';
import {
  internal_getCurrentStatus,
  internal_createGeoJSON
} from './utils/geojson.js';
import {
  assertIsMonitor,
  validateDeviceID
} from './utils/helpers.js';

// ----- Monitor Class ---------------------------------------------------------

/**
 * Class representing a set of air quality time series and associated metadata.
 *
 * Stores two dataframes:
 * - `meta`: instrument deployment metadata (rows = device-deployments)
 * - `data`: UTC time-series data (rows = datetime, columns = deviceDeploymentIDs)
 */
class Monitor {
  /**
   * Constructs a new Monitor instance with 'meta' and 'data' tables.
   *
   * @param {aq.Table} meta - Metadata table with one row per deviceDeploymentID.
   * @param {aq.Table} data - Time series data table with a `datetime` column and one column per deviceDeploymentID.
   */
  constructor(
    meta = aq.table({
      deviceDeploymentID: [],
      deviceID: [],
      deviceType: [],
      deploymentType: [],
      deviceDescription: [],
      pollutant: [],
      units: [],
      dataIngestSource: [],
      locationID: [],
      locationName: [],
      longitude: [],
      latitude: [],
      elevation: [],
      countryCode: [],
      stateCode: [],
      countyName: [],
      timezone: [],
      AQSID: [],
      fullAQSID: [],
    }),
    data = aq.table({
      datetime: [],
    })
  ) {
    this.meta = meta;
    this.data = data;
  }

  // ----- Data Loading Methods ------------------------------------------------

  /**
   * Asynchronously loads 'latest' Monitor objects from USFS AirFire repositories
   * for 'airnow', 'airsis' or 'wrcc' data.
   *
   * This function replaces the 'meta' and 'data' properties of 'this' monitor
   * object with the latest available data. Data cover the most recent 10 days
   * and are updated every few minutes.
   *
   * @async
   * @param {string} provider - One of "airnow|airsis|wrcc"
   * @param {string} baseUrl - Base URL for monitoring v2 data files.
   * @returns {Promise<Monitor>} A promise that resolves to a new Monitor instance with the loaded data.
   * @throws {Error} If there's an issue loading the data.
   */
  async loadLatest(provider, baseUrl) {
    return internal_loadLatest(this, provider, baseUrl);
  }

   /**
    * Asynchronously loads 'daily' Monitor objects from USFS AirFire repositories
    * for 'airnow', 'airsis' or 'wrcc' data.
    *
    * This function replaces the 'meta' and 'data' properties of 'this' monitor
    * object with the latest available data. Data cover the most recent 45 days
    * and are updated once per day around 10:00 UTC (2am US Pacific Time).
    *
    * @async
    * @param {string} provider - One of "airnow|airsis|wrcc".
    * @param {string} baseUrl - Base URL for monitoring v2 data files.
    * @returns {Promise<Monitor>} A promise that resolves to a new Monitor instance with the loaded data.
    * @throws {Error} If there's an issue loading the data.
    */
  async loadDaily(provider, baseUrl) {
    return internal_loadDaily(this, provider, baseUrl);
  }

  /**
   * Asynchronously loads 'annual' Monitor objects from USFS AirFire repositories
   * for 'airnow', 'airsis' or 'wrcc' data.
   *
   * This function replaces the 'meta' and 'data' properties of 'this' monitor
   * object with the latest available data. Data cover an entire year or
   * year-to-date. Current year data are updated daily.
   *
   * @async
   * @param {string} year - Year of interest.
   * @param {string} baseUrl - Base URL for monitoring v2 data files.
   * @returns {Promise<Monitor>} A promise that resolves to a new Monitor instance with the loaded data.
   * @throws {Error} If there's an issue loading the data.
   */
  async loadAnnual(year, baseUrl) {
    return internal_loadAnnual(this, year, baseUrl);
  }

  /**
   * Asynchronously loads custom monitoring data.
   *
   * Two files will be loaded from <baseUrl>:
   *   1. <baseName>_data.csv
   *   2. <baseName>_meta.csv
   *
   * @param {string} baseName - File name base.
   * @param {string} baseUrl - URL path under which data files are found.
   * @param {boolean} useAllColumns - Whether to retain all available columns in the metadata.
   * @returns {Promise<Monitor>} A promise that resolves to a new Monitor instance with the loaded data.
   * @throws {Error} If there's an issue loading the data.
   */
  async loadCustom(baseName, baseUrl, useAllColumns = true) {
    return internal_loadCustom(this, baseName, baseUrl, useAllColumns);
  }

  // ----- Accessors and Utilities ---------------------------------------------

  /**
   * Returns an array of unique identifiers (deviceDeploymentIDs) found in a
   * Monitor object.
   * @returns {string[]} Array of deviceDeploymentIDs.
   */
  getIDs() {
    return this.meta.array('deviceDeploymentID');
  }

  /**
   * Returns the number of individual time series found in a Monitor object.
   * @returns {number} Number of metadata rows.
   */
  count() {
    return this.meta.numRows();
  }

  /**
   * Returns the array of date objects that define this Monitor object's time axis.
   * @returns {Array.<Date>} Array of Date objects.
   */
  getDatetime() {
    return this.data.array('datetime');
  }

  /**
   * Returns the named metadata field for the time series identified by id.
   *
   * @param {string|string[]} id - The deviceDeploymentID.
   * @param {string} fieldName - Name of the metadata field to retrieve.
   * @returns {string|number} The value of the metadata field.
   * @throws {Error} If id is not a valid single string or not found.
   */
  getMetadata(id, fieldName) {
    const resolvedID = validateDeviceID(this, id);
    const index = this.getIDs().indexOf(resolvedID);
    return this.meta.array(fieldName)[index];
  }

  /**
   * Returns all metadata properties for the time series identified by id.
   *
   * @param {string|string[]} id - The deviceDeploymentID.
   * @returns {Object} Object with all metadata properties.
   * @throws {Error} If id is not a valid single string or not found.
   */
  getMetaObject(id) {
    const resolvedID = validateDeviceID(this, id);
    return this.select(resolvedID).meta.object();
  }

  // ----- Data manipulation functions -----------------------------------------

  /**
   * Returns the timezone for the specified device.
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @returns {string} Olson timezone.
   */
  getTimezone(id) {
    return internal_getTimezone(this, id);
  }

  /**
   * Returns the PM2.5 time series for the specified device.
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @returns {number[]} PM2.5 values.
   *
   * @throws {Error} If the device ID is not found.
   */
  getPM25(id) {
    return internal_getPM25(this, id);
  }

  /**
   * Returns the NowCast PM2.5 value for the specified device.
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @returns {number} NowCast value.
   */
  getNowcast(id) {
    return internal_getNowcast(this, id);
  }

  /**
   * Calculates daily statistics for the time series identified by id after the
   * time series has been trimmed to local-time day boundaries. The starting
   * hour of each local time day and statistics derived from that day's data
   * are returned in an object with `datetime`, `count`, `min`, `mean` and `max`
   * properties.
   *
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @returns {Object} Object with `datetime`, `count`, `min`, `mean` and `max` properties.
   */
  getDailyStats(id) {
    return internal_getDailyStats(this, id);
  }

  /**
   * Calculates hour-of-day statistics for the time series identified by id after
   * the time series has been trimmed to local-time day boundaries. An array of
   * local time hours and hour-of-day statistics derived from recent data
   * are returned in an object with `hour`, `count`, `min`, `mean` and `max`
   * properties.
   *
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @param {number} dayCount - Number of most recent days to use.
   * @returns {Object} Object with `hour`, `count`, `min`, `mean` and `max` properties.
   */
  getDiurnalStats(id, dayCount) {
    return internal_getDiurnalStats(this, id, dayCount);
  }

  // ----- Transformation and statistical functions ----------------------------

  /**
 * Collapses data from all time series into a single time series using the
 * function provided in the `FUN` argument (typically 'mean'). The single time
 * series result will be located at the mean longitude and latitude.
   *
   * When `FUN = "quantile"`, the `FUN_arg` argument specifies the quantile
   * probability.
   *
   * Available function names are those defined at:
   * <https://uwdata.github.io/arquero/api/op#aggregate-functions> with the
   * `"op."` removed.
   *
   * @param {string} deviceID - New deviceDeploymentID for the collapsed series.
   * @param {string} FUN - Name of an aggregation function (e.g., "mean", "max").
   * @param {any} [FUN_arg] - Optional argument to pass to FUN.
   * @returns {Monitor} New Monitor with a single time series.
   */
  collapse(deviceID, FUN, FUN_arg) {
    const { meta, data } = internal_collapse(this, deviceID, FUN, FUN_arg);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'collapse');
    return result;
  }

  /**
   * Combines this Monitor object with another, dropping duplicate deviceDeploymentIDs
   * from the second monitor to avoid collisions.
   *
   * @param {Monitor} monitor - Another Monitor instance to combine with this one.
   * @returns {Monitor} New Monitor with combined time series.
   */
  combine(monitor) {
    const { meta, data } = internal_combine(this, monitor);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'combine');
    return result;
  }

  /**
   * Subset and reorder time series within the Monitor.
   *
   * @param {string|string[]} ids - Single ID or array of IDs to select.
   * @returns {Monitor} New Monitor with selected/reordered time series.
   */
  select(ids) {
    const { meta, data } = internal_select(this, ids);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'select');
    return result;
  }

  /**
   * Filters time series based on matching values in the 'meta' dataframe.
   * The returned Monitor object will contain only those records where
   * monitor.meta.columnName === "value".
   * @param {string} column - Name of the column used for filtering.
   * @param {string|number} value - Value to match.
   * @returns {Monitor} New Monitor with filtered time series.
   */
  filterByValue(column, value) {
    const { meta, data } = internal_filterByValue(this, column, value);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'filterByValue');
    return result;
  }

  /**
   * Drops time series from the monitor that contain only missing values.
   *
   * A value is considered missing if it is null, undefined, NaN, or an invalid string (e.g. 'NA').
   * The resulting monitor object includes only the deviceDeploymentIDs with at least one valid observation.
   * @returns {Monitor} New Monitor with empty time series removed.
   */
  dropEmpty() {
    const { meta, data } = internal_dropEmpty(this);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'dropEmpty');
    return result;
  }

  /**
   * Returns a modified Monitor object with the records trimmed to full
   * local time days. Any partial days are discarded.
   * @param {string} timezone - Olson timezone identifier (e.g., "America/Los_Angeles").
   * @returns {Monitor} New Monitor with data trimmed by timezone-aware ranges.
   */
  trimDate(timezone) {
    const { meta, data } = internal_trimDate(this, timezone);
    const result = new Monitor(meta, data);
    assertIsMonitor(result, 'trimDate');
    return result;
  }

  // ----- Other functions -----------------------------------------------------

  /**
   * Augments and returns 'meta' with current status information derived from 'data'.
   * @returns {aq.Table} An enhanced version of monitor.meta.
   */
  getCurrentStatus() {
    return internal_getCurrentStatus(this);
  }

  /**
   * Returns a GeoJSON FeatureCollection representing deployment locations.
   * @returns {Object} GeoJSON FeatureCollection.
   */
  createGeoJSON() {
    return internal_createGeoJSON(this);
  }

}

export default Monitor ;