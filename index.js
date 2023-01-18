// First: npm install arquero --save
import * as aq from "arquero";
// First: npm install moment-timezone --save
import moment from "moment-timezone";
// npm install github:MazamaScience/air-monitor-algorithms
import {
  dailyAverage,
  diurnalAverage,
  pm_nowcast,
} from "air-monitor-algorithms";

export default class Monitor {
  // Private fields & methods
  // #parseMeta;
  // #parseData;

  // Initialize with empty arquero tables
  constructor(
    meta = aq.table({
      deviceDeploymentID: [],
      deviceID: [],
      deviceType: [],
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

  // ----- Data load -------------------------------------------------------------

  /**
   * Load latest Monitor objects from USFS AirFire repositories for 'airnow',
   * 'airsis' and 'wrcc' data.
   *
   * This function replaces the 'meta' and 'data' properties of the
   * 'monitorObj' with the latest available data. Data are updated every few minutes.
   * @param {String} provider One of "airnow|airsis|wrcc".
   * @param {String} archiveBaseUrl URL for monitoring v2 data files.
   */
  async loadLatest(
    provider = "airnow",
    archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  ) {
    try {
      await this.#provider_load(provider, "latest", archiveBaseUrl);
    } catch (e) {
      console.error(e);
    }
  }

  async loadDaily(
    provider = "airnow",
    archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  ) {
    try {
      await this.#provider_load(provider, "daily", archiveBaseUrl);
    } catch (e) {
      console.error(e);
    }
  }

  async #provider_load(
    provider = "airnow",
    timespan = "latest",
    archiveBaseUrl = "https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2"
  ) {
    // TODO: support additional arguments
    const QC_negativeValues = "zero";
    const QC_removeSuspectData = true;

    // TODO: load concurrently // https://www.youtube.com/watch?v=QO-3d128l28 14:31
    // urlArray = [urlMeta, urlData]
    // loadCsvPromises = urlArray.map((url) => aq.loadCsv(url));
    // csvArray = await Promise.all(loadCsvPromises);

    // * Load meta -----
    let url =
      archiveBaseUrl +
      "/" +
      timespan +
      "/data/" +
      provider +
      "_PM2.5_" +
      timespan +
      "_meta.csv";
    let dt = await aq.loadCSV(url);
    this.meta = this.#parseMeta(dt);

    // * Load data -----
    url =
      archiveBaseUrl +
      "/" +
      timespan +
      "/data/" +
      provider +
      "_PM2.5_" +
      timespan +
      "_data.csv";
    dt = await aq.loadCSV(url);
    this.data = this.#parseData(dt);
  }

  // ----- Monitor manipulation ------------------------------------------------

  /**
   * Combine another Monitor object with 'this' object.
   *
   * A new Monitor object is returned containing all time series and metadata from
   * 'this' Monitor as well as the passed in 'monitor'. This allows for chaining to
   * combine multiple Monitor objects.
   * @param {Monitor} monitor A monitor object.
   * @returns {Monitor} A combined monitor object.
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
   * @param {...String} ids deviceDeploymentIDs of the time series to select.
   * @returns {Monitor} A reordered (subset) of the incoming monitor object.
   */
  select(ids) {
    let meta = this.meta
      .params({ ids: ids })
      .filter((d, $) => op.includes($.ids, d.deviceDeploymentID)); // arquero filter

    let data = this.data.select("datetime", ids);

    // Return
    let return_monitor = new Monitor(meta, data);
    return return_monitor;
  }

  /**
   * Drop monitor object time series with all missing data.
   * @returns {Monitor} A subset of the incoming monitor object.
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
   * @note This function requires moment.js.
   * @param {String} timezone Olsen timezone for the time series
   * @returns {Monitor} A subset of the incoming Monitor object.
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
   * @returns {...Date} Array of Date objects.
   */
  getDatetime(id) {
    return this.data.array("datetime");
  }

  /**
   * Returns an array of PM2.5 values derived from the time series identified by id.
   * @param {String} id deviceDeploymentID of the time series to select.
   * @returns  {...Number}
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
   * Returns an array of NowCast values derived from the time series identified by id.
   * @param {*} id deviceDeploymentID of the time series to select.
   * @returns {...Number} Array of NowCast values.
   */
  getNowcast(id) {
    let pm25 = this.data.array(id);
    // pm_nowcast() comes from "air-monitor-algorithms"
    let nowcast = pm_nowcast(pm25);
    return nowcast;
  }

  /**
   * Calculates daily averages for the time series identified by id after the
   * time series has been trimmed to local-time day boundaries. The starting
   * hour of each local time day and the daily average PM2.5 value associated
   * with that day are returned in an object with 'datetime' and 'average_pm25' properties.
   * @param {*} id deviceDeploymentID of the time series to select.
   * @returns {Object} Object with 'datetime' and 'average_pm25' arrays.
   */
  getDailyAverage(id) {
    let datetime = this.getDatetime();
    let pm25 = this.getPM25(id);
    let timezone = this.getMetadata(id, "timezone");
    // dailyAverage comes from "air-monitor-algorithms"
    let daily = dailyAverage(datetime, pm25, timezone);
    return { datetime: daily.datetime, average: daily.average };
  }

  /**
   * Calculates hour-of-day averages for the time series identified by id after
   * the time series has been trimmed to local-time day boundaries. The starting
   * hour of each local time day and the daily average PM2.5 value associated
   * with that day are returned in an object with 'hour' and 'average_pm25' properties.
   * @param {*} id deviceDeploymentID of the time series to select.
   * @returns {Object} Object with 'hour' and 'average_pm25' arrays.
   */
  getDiurnalAverage(id) {
    let datetime = this.getDatetime();
    let pm25 = this.getPM25(id);
    let timezone = this.getMetadata(id, "timezone");
    // diurnalAverage comes from "air-monitor-algorithms"
    let diurnal = diurnalAverage(datetime, pm25, timezone, 7);
    return { hour: diurnal.hour, average: diurnal.average };
  }

  /**
   * Returns the named metadata field for the time series identified by id.
   * @param {*} id deviceDeploymentID of the time series to select.
   * @returns {Object} Object with 'datetime' and 'pm25' arrays.
   */
  getMetadata(id, fieldName) {
    const index = this.getIDs().indexOf(id);
    return this.meta.array(fieldName)[index];
  }

  // ----- Utility methods -----------------------------------------------------

  /**
   * Returns an array of unique identifiers (deviceDeploymentIDs) found in a Monitor object
   * @returns {...String} An array of deviceDeploymentIDs.
   */
  getIDs() {
    return this.meta.array("deviceDeploymentID");
  }

  /**
   * Returns the number of individual time series found in a Monitor object
   * @returns {Number} Count of individual time series.
   */
  count() {
    return this.meta.numRows();
  }

  // ----- Constants -----------------------------------------------------------

  coreMetadataNames = [
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
    "fullAQSID",
  ];

  // ----- Private methods -----------------------------------------------------

  /**
   * Automatic parsing works quite well. We help out with:
   *   1. replace 'NA' with null
   *   2. only retain core metadata columns
   * @param dt Arquero table.
   */
  #parseMeta(dt) {
    // Programmatically create a values object that replaces values. See:
    //   https://uwdata.github.io/arquero/api/expressions

    const ids = dt.columnNames();

    // Replace 'NA' with null
    let values1 = {};
    ids.map(
      (id) =>
        (values1[id] = "d => d['" + id + "'] === 'NA' ? null : d['" + id + "']")
    );

    // Guarantee numeric
    let values2 = {
      longitude: (d) => op.parse_float(d.longitude),
      latitude: (d) => op.parse_float(d.latitude),
      elevation: (d) => op.parse_float(d.elevation),
    };
    return dt.derive(values1).derive(values2).select(this.coreMetadataNames);
  }

  /**
   * Automatic parsing doesn't automatically recognize 'NA' as null so data gets
   * parsed as text strings. We fix things by:
   *   1. replace 'NA' with null and convert to numeric
   *   2. lift any negative values to zero (matching the default R code behavior)
   * @param dt Arquero table.
   */
  #parseData(dt) {
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
