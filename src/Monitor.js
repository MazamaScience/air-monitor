// src/Monitor.js

// arquero provides dplyr-like operations for manipulating tables
import * as aq from 'arquero';

// First: npm install moment-timezone --save
import moment from "moment-timezone";

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

 // ----- Data load -------------------------------------------------------------


  /**
   * Load 'daily' Monitor objects from USFS AirFire repositories for 'airnow',
   * 'airsis' and 'wrcc' data.
   *
   * This function replaces the 'meta' and 'data' properties of 'this' monitor
   * object with the latest available data. Data cover the most recent 45 days
   * and are updated once per day around 10:00 UTC (2am US Pacific Time).
   *
   * @param {string} provider One of "airnow|airsis|wrcc".
   * @param {string} archiveBaseUrl Base URL for monitoring v2 data files.
   */
  // async loadDaily(
  //   provider = "airnow",
  //   archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  // ) {
  //   try {
  //     await this.#provider_load(provider, "daily", archiveBaseUrl);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }

  /**
   * Construct URL and load Monitor objects from the USFS AirFire archives.
   *
   * This private function is called by `loadLatest()` and `loadDaily()`.
   *
   * @param {string} provider One of "airnow|airsis|wrcc".
   * @param {string} timespan One of "latest".
   * @param {string} archiveBaseUrl Base URL for monitoring v2 data files.
   */
  // async #provider_load(
  //   provider = "airnow",
  //   timespan = "latest",
  //   archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  // ) {
  //   // TODO: support additional arguments
  //   const QC_negativeValues = "zero";
  //   const QC_removeSuspectData = true;

  //   // TODO: load concurrently // https://www.youtube.com/watch?v=QO-3d128l28 14:31
  //   // urlArray = [urlMeta, urlData]
  //   // loadCsvPromises = urlArray.map((url) => aq.loadCsv(url));
  //   // csvArray = await Promise.all(loadCsvPromises);

  //   // * Load meta -----
  //   let url =
  //     archiveBaseUrl +
  //     "/" +
  //     timespan +
  //     "/data/" +
  //     provider +
  //     "_PM2.5_" +
  //     timespan +
  //     "_meta.csv";
  //   let dt = await aq.loadCSV(url);
  //   this.meta = this.#parseMeta(dt, false, this.coreMetadataNames);

  //   // * Load data -----
  //   url =
  //     archiveBaseUrl +
  //     "/" +
  //     timespan +
  //     "/data/" +
  //     provider +
  //     "_PM2.5_" +
  //     timespan +
  //     "_data.csv";
  //   dt = await aq.loadCSV(url);
  //   this.data = this.#parseData(dt);
  // }

  // TODO:  AirNow, AIRSIS and WRCC annual files should be combined and placed
  // TODO:  in an 'annual/' directory. This should be performed on the server.

  // TODO:  Annual files should be copied to S3.

  /**
   * Load 'annual' Monitor objects from USFS AirFire repositories for 'airnow',
   * 'airsis' and 'wrcc' data.
   *
   * This function replaces the 'meta' and 'data' properties of 'this' monitor
   * object with the latest available data. Data cover an entire year or
   * year-to-date. Current year data are updated daily.
   *
   * @param {string} year Year of interest.
   * @param {string} archiveBaseUrl Base URL for monitoring v2 data files.
   */
  // async loadAnnual(
  //   year = "2022",
  //   archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  // ) {
  //   try {
  //     await this.#provider_loadAnnual(year, archiveBaseUrl);
  //   } catch (e) {
  //     console.error(e);
  //   }
  // }

  /**
   * Construct URL and load annual Monitor objects from the USFS AirFire archives.
   *
   * This private function is called by `loadAnnual()`.
   *
   * @param {string} provider One of "airnow|airsis|wrcc".
   * @param {string} timespan One of "latest".
   * @param {string} archiveBaseUrl Base URL for monitoring v2 data files.
   */
  // async #provider_loadAnnual(
  //   year = "2021", // TODO:  Remove default year, replace with "current year logic"
  //   archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  // ) {
  //   // TODO: support additional arguments
  //   const QC_negativeValues = "zero";
  //   const QC_removeSuspectData = true;

  //   // http://data-monitoring_v2-c1.airfire.org/monitoring-v2/airnow/2022/data/airnow_PM2.5_2022_meta.csv
  //   // * Load meta -----
  //   let url =
  //     archiveBaseUrl +
  //     "/airnow/" +
  //     year +
  //     "/data/" +
  //     "airnow_PM2.5_" +
  //     year +
  //     "_meta.csv";
  //   let dt = await aq.loadCSV(url);
  //   //this.meta = this.#annual_parseMeta(dt);
  //   this.meta = this.#parseMeta(dt, false, this.annual_coreMetadataNames);

  //   // * Load data -----
  //   url =
  //     archiveBaseUrl +
  //     "/airnow/" +
  //     year +
  //     "/data/" +
  //     "airnow_PM2.5_" +
  //     year +
  //     "_data.csv";
  //   dt = await aq.loadCSV(url);
  //   this.data = this.#parseData(dt);
  // }

  /**
   * Load custom monitoring data.
   *
   * Two files will be loaded from <baseUrl>:
   *   1. <baseName>_data.csv
   *   2. <baseName>_meta.csv
   *
   * @param baseName File name base..
   * @param baseUrl URL path under which data files are found.
   * @param useAllColumns Logical specifying whether metadata parsing should
   * retain all available columns of data.
   */
  // async loadCustom(baseName = "", baseUrl = "", useAllColumns = true) {
  //   // TODO: support additional arguments
  //   const QC_negativeValues = "zero";
  //   const QC_removeSuspectData = true;

  //   // Example:
  //   // https://airfire-data-exports.s3.us-west-2.amazonaws.com/community-smoke/v1/methow-valley/data/monitor/PM2.5_meta.csv

  //   // * Load meta -----
  //   let url = baseUrl + "/" + baseName + "_meta.csv";
  //   let dt = await aq.loadCSV(url);
  //   this.meta = this.#parseMeta(dt, useAllColumns);

  //   // * Load data -----
  //   url = baseUrl + "/" + baseName + "_data.csv";
  //   dt = await aq.loadCSV(url);
  //   this.data = this.#parseData(dt);
  // }

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

  /**
   * Combine another Monitor object with 'this' object.
   *
   * A new Monitor object is returned containing all time series and metadata from
   * 'this' Monitor as well as the passed in 'monitor'. This allows for chaining to
   * combine multiple Monitor objects.
   *
   * @param {Object} monitor A monitor object.
   * @returns {Object} A combined monitor object.
   */
  combine(monitor) {
    let meta = this.meta.concat(monitor.meta);
    let data = this.data.join(monitor.data); // automatically joins on 'datetime' as the only shared column

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  /**
   * Subset and reorder time series within a monitor object.
   *
   * @param {Array.<string>} ids deviceDeploymentIDs of the time series to select.
   * @returns {Object} A (reordered) subset of the incoming monitor object.
   */
  select(ids) {
    // See https://uwdata.github.io/arquero/api/expressions#limitations
    let meta = this.meta
      .params({ ids: ids })
      .filter((d, $) => op.includes($.ids, d.deviceDeploymentID)); // arquero filter

    let data = this.data.select("datetime", ids);

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  /**
   * Filter a monitor object based on matching values in the 'meta' dataframe.
   * The returned monitor object will contain only those records where
   * monitor.meta.columnName === "value".
   *
   * @param {string} columnName Name of the column used for filtering.
   * @param {string|number} value Value that must be matched.
   * @returns {Object} A subset of the incoming monitor object.
   */
  filterByValue(columnName, value) {
    // See: https://www.infoworld.com/article/3678168/filter-javascript-objects-the-easy-way-with-arquero.html

    // Filter expression differs based on column type
    let filterExpression;
    if (typeof this.meta.get(columnName) === "number") {
      filterExpression =
        "d => op.equal(d." + columnName + ", " + parseFloat(value) + ")";
    } else if (typeof this.meta.get(columnName) === "string") {
      filterExpression =
        "d => op.equal(d." + columnName + ", '" + value.toString() + "')";
    }

    let meta = this.meta.filter(filterExpression);

    let ids = meta.array("deviceDeploymentID");
    let data = this.data.select("datetime", ids);

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  /**
   * Drop monitor object time series with all missing data.
   *
   * @returns {Object} A subset of the incoming monitor object.
   */
  dropEmpty() {
    let validCount = function (dt) {
      // Programmatically create a values object that counts valid values
      const ids = dt.columnNames();
      let values = {};
      ids.map((id) => (values[id] = "d => op.valid(d['" + id + "'])"));
      let new_dt = dt.rollup(values);
      return new_dt;
    };

    // -----

    let meta = this.meta;
    let data = this.data;

    // Single row table with the count of valid values
    let countObj = validCount(data).object(0);
    // {a: 4, b: 4, c: 0}

    let ids = [];
    for (const [key, value] of Object.entries(countObj)) {
      if (value > 0) ids.push(key);
    }

    // Subset data and meta
    data = data.select(ids);

    meta = meta
      .params({ ids: ids })
      .filter((d, $) => op.includes($.ids, d.deviceDeploymentID)); // arquero filter

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  /**
   * Returns a modified Monitor object with the records trimmed to full
   * local time days. Any partial days are discarded.
   *
   * @note This function requires moment.js.
   * @param {string} timezone Olsen timezone for the time series
   * @returns {Object} A subset of the incoming Monitor object.
   */
  trimDate(timezone) {
    // Calculate local time hours and start/end
    let localTime = this.data
      .array("datetime")
      .map((o) => moment.tz(o, timezone));
    let hours = localTime.map((x) => x.hours());
    let start = hours[0] == 0 ? 0 : 24 - hours[0];
    let end =
      hours[hours.length - 1] == 23
        ? hours.length - 1
        : hours.length - hours[hours.length - 1] - 1;

    // https://uwdata.github.io/arquero/api/verbs#slice
    // Subset data and meta
    let data = this.data.slice(start, end);
    let meta = this.meta;

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  // ----- Get single-device values --------------------------------------------

  /**
   * Returns the array of date objects that define this Monitor object's time axis.
   *
   * @returns {Array.<Date>} Array of Date objects.
   */
  getDatetime() {
    return this.data.array("datetime");
  }

  /**
   * Returns an array of PM2.5 values derived from the time series identified by id.
   *
   * @param {String} id deviceDeploymentID of the time series to select.
   * @returns  {Array.<number>}
   */
  getPM25(id) {
    let pm25 = this.data
      .array(id)
      .map((o) =>
        o === null || o === undefined || isNaN(o)
          ? null
          : Math.round(10 * o) / 10
      );
    return pm25;
  }

  /**
   * Returns an array of NowCast values derived from the time series identified
   * by id.
   *
   * @param {string} id deviceDeploymentID of the time series to select.
   * @returns {Array.<number>} Array of NowCast values.
   */
  getNowcast(id) {
    let pm25 = this.data.array(id);
    // pm_nowcast() comes from "air-monitor-algorithms"
    let nowcast = pm_nowcast(pm25);
    return nowcast;
  }

  /**
   * Calculates daily statistics for the time series identified by id after the
   * time series has been trimmed to local-time day boundaries. The starting
   * hour of each local time day and statistics derived from that day's data
   * are returned in an object with `datetime`, `count`, `min`, `mean` and `max`
   * properties.
   *
   * @param {string} id deviceDeploymentID of the time series to select.
   * @returns {Object} Object with `datetime`, `count`, `min`, `mean` and `max`
   */
  getDailyStats(id) {
    let datetime = this.getDatetime();
    let pm25 = this.getPM25(id);
    let timezone = this.getMetadata(id, "timezone");
    // dailyStats comes from "air-monitor-algorithms"
    let daily = dailyStats(datetime, pm25, timezone);
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
   * @param {string} id deviceDeploymentID of the time series to select.
   * @param {number} dayCount Number of most recent days to use.
   * @returns {Object} Object with `hour`, `count`, `min`, `mean` and `max` properties.
   */
  getDiurnalStats(id, dayCount = 7) {
    let datetime = this.getDatetime();
    let pm25 = this.getPM25(id);
    let timezone = this.getMetadata(id, "timezone");
    // diurnalStats comes from "air-monitor-algorithms"
    let diurnal = diurnalStats(datetime, pm25, timezone, dayCount);
    return {
      hour: diurnal.hour,
      count: diurnal.count,
      min: diurnal.min,
      mean: diurnal.mean,
      max: diurnal.max,
    };
  }

  /**
   * Returns the named metadata field for the time series identified by id.
   * @param {string} id deviceDeploymentID of the time series to select.
   * @returns {string|number} The named metadata field for a time series.
   */
  getMetadata(id, fieldName) {
    const index = this.getIDs().indexOf(id);
    return this.meta.array(fieldName)[index];
  }

  /**
   * Returns an object with all metadata properties for the time series
   * identified by id.
   * @param {string} id deviceDeploymentID of the time series to select.
   * @returns {Object} Object with all metadata properties.
   */
  getMetaObject(id) {
    return this.select(id).meta.object();
  }

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

  /**
   * Returns an array of unique identifiers (deviceDeploymentIDs) found in a
   * Monitor object
   *
   * @returns {Array.<string>} An array of deviceDeploymentIDs.
   */
  getIDs() {
    return this.meta.array("deviceDeploymentID");
  }

  /**
   * Returns the number of individual time series found in a Monitor object
   *
   * @returns {number} Count of individual time series.
   */
  count() {
    return this.meta.numRows();
  }

  // ----- Constants -----------------------------------------------------------

  FLOAT_COLUMNS = ['longitude', 'latitude', 'elevation'];

  minimalMetadataNames = [
    "deviceDeploymentID",
    "locationName",
    "longitude",
    "latitude",
    "elevation", // missing is allowed
    "countryCode", // missing is allowed
    "stateCode", // missing is allowed
    "timezone",
  ];

  coreMetadataNames = [
    "deviceDeploymentID",
    "deviceID",
    "deviceType",
    "deploymentType",
    "deviceDescription",
    "pollutant",
    "units",
    "dataIngestSource",
    "locationID",
    "locationName",
    "longitude",
    "latitude",
    "elevation",
    "countryCode",
    "stateCode",
    "countyName",
    "timezone",
    "AQSID",
    "fullAQSID",
  ];

  // NOTE:  No fullAQSID present in airnow annual files
  // TODO:  Remove this when combined annual files are created.
  annual_coreMetadataNames = [
    "deviceDeploymentID",
    "deviceID",
    "deviceType",
    "deviceDescription",
    "pollutant",
    "units",
    "dataIngestSource",
    "locationID",
    "locationName",
    "longitude",
    "latitude",
    "elevation",
    "countryCode",
    "stateCode",
    "countyName",
    "timezone",
    "AQSID",
  ];

  // ----- Private methods -----------------------------------------------------

  /**
   * Automatic parsing works quite well. We help out with:
   *   1. replace 'NA' with null
   *   2. only retain core metadata columns
   *
   * @private
   * @param dt Arquero table.
   * @param useAllColumns Logical specifying whether to ignore metadataNames
   * @param columnNames List of columns to retain
   * and just use all available columns.
   */
  #parseMeta(
    dt,
    useAllColumns = false,
    metadataNames = this.coreMetadataNames
  ) {
    // Programmatically create a values object that replaces values.   See:
    //   https://uwdata.github.io/arquero/api/expressions

    const columns = dt.columnNames();
    const selectedColumns = useAllColumns ? columns : metadataNames;

    // Replace 'NA' with null
    const values1 = {};
    columns.forEach(col => {
      values1[col] = aq.escape(d => d[col] === 'NA' ? null : d[col]);
    });

    // Parse longitude, latitude, and elevation as floats (if present)
    const floatValues = {};
    this.FLOAT_COLUMNS.filter(col => columns.includes(col)).forEach(col => {
      floatValues[col] = aq.escape(d => parseFloat(d[col]));
    });

    return dt.derive(values1).derive(floatValues).select(selectedColumns);
  }

  /**
   * Automatic parsing doesn't automatically recognize 'NA' as null so data gets
   * parsed as text strings. We fix things by:
   *   1. replace 'NA' with null and convert to numeric
   *   2. lift any negative values to zero (matching the default R code behavior)
   *
   * @private
   * @param dt Arquero table.
   */
  #parseData(dt) {
    // const columns = dt.columnNames().slice(1); // skip 'datetime'

    // const values = {};
    // columns.forEach(col => {
    //   values[col] = aq.escape(d => {
    //     const val = d[col] === 'NA' ? null : parseFloat(d[col]);
    //     return val < 0 ? 0 : val;
    //   });
    // });

    // const returnDT = dt.derive(values);

    // Programmatically create a values object that replaces values. See:
    //   https://uwdata.github.io/arquero/api/expressions

    const ids = dt.columnNames().splice(1); // remove 'datetime'

    // Replace 'NA' with null
    let values1 = {};
    ids.map(
      (id) =>
        (values1[id] =
          "d => d['" +
          id +
          "'] === 'NA' ? null : op.parse_float(d['" +
          id +
          "'])")
    );

    // Lift up negative values to zero
    // NOTE:  'null <= 0' evaluates to true. So we have to test with '< 0'.
    let values2 = {};
    ids.map(
      (id) => (values2[id] = "d => d['" + id + "'] < 0 ? 0 : d['" + id + "']")
    );

    // Return the modified data table
    return dt.derive(values1).derive(values2);
  }
}

export { Monitor };