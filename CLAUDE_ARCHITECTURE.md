# CLAUDE_ARCHITECTURE.md
# Architecture Notes — air-monitor

This document is maintained as a reference for human maintainers and as context
for AI assistants working on this codebase. Source code, generated JSDoc, and
human-reviewed release notes (`NEWS.md`) remain authoritative.

---

## FOR HUMANS

### Purpose and Scope

`air-monitor` is a JavaScript library (npm package) of utilities for working with
hourly air quality monitoring data, with a focus on small particulates (PM2.5).
It provides a compact, in-memory data model and a chaining API for loading,
filtering, reshaping, summarizing, and exporting monitoring data.

All functionality is encapsulated in a single `Monitor` class. A monitor object
holds two aligned **Arquero** tables:

- `meta` — one row per device deployment (spatial and descriptive metadata).
- `data` — an hourly, UTC time-series table with a `datetime` column and one
  column per `deviceDeploymentID`.

The two tables are linked by `deviceDeploymentID`: every non-`datetime` column in
`data` corresponds to a row in `meta`.

It is intentionally a focused library: no UI, no server, no persistence. It
loads CSVs into memory, transforms them, and hands back arrays, objects, GeoJSON,
or new `Monitor` instances.

**What it does not do:**
- It does not store or cache data (everything is in memory for the lifetime of
  the object).
- It does not implement scientific algorithms directly — NowCast and daily/diurnal
  statistics are delegated to the `air-monitor-algorithms` package.
- It does not provide plotting (see the related `air-monitor-plots` package).
- It does not perform spatial queries beyond simple metadata filtering.

### Dependencies on Other Packages and Services

Runtime dependencies (see `package.json`):

- **arquero** (`7.2.1`) — the dataframe engine; both `meta` and `data` are
  Arquero tables, and most transformations are Arquero operations.
- **luxon** (`3.6.1`) — all date/time handling. The `datetime` axis is composed
  of Luxon `DateTime` objects in UTC.
- **air-monitor-algorithms** — scientific algorithms (`pm_nowcast`, `dailyStats`,
  `diurnalStats`).

External data services (accessed via HTTP at load time only):

- The USFS AirFire data archive, default base URL:
  `https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2`
  Used by `loadLatest`, `loadDaily`, and `loadAnnual`. A custom base URL can be
  supplied to any loader, and `loadCustom` loads arbitrary paired CSVs.

Related packages (not dependencies): `air-monitor-plots`.

### Build, Test, and Release

- **Build:** `npm run build` runs rollup (`rollup.config.js`) to produce two
  bundles in `dist/`:
  - `air-monitor.esm.js` — ES module build (the `module` / `import` entry point).
  - `air-monitor.umd.js` — UMD build exposing `window.Monitor` (the `main` /
    `require` entry point).
  Both builds treat `arquero` and `air-monitor-algorithms` as **external**
  (not bundled).
- **Test:** `npm test` runs the `uvu` suite over `tests/`. Tests use real ESM
  imports and a small fixture pair (`tests/test_meta.csv`, `tests/test_data.csv`).
- **Docs:** `npm run docs` generates JSDoc into `docs/`.
- **Versioning:** `npm version <patch|minor|major>` after committing code changes;
  record user-facing changes in `NEWS.md`. `package.json` is the single source of
  truth for the version.

---
---

## FOR AI

The sections below provide architectural context to help AI assistants understand
how this codebase is structured, why it is designed the way it is, and how
changes in one area may affect others.

### Module Layout and the Delegation Pattern

The public surface is deliberately thin. `src/index.js` exports the `Monitor`
class (as both default and named export). `src/Monitor.js` defines the class, but
nearly every method is a one- or two-line wrapper that delegates to an
`internal_*` function in `src/utils/`:

| Concern | Module | Internal functions |
|---------|--------|--------------------|
| Loading | `src/utils/load.js` | `internal_loadLatest`, `internal_loadDaily`, `internal_loadAnnual`, `internal_loadCustom` |
| Parsing/cleaning | `src/utils/parse.js` | `parseMeta`, `parseData` |
| Per-device analysis | `src/utils/analysis.js` | `internal_getTimezone`, `internal_getPM25`, `internal_getNowcast`, `internal_getDailyStats`, `internal_getDiurnalStats` |
| Transformation | `src/utils/transform.js` | `internal_collapse`, `internal_combine`, `internal_select`, `internal_filterByValue`, `internal_filterDatetime`, `internal_dropEmpty`, `internal_trimDate` |
| Status / export | `src/utils/geojson.js` | `internal_getCurrentStatus`, `internal_createGeoJSON` |
| Shared helpers | `src/utils/helpers.js` | `arrayMean`, `round1`, `validateDeviceID`, `assertIsMonitor`, `validateDataTable`, `parseDatetime` |

