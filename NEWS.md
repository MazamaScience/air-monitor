# air-monitor 1.0.4

Added `getMetaObject()` to return an object with all metadata.

# air-monitor 1.0.3

Replaced `dailyAverage()` and `diurnalAverage()` methods with `dailyStats()`
and `diurnalStats()`. Both now return objects with `datetime` or `hour` as well
as `count`, `min`, `mean` and `max` properties.

# air-monitor 1.0.2

Added functions to help with generating interactive maps:

- `getCurrentStatus()` -- Returns the `meta` dataframe updated with the
  most recent time and pm25 value for each monitor.
- `createGeoJSON()` -- Creates a.geojson version of the current status information.

# air-monitor 1.0.1

Initial release includes basic functionality for working with hourly
monitoring data from the USFS AirFire monitoring data archives.
