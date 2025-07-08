# air-monitor

Utilities for working with hourly air quality monitoring data
with a focus on small particulates (PM2.5). This package is designed for
scientific analysis with a focus on robust and performant algorithms.

## Overview

This package provides a compact data model and transformation utilities for
working with air quality monitor deployments, including:

- Spatial metadata (e.g., location, timezone, ID)
- Hourly time-series measurements (e.g., PM2.5)
- Integration with GeoJSON
- Timezone-aware trimming and aggregation
- Methods to summarize, filter, and export subsets of the data

All functionality is encapsulated in a `Monitor` class designed for ES module
environments and data-driven workflows. It is also useful in Svelte and Vue applications.

## Data Model

The compact data model for a _monitor_ object consists of two aligned **Arquero** tables:

- `meta`: A metadata table describing each monitoring device deployment
- `data`: A time-series table with hourly observations and a `datetime` column (UTC)

Both tables are linked by a shared identifier:

    meta.deviceDeploymentID  <--->  data columns (besides datetime)

## Install

    npm install air-monitor

## Example Usage

    import Monitor from 'air-monitor';

    // Load AirNow monitor data
    const monitor = new Monitor();
    await monitor.loadLatest("airnow");
    console.log(`airnow has ${monitor.count()} monitors`);

    // Filter to a single state
    const wa = monitor.filterByValue('stateCode', 'WA');
    console.log(`washington has ${wa.count()} monitors`);

    // Get pm25 array and metadata for Entiat, WA
    const id = wa
      .filterByValue('locationName', 'Entiat')
      .getIDs();
    const pm25 = wa.getPM25(id);
    const meta = wa.getMetaObject(id);

    console.log(pm25);
    console.log(JSON.stringify(meta, null, 2));

## Key Features

- ✅ Clean parsing of time-series CSVs (with `'NA'`, negative, and NaN handling)
- ✅ Accurate trimming to full local-time days with DST support
- ✅ Chaining API for filtering, summarizing, and reshaping
- ✅ GeoJSON export with per-site metadata and recent status
- ✅ UVU-based test suite with 100% transformation coverage

## API Highlights

### `new Monitor(metaTable, dataTable)`
Creates a new monitor instance from parsed tables.

### `loadCustom(baseName, baseUrl)`
Loads `{baseName}.meta.csv` and `{baseName}.data.csv` from a file URL.

### `filterByValue(column, value)`
Returns a new `Monitor` filtered by a metadata column.

### `collapse(granularity, method)`
Aggregates time series by day or hour using `mean`, `max`, etc.

### `combine(otherMonitor)`
Merges another monitor instance into the current one.

### `dropEmpty()`
Removes device series that contain no valid observations.

### `trimDate(timezone, trimEmptyDays = true)`
Trims incomplete or fully missing days from the edges of the time range.

### `getCurrentStatus()`
Appends most recent valid timestamp and value to each metadata row.

### `createGeoJSON()`
Converts metadata + status into a valid GeoJSON `FeatureCollection`.

## Assumptions

- `data.datetime` is a regular hourly time axis with no gaps
- All non-datetime values are either finite numbers or `null`
- Time-series columns match exactly with `meta.deviceDeploymentID`
- `datetime` values are stored in UTC (not local time)

## Related Packages

- [air-monitor-algorithms](https://www.npmjs.com/package/air-monitor-algorithms)
- [air-monitor-plots](https://www.npmjs.com/package/air-monitor-plots)

## License

GPL-3.0-or-later
© 2024–2025 Jonathan Callahan / USFS AirFire