When adding functionality, follow this pattern: keep the public method small and
JSDoc-documented in `Monitor.js`, and put the real logic in the appropriate
`utils` module so it can be tested independently.

### Two Distinct Internal Contracts

There is an important and deliberate asymmetry in what the `internal_*` functions
return:

1. **Loaders mutate in place.** `internal_load*` replace `monitor.meta` and
   `monitor.data` on the *existing* instance and resolve to `void`/the monitor.
   This is why loaders are called on a freshly constructed `Monitor`.

2. **Transformations return plain `{ meta, data }`.** `internal_collapse`,
   `internal_combine`, `internal_select`, `internal_filterByValue`,
   `internal_filterDatetime`, `internal_dropEmpty`, and `internal_trimDate`
   do **not** construct a `Monitor`. They return plain `{ meta, data }` objects.
   The public method in `Monitor.js` wraps the result with `new Monitor(meta, data)`
   and then calls `assertIsMonitor(result, '<method>')`.

Analysis functions (`getPM25`, `getNowcast`, etc.) are a third category: they
return arrays/objects/scalars and never a `Monitor`.

Keeping the wrap-and-assert step in the public layer (not in the internal
functions) avoids a circular dependency, since `helpers.js` imports `Monitor`
to implement `assertIsMonitor`.

### Immutability

Transformation methods never mutate the source monitor; they always produce a new
`Monitor`. The two exceptions to "no mutation" are the loaders, which by design
populate the instance they are called on. Preserve this model — downstream code
relies on chained transformations being non-destructive.

### Data Loading Lifecycle

A typical `loadLatest`/`loadDaily` call flows as follows:

1. The public method calls `internal_loadLatest(this, provider, baseUrl)`.
2. `providerLoad()` constructs two URLs of the form
   `{baseUrl}/{timespan}/data/{provider}_PM2.5_{timespan}_{meta|data}.csv`.
3. Both CSVs are fetched **in parallel** via `Promise.allSettled` over
   `loadWithRetry()` (default 2 attempts each).
4. The `datetime` column is parsed at CSV-load time into Luxon `DateTime`
   objects pinned to UTC (`DateTime.fromISO(s, { zone: 'UTC' })`).
5. On success, `parseMeta()` and `parseData()` clean the tables and assign them
   to `monitor.meta` / `monitor.data`. If either fetch fails, the errors are
   logged and a single `Error('Failed to load data from URL.')` is thrown.

`loadAnnual` uses a slightly different path (`providerLoadAnnual`, airnow-only
URL layout and a reduced `annual_coreMetadataNames` set). `loadCustom` loads
`{baseName}_meta.csv` / `{baseName}_data.csv` and defaults to keeping all
metadata columns.

### Parsing and Data Cleaning

`parseMeta()`:
- Replaces the string `'NA'` with `null` across all columns.
- Parses `longitude`, `latitude`, `elevation` as floats.
- Restricts columns to a named subset unless `useAllColumns` is true.

`parseData()`:
- Skips the first column (assumed `datetime`).
- Replaces `'NA'` with `null` and parses remaining values as floats.
- **Clamps negative measurements to zero** (a domain rule for PM2.5).
- Replaces non-finite values (NaN/Infinity) with `null`.
- Calls `validateDataTable()` as a final gate.

`validateDataTable()` enforces the core invariants the rest of the library
assumes: a `datetime` column of valid Luxon `DateTime` objects in UTC, strictly
increasing and **spaced exactly one hour apart**, with all other columns numeric
or `null`. Many transformations (e.g. `trimDate`, daily/diurnal stats) depend on
this regular hourly axis — do not weaken these guarantees casually.

### Date and Time Model

- The canonical time axis is `data.datetime`: Luxon `DateTime`, UTC, hourly,
  gap-free.
- All conversions to local time are explicit and timezone-aware (IANA strings
  from `meta.timezone`). `trimDate`, `filterDatetime`, `getDailyStats`, and
  `getDiurnalStats` all operate on local-time day boundaries with DST handled by
  Luxon.
