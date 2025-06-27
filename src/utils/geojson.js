/**
 * @module utils/geojson
 * @description
 * Utility functions for computing current status summaries and generating GeoJSON
 * FeatureCollections from Monitor metadata. These are used to spatially visualize the
 * most recent valid air quality measurements and data latencies from each deployed sensor.
 *
 * Internal functions:
 * - {@link internal_getCurrentStatus} – Appends current data statistics to the Monitor's metadata table.
 * - {@link internal_createGeoJSON} – Creates a .geojson file with current data statistics for each time series.
 */

import * as aq from "arquero";
const op = aq.op;

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

  // Add a zero-based index to non-datetime columns
  const dataWithIndex = data
    .select(aq.not("datetime"))
    .derive({ index: d => op.row_number() - 1 });

  // Replace valid values with their row index; else 0
  const valueExprs = {};
  ids.forEach(id => {
    valueExprs[id] = `d => op.is_finite(d['${id}']) ? d.index : 0`;
  });

  // Find max index per ID (i.e., most recent valid row)
  const maxIndexExprs = {};
  ids.forEach(id => {
    maxIndexExprs[id] = `d => op.max(d['${id}'])`;
  });

  const lastValidIndexObj = dataWithIndex.derive(valueExprs).rollup(maxIndexExprs).object(0);
  const lastValidIndices = Object.values(lastValidIndexObj);

  const lastValidDatetime = lastValidIndices.map(i => data.array("datetime")[i]);
  const lastValidValues = ids.map((id, i) => data.get(id, lastValidIndices[i]));

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
        last_time: site.lastValidDatetime,
        last_pm25: site.lastValidPM_25,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
