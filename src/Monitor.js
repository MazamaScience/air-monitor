// src/Monitor.js

// arquero provides dplyr-like operations for manipulating tables
import * as aq from 'arquero';

// First: npm install moment-timezone --save
// import moment from "moment-timezone";

// npm install github:MazamaScience/air-monitor-algorithms
import {
  arrayMean,
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
  // internal_collapse,
  internal_combine,
  internal_select,
  internal_filterByValue,
  internal_dropEmpty,
  internal_trimDate
} from './utils/transform.js';
import {
  internal_getTimezone,
  internal_getPM25,
  internal_getNowcast,
  internal_getDailyStats,
  internal_getDiurnalStats
} from './utils/analysis.js';
// import { internal_getCurrentStatus } from './utils/status.js';
// import { internal_createGeoJSON } from './utils/geojson.js';

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
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @param {string} fieldName - Name of the metadata field to retrieve.
   * @returns {string|number} The value of the metadata field.
   */
  getMetadata(id, fieldName) {
    const index = this.getIDs().indexOf(id);
    return this.meta.array(fieldName)[index];
  }

  /**
   * Returns an object with all metadata properties for the time series
   * identified by id.
   * @param {string} id - The deviceDeploymentID of the time series to select.
   * @returns {Object} Object with all metadata properties.
   */
  getMetaObject(id) {
    return this.select(id).meta.object();
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

  // /**
  //  * Collapses data from all time series into a single-time series using the
  //  * function provided in the `FUN` argument. The single-time series result will
  //  * be located at the mean longitude and latitude.
  //  *
  //  * When `FUN = "quantile"`, the `FUN_arg` argument specifies the quantile
  //  * probability.
  //  *
  //  * Available function names are those defined at:
  //  * <https://uwdata.github.io/arquero/api/op#aggregate-functions> with the
  //  * `"op."` removed.
  //  *
  //  * @param {string} deviceID - New deviceDeploymentID for the collapsed series.
  //  * @param {string} FUN - Name of an aggregation function (e.g., "mean", "max").
  //  * @param {any} [FUN_arg] - Optional argument to pass to FUN.
  //  * @returns {Monitor} New Monitor with collapsed data.
  //  */
  // collapse(deviceID, FUN, FUN_arg) {
  //   const { meta, data } = internal_collapse(this, deviceID, FUN, FUN_arg);
  //   return new Monitor(meta, data);
  // }

  /**
   * Combines this Monitor object with another, dropping duplicate deviceDeploymentIDs
   * from the second monitor to avoid collisions.
   *
   * @param {Monitor} monitor - Another Monitor instance to combine with this one.
   * @returns {Monitor} A new combined Monitor instance.
   */
  combine(monitor) {
    const { meta, data } = internal_combine(this, monitor);
    return new Monitor(meta, data);
  }

  /**
   * Subset and reorder time series within the Monitor.
   *
   * @param {string|string[]} ids - Single ID or array of IDs to select.
   * @returns {Monitor} New Monitor with selected/reordered time series.
   */
  select(ids) {
    const { meta, data } = internal_select(this, ids);
    return new Monitor(meta, data);
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
    return new Monitor(meta, data);
  }

  /**
   * Drops time series from the monitor that contain only missing values.
   *
   * A value is considered missing if it is null, undefined, NaN, or an invalid string (e.g. 'NA').
   * The resulting monitor object includes only the deviceDeploymentIDs with at least one valid observation.
   * @returns {{ meta: aq.Table, data: aq.Table }} A new monitor object with empty time series removed.
   */
  dropEmpty() {
    const { meta, data } = internal_dropEmpty(this);
    return new Monitor(meta, data);
  }

  /**
   * Returns a modified Monitor object with the records trimmed to full
   * local time days. Any partial days are discarded.
   * @param {string} timezone - Olson timezone identifier (e.g., "America/Los_Angeles").
   * @returns {Monitor} New Monitor with data trimmed by timezone-aware ranges.
   */
  trimDate(timezone) {
    const { meta, data } = internal_trimDate(this, timezone);
    return new Monitor(meta, data);
  }

  // ----- Monitor manipulation ------------------------------------------------

  /**
   * Collapse a Monitor object into a single time series.
   *
   * Collapses data from all time series into a single-time series using the
   * function provided in the `FUN` argument. The single-time series result will
   * be located at the mean longitude and latitude.
   *
   * When `FUN = "quantile"`, the `FUN_arg` argument specifies the quantile
   * probability.
   *
   * Available function names are those defined at:
   * <https://uwdata.github.io/arquero/api/op#aggregate-functions> with the
   * `"op."` removed.
   *
   * @param {string} monitor A monitor object.
   * @param {string} FUN A monitor object.
   * @returns {Object} A collapsed monitor object.
   */
  collapse(deviceID = "generatedID", FUN = "sum", FUN_arg = 0.8) {
    let meta = this.meta;
    let data = this.data;

    // ----- Create new_meta ---------------------------------------------------

    let longitude = arrayMean(meta.array("longitude"));
    let latitude = arrayMean(meta.array("latitude"));
    // TODO:  Could create new locationID based on geohash
    let locationID = "xxx";
    let deviceDeploymentID = "xxx_" + deviceID;

    // Start with first record
    let new_meta = meta.slice(0, 1);

    // Modify core metadata fields
    new_meta = new_meta.derive({
      locationID: aq.escape(locationID),
      locationName: aq.escape(deviceID),
      longitude: aq.escape(longitude),
      latitude: aq.escape(latitude),
      elevation: aq.escape(null),
      // retain countryCode
      // retain stateCode
      // retain countyName
      // retain timezone
      houseNumber: aq.escape(null),
      street: aq.escape(null),
      city: aq.escape(null),
      zip: aq.escape(null),
      deviceDeploymentID: aq.escape(deviceDeploymentID),
      deviceType: aq.escape(null),
      deploymentType: aq.escape(null),
    });

    // NOTE:  We retain all other fields from the first record. Some may be useful!

    // ----- Create new_data ---------------------------------------------------

    // NOTE:  arquero provides no functionality for row-operations, nor for
    // NOTE:  transpose. So we have to perform the following operations:
    // NOTE:    - fold the data into a dataframe with timestamp and id columns
    // NOTE:    - pivot the data based on timestamp while summing data columns
    // NOTE:    - fold the result into a dataframe with timestamp and value columns

    let ids = this.getIDs();
    let datetime = this.getDatetime();

    // Replace datetime with utcDatestamp to use as column headers
    data = data
      .derive({ utcDatestamp: (d) => op.format_utcdate(d.datetime) })
      .select(aq.not("datetime"));

    let datetimeColumns = data.array("utcDatestamp");

    // Programmatically create arquero aggregation expression to use
    let valueExpression;
    if (FUN === "count") {
      valueExpression = "(d) => op." + FUN + "()";
    } else if (FUN === "quantile") {
      valueExpression = "(d) => op." + FUN + "(d.value, " + FUN_arg + ")";
    } else {
      valueExpression = "(d) => op." + FUN + "(d.value)";
    }

    let new_data = data
      .fold(ids)
      .pivot({ key: (d) => d.utcDatestamp }, { value: valueExpression })
      .fold(datetimeColumns)
      .derive({ datetime: (d) => op.parse_date(d.key) }) // convert back to Date objects
      .rename({ value: deviceID })
      .select(["datetime", deviceID]);

    // ┌─────────┬──────────────────────────┬───────────────────┐
    // │ (index) │         datetime         │    generatedID    │
    // ├─────────┼──────────────────────────┼───────────────────┤
    // │    0    │ 2023-04-02T22:00:00.000Z │       12.3        │
    // │    1    │ 2023-04-02T23:00:00.000Z │        9.4        │
    // │    2    │ 2023-04-03T00:00:00.000Z │        8.2        │
    // └─────────┴──────────────────────────┴───────────────────┘

    // Return
    let return_monitor = new Monitor(new_meta, new_data);
    return return_monitor;
  }

  // /**
  //  * Combine another Monitor object with 'this' object.
  //  *
  //  * A new Monitor object is returned containing all time series and metadata from
  //  * 'this' Monitor as well as the passed in 'monitor'. This allows for chaining to
  //  * combine multiple Monitor objects.
  //  *
  //  * @param {Object} monitor A monitor object.
  //  * @returns {Object} A combined monitor object.
  //  */
  // combine(monitor) {
  //   let meta = this.meta.concat(monitor.meta);
  //   let data = this.data.join(monitor.data); // automatically joins on 'datetime' as the only shared column

  //   // Return
  //   let return_monitor = new Monitor(meta, data);
  //   return return_monitor;
  // }

  // /**
  //  * Subset and reorder time series within a monitor object.
  //  *
  //  * @param {Array.<string>} ids deviceDeploymentIDs of the time series to select.
  //  * @returns {Object} A (reordered) subset of the incoming monitor object.
  //  */
  // select(ids) {
  //   // See https://uwdata.github.io/arquero/api/expressions#limitations
  //   let meta = this.meta
  //     .params({ ids: ids })
  //     .filter((d, $) => op.includes($.ids, d.deviceDeploymentID)); // arquero filter

  //   let data = this.data.select("datetime", ids);

  //   // Return
  //   let return_monitor = new Monitor(meta, data);
  //   return return_monitor;
  // }


  // ----- Special methods------------------------------------------------------

  /**
   * Augment monitor.meta with current status information derived from monitor
   * data.
   *
   * @param {Monitor} monitor Monitor object with 'meta' and 'data'.
   * @returns {Table} An enhanced version of monitor.meta.
   */
  getCurrentStatus() {
    let data = this.data;

    let ids = this.getIDs();

    // Create a data table with no 'datetime' but an added 'index' column
    // NOTE:  op.row_number() starts at 1
    let dataBrick = data
      .select(aq.not("datetime"))
      .derive({ index: (d) => op.row_number() - 1 });

    // Programmatically create a values object that replaces valid values with a row index
    let values1 = {};
    ids.map(
      (id) => (values1[id] = "d => op.is_finite(d['" + id + "']) ? d.index : 0")
    );

    // Programmatically create a values object that finds the max for each column
    let values2 = {};
    ids.map((id) => (values2[id] = "d => op.max(d['" + id + "'])"));

    // Create a single-row dt with the row index of the last valid PM2.5 value
    // Then extract the row as an object.
    let lastValidIndexObj = dataBrick.derive(values1).rollup(values2).object(0);

    // Array of indices;
    let lastValidIndex = Object.values(lastValidIndexObj);

    // Map indices onto an array of datetimes
    let lastValidDatetime = lastValidIndex.map(
      (index) => data.array("datetime")[index]
    );

    // Map ids onto an array of PM2.5 values
    let lastValidPM_25 = ids.map((id, index) =>
      data.get(id, lastValidIndex[index])
    );

    // Create a data table with current status columns
    let lastValidDT = aq.table({
      lastValidDatetime: lastValidDatetime,
      lastValidPM_25: lastValidPM_25,
    });

    // Return the enhanced metadata
    let metaPlus = this.meta.assign(lastValidDT);

    return metaPlus;
  }

  createGeoJSON() {
    // From:  mv4_wrcc_PM2.5_latest.geojson
    //
    // {
    //   "type": "FeatureCollection",
    //   "features": [
    //     {
    //       "type": "Feature",
    //       "geometry": {
    //         "type": "Point",
    //         "coordinates": [-114.0909, 46.5135]
    //       },
    //       "properties": {
    //         "deviceDeploymentID": "aaef057f3e4d83c4_wrcc.s139",
    //         "locationName": "Smoke USFS R1-39",
    //         "timezone": "America/Denver",
    //         "dataIngestSource": "WRCC",
    //         "dataIngestUnitID": "s139",
    //         "currentStatus_processingTime": "2022-12-12 13:54:13",
    //         "last_validTime": "2022-12-12 12:00:00",
    //         "last_validLocalTimestamp": "2022-12-12 05:00:00 MST",
    //         "last_nowcast": "2.9",
    //         "last_PM2.5": "2",
    //         "last_latency": "1",
    //         "yesterday_PM2.5_avg": "4.7"
    //       }
    //     }
    //   ]
    // }

    let meta = this.getCurrentStatus();
    let features = Array(this.meta.numRows());

    for (let i = 0; i < this.meta.numRows(); i++) {
      let site = meta.slice(i, i + 1).object();
      features[i] = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [site.longitude, site.latitude],
        },
        properties: {
          deviceDeploymentID: site.deviceDeploymentID,
          locationName: site.locationName,
          last_time: site.lastValidDatetime,
          last_pm25: site.lastValidPM_25,
        },
      };
    }

    let geojsonObj = {
      type: "FeatureCollection",
      features: features,
    };

    return geojsonObj;
  }

  // ----- Utility methods -----------------------------------------------------

  // /**
  //  * Returns an array of unique identifiers (deviceDeploymentIDs) found in a
  //  * Monitor object
  //  *
  //  * @returns {Array.<string>} An array of deviceDeploymentIDs.
  //  */
  // getIDs() {
  //   return this.meta.array("deviceDeploymentID");
  // }

  // /**
  //  * Returns the number of individual time series found in a Monitor object
  //  *
  //  * @returns {number} Count of individual time series.
  //  */
  // count() {
  //   return this.meta.numRows();
  // }

  // ----- Other functions -----------------------------------------------------

  // /**
  //  * Augments and returns 'meta' with current status information derived from 'data'.
  //  * @returns {aq.Table} An enhanced version of monitor.meta.
  //  */
  // getCurrentStatus() {
  //   return internal_getCurrentStatus(this);
  // }

  // /**
  //  * Returns a GeoJSON FeatureCollection representing deployment locations.
  //  * @returns {Object} GeoJSON FeatureCollection.
  //  */
  // createGeoJSON() {
  //   return internal_createGeoJSON(this);
  // }


}

export { Monitor };