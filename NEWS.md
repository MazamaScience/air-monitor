# air-monitor 1.0.9

Added `filterByValue()` method.

# air-monitor 1.0.8

Added `useAllColumns` argument to `#parseMeta()` and `loadCustom()`
method. `loadCustom() defaults to `useAllColumns = true`.

# air-monitor 1.0.7

Added `loadCustom()` method to load monitoring data from places other than the
USFS AirFire data archives.

# air-monitor 1.0.6

Tweaked `loadAnnual()` to work with 2022 data.

_NOTE:_ This is a temporary hack for testing until we can create combined
annual files that have complete metadata.

# air-monitor 1.0.5

Added `loadAnnual()` method to load a years worth of data.

# air-monitor 1.0.4

Added `getMetaObject()` method to return an object with all metadata.

# air-monitor 1.0.3

Replaced `dailyAverage()` and `diurnalAverage()` methods with `dailyStats()`
and `diurnalStats()`. Both now return objects with `datetime` or `hour` as well
as `count`, `min`, `mean` and `max` properties.

# air-monitor 1.0.2

Added methods to help with generating interactive maps:

- `getCurrentStatus()` -- Returns the `meta` dataframe updated with the
  most recent time and pm25 value for each monitor.
- `createGeoJSON()` -- Creates a.geojson version of the current status information.

# air-monitor 1.0.1

Initial release includes basic functionality for working with hourly
monitoring data from the USFS AirFire monitoring data archives.
