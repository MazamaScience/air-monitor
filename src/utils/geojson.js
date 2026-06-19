/**
 * Utility functions for computing current status summaries and generating GeoJSON
 * FeatureCollections from Monitor metadata. These are used to spatially visualize the
 * most recent valid air quality measurements and data latencies from each deployed sensor.
 *
 * Internal functions:
 * - `internal_getCurrentStatus()` – Appends current data statistics to the Monitor's metadata table.
 * - `internal_createGeoJSON()` – Creates a .geojson file with current data statistics for each time series.
 */

import * as aq from "arquero";

/**
 * Compute the most recent valid timestamp and value for each deviceDeploymentID,
 * and append them to the metadata table.
 *
 * @param {Monitor} monitor - The Monitor instance.
 * @returns {aq.Table} An enhanced metadata table with last valid datetime and value.
 */
export function internal_getCurrentStatus(monitor) {
  const { data, meta } = monitor;
  const ids = monitor.getIDs();

  // For each series, find the index of the most recent finite (valid) value.
  // Using -1 as the sentinel so a series whose only valid value is at row 0
  // is distinguishable from a fully-empty series (which stays at -1).
  // Plain JS array walk avoids string-interpolated Arquero expressions, which
  // break for deviceDeploymentIDs containing quotes or backslashes.
  const n = data.numRows();
  const lastValidIndices = ids.map(id => {
    const arr = data.array(id);
    let lastIdx = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(arr[i])) lastIdx = i;
    }
    return lastIdx;
  });

  // For series with no valid observations (index === -1), report null rather than
  // falsely reporting row 0 as the most recent valid status.
  const datetimeColumn = data.array("datetime");
  const lastValidDatetime = lastValidIndices.map(i => (i < 0 ? null : datetimeColumn[i]));
  // Round to 1 decimal place to match getPM25()/daily stats. Load-time data is
  // not rounded, so reading it raw here would otherwise report more decimals
  // than the rest of the API.
  const lastValidValues = ids.map((id, i) => {
    if (lastValidIndices[i] < 0) return null;
    const value = data.get(id, lastValidIndices[i]);
    return value == null ? null : Math.round(value * 10) / 10;
  });

  const statusTable = aq.table({
    lastValidDatetime,
    lastValidPM_25: lastValidValues, // Generic, though field is named for PM2.5
  });

  return meta.assign(statusTable);
}

/**
 * Convert the current metadata table to a GeoJSON FeatureCollection.
 *
 * @param {Monitor} monitor - The Monitor instance.
 * @returns {Object} A GeoJSON FeatureCollection object.
 */
export function internal_createGeoJSON(monitor) {
  const meta = internal_getCurrentStatus(monitor);
  const features = [];

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

  // Format any DateTime objects to human-readable strings with timezone
  const formatDT = (dt) =>
    dt?.toFormat?.('yyyy-MM-dd HH:mm:ss ZZZZ') ?? null;

  for (let i = 0; i < meta.numRows(); i++) {
    const site = meta.slice(i, i + 1).object();

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [site.longitude, site.latitude],
      },
      properties: {
        deviceDeploymentID: site.deviceDeploymentID,
        locationName: site.locationName,
        last_time: formatDT(site.lastValidDatetime),
        last_pm25: site.lastValidPM_25?.toString() ?? null,
        // timezone: site.timezone,
        // dataIngestSource: site.dataIngestSource,
        // dataIngestUnitID: site.dataIngestUnitID,

        // currentStatus_processingTime: formatDT(site.currentStatus_processingTime),
        // last_validTime: formatDT(site.lastValidDatetime),
        // last_validLocalTimestamp: formatDT(site.lastValidLocalTimestamp),

        // last_nowcast: site.lastNowcast?.toString() ?? null,
        // last_PM2_5: site.lastValidPM_25?.toString() ?? null,
        // last_latency: site.lastLatency?.toString() ?? null,
        // yesterday_PM2_5_avg: site.yesterdayAvgPM_25?.toString() ?? null,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