- `parseDatetime()` (in `helpers.js`) is the shared entry point for interpreting
  user-supplied dates: Luxon `DateTime` passes through unchanged; strings and
  native `Date`s require an explicit `timezone`. Date-only strings can be
  promoted to end-of-day when `isEnd` is true, so whole-day ranges are inclusive.
- Avoid introducing native `Date` math; convert through Luxon and stay explicit
  about zones.

### Rounding Convention

`round1()` (in `helpers.js`) rounds every non-`datetime` column to one decimal
place and coerces non-finite values to `null`. Nearly all transformation
functions pass their result through `round1()` before returning, and
`getPM25()` rounds independently. This keeps numeric output stable and small.
If you add a transformation, apply `round1()` for consistency.

### Notable Implementation Details

**`collapse` works around Arquero's lack of row/transpose ops.** Arquero has no
native row-wise or transpose operation, so `internal_collapse` folds → pivots →
folds to aggregate across device columns into a single series, then rebuilds the
`datetime` column as Luxon UTC `DateTime` objects (it deliberately avoids
`op.parse_date`, which would yield native `Date`s). See the `NOTE:` comments in
`transform.js`.

**`combine` uses a full join.** `internal_combine` drops `deviceDeploymentID`s
from the second monitor that already exist in the first, then `join_full`s on
`datetime` so the union of all timestamps from both monitors is retained
(behavior introduced in 1.0.11).

**`filterDatetime` uses binary search.** Because the axis is sorted, it locates
the inclusive index range with two O(log n) binary searches over precomputed
millisecond values, and returns an empty (schema-preserving) data table when the
range does not overlap.

**`select` reorders to match the requested IDs.** It rebuilds `meta` row-by-row
in the caller's ID order and rejects duplicate or missing IDs.

**`getCurrentStatus` finds the last valid index per column** via an
index-tagging + rollup-max pattern, then augments `meta` with `lastValidDatetime`
and `lastValidPM_25`. `createGeoJSON` builds a `FeatureCollection` on top of that;
note that several properties (timezone, nowcast, latency, etc.) are present in the
reference comment but currently commented out — the emitted properties are
`deviceDeploymentID`, `locationName`, `last_time`, and `last_pm25`.

### Validation and Error Handling

- Device IDs are normalized and checked by `validateDeviceID()` (accepts a string
  or single-element array; verifies the column exists in `data`).
- Public transformations assert their return type with `assertIsMonitor()`.
- `validateDataTable()` guards the structural invariants after parsing.
- Errors are thrown with operational context (method, device ID, timezone, etc.)
  rather than failing silently. Loaders log per-file failures to the console and
  throw a single summarizing error. Preserve this "fail loud, fail clear" style.

### Metadata Schemas

Three column sets are defined in `load.js`:
- `coreMetadataNames` — the standard set used by `loadLatest`/`loadDaily` (and
  mirrored by the default `meta` schema in the `Monitor` constructor).
- `annual_coreMetadataNames` — a reduced set for annual files (no
  `deploymentType`, `fullAQSID`).
- `minimalMetadataNames` — a minimal set (currently defined but not the default
  path).

`deviceDeploymentID` is the join key and must always be present. Treat these
column names, the CSV file-naming convention, and the GeoJSON output structure as
external interfaces: downstream systems and related packages depend on them, so
prefer backward-compatible changes and call out anything breaking in `NEWS.md`.

### Build Topology

`rollup.config.js` emits ESM and UMD bundles, both marking `arquero` and
`air-monitor-algorithms` as external (the UMD build maps them to the `aq` and
`AirMonitorAlgorithms` globals). Consumers are expected to provide these
dependencies. `dist/` is generated output and should be rebuilt with
`npm run build`, never hand-edited.

### Known Limitations and Future Work

- **Loaders mutate the instance and resolve to the monitor**, while
  transformations return new instances. This intentional asymmetry can surprise
  newcomers; it is documented here rather than changed.
- **`collapse` uses placeholder identifiers** (`locationID = "xxx"`,
  `deviceDeploymentID = "xxx_<deviceID>"`). A `TODO` notes a future geohash-based
  `locationID`.
- **`createGeoJSON` emits a reduced property set.** Richer status fields
  (nowcast, latency, yesterday average, local timestamp) are stubbed in comments
  but not yet wired up.
- **Hourly, gap-free axis is assumed, not repaired.** `validateDataTable` rejects
  irregular axes but there is no resampling/gap-filling step; inputs must already
  be regular.
- **No network-level tests.** Loaders hit live URLs; the test suite exercises
  parsing and transformations against local fixtures only.
