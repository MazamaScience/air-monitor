# CLAUDE_ARCHITECTURE.md
# Architecture Notes — air-monitor

This document is maintained as a reference for human maintainers and as context
for AI assistants working on this codebase. Source code, inline comments, and
human-reviewed release notes remain authoritative.

---

## FOR HUMANS

### Purpose and Scope

`air-monitor` is a JavaScript (ES module) library providing a compact in-memory
data model — the `Monitor` class — for hourly air quality monitoring data,
focused on PM2.5. It loads CSVs, cleans and validates them, transforms and
summarizes them, and exports the result as arrays, plain objects, GeoJSON, or
new `Monitor` instances.

**What it does:** data loading, cleaning/validation, reshaping (select, filter,
combine, collapse, trim), per-device extraction and statistics, and GeoJSON
export.

**What it does not do:** it does not implement the scientific algorithms
themselves — NowCast and daily/diurnal statistics are delegated to the companion
`air-monitor-algorithms` package. It is not a server, CLI, or visualization
library (plotting lives in `air-monitor-plots`).

### Directory Structure

| Path | Responsibility |
|------|----------------|
| `src/index.js` | Sole export surface; exposes `Monitor` as default + named export. |
| `src/Monitor.js` | The `Monitor` class — thin, JSDoc'd methods that delegate to `internal_*` functions. Holds `meta` + `data` Arquero tables. |
| `src/utils/load.js` | Remote/custom CSV loaders; parallel fetch with `Promise.allSettled` + `loadWithRetry`. |
| `src/utils/parse.js` | CSV cleaning (`'NA'`→null, float parse, negatives→0, non-finite→null) and the `validateDataTable` structural gate. |
| `src/utils/analysis.js` | Per-device extraction/stats; delegates algorithms to `air-monitor-algorithms`. |
| `src/utils/transform.js` | Reshaping: `collapse`, `combine`, `select`, `filterByValue`, `filterDatetime`, `dropEmpty`, `trimDate`. |
| `src/utils/geojson.js` | Current-status computation and GeoJSON `FeatureCollection` export. |
| `src/utils/helpers.js` | Shared primitives: `arrayMean`, `round1`, `validateDeviceID`, `assertIsMonitor`, `validateDataTable`, `parseDatetime`. |
| `tests/` | UVU test suite + CSV fixtures (`test_meta.csv`, `test_data.csv`). |
| `dist/` | Generated Rollup bundles (ESM + UMD). Committed; never hand-edited. |
| `docs/` | Generated JSDoc HTML. Never hand-edited. |
| `examples/` | Browser demos (`basic.html`, `test.html`) + vendored algorithms bundle. |

### Relationship to Other Systems

- **Depends on:** `arquero` (table engine), `luxon` (datetime), and
  `air-monitor-algorithms` (NowCast + stats). Loads CSVs over HTTP from the USFS
  AirFire S3 archive (`https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2`).
- **Depended on by:** downstream scientific / data-viz apps (Svelte, Vue) and
  the related `air-monitor-plots` package.
- **Public contract:** the `Monitor` class method names, parameter order, return
  shapes, and units are a public API. Changing them is a breaking change.

### Distribution and Installation

Published to npm as `air-monitor` (`npm install air-monitor`), GPL-3.0-or-later.
The version number is defined in `package.json`; `NEWS.md` is the human-readable
changelog. The `files` field controls what ships: `dist`, `src`, `README.md`,
`LICENSE`. `npm run build` produces the `dist/` bundles; `npm run
publish:public` publishes.

---

## FOR AI

The sections below provide architectural context to help AI assistants understand
how this codebase is structured, why it is designed the way it is, and how
changes in one area may affect others.

### Core Data Conventions

These are **load-bearing** — nearly every function assumes them, and downstream
consumers rely on them:

- A monitor is **two aligned Arquero tables**: `meta` (one row per
  `deviceDeploymentID`) and `data` (rows = `datetime`, one column per
  `deviceDeploymentID`).
- `deviceDeploymentID` is the **join key**: a `meta` row maps to the `data`
  column of the same name. It is unique within `meta`.
- `data.datetime` holds **Luxon `DateTime` objects in UTC**, strictly
  increasing, spaced **exactly 1 hour apart, gap-free**. Enforced by
  `validateDataTable()` (`helpers.js`).
- All non-`datetime` values are **finite numbers or `null`**. During parsing,
  `'NA'` → `null`, negatives → `0` (PM2.5 domain rule), non-finite → `null`.
- Local-time operations require an explicit **IANA timezone** string; the data
  itself is always UTC.

### Module Map

| Module | Key Exports | Role |
|--------|-------------|------|
| `index.js` | `Monitor` (default + named) | Export surface. |
| `Monitor.js` | `Monitor` class | Public API; delegates to `internal_*`. |
| `utils/load.js` | `internal_loadLatest/Daily/Annual/Custom` | Fetch + parse CSVs, populate a monitor in place. |
| `utils/parse.js` | `parseMeta`, `parseData` | Clean raw CSV tables; `parseData` runs `validateDataTable`. |
| `utils/analysis.js` | `internal_getTimezone/PM25/Nowcast/DailyStats/DiurnalStats` | Per-device extraction + stats. |
| `utils/transform.js` | `internal_collapse/combine/select/filterByValue/filterDatetime/dropEmpty/trimDate` | Reshaping; each returns `{ meta, data }`. |
| `utils/geojson.js` | `internal_getCurrentStatus`, `internal_createGeoJSON` | Status summary + GeoJSON export. |
| `utils/helpers.js` | `arrayMean`, `round1`, `validateDeviceID`, `assertIsMonitor`, `validateDataTable`, `parseDatetime` | Shared primitives. |

### Dependency / Call Graph

```
index.js → Monitor.js
  Monitor.js delegates to:
    load.js      → parse.js (parseMeta/parseData) → helpers.js (validateDataTable)
    analysis.js  → air-monitor-algorithms (pm_nowcast, dailyStats, diurnalStats)
                 → helpers.js (validateDeviceID)
    transform.js → helpers.js (arrayMean, round1, parseDatetime), latlon-geohash (Geohash.encode)
    geojson.js   → (uses monitor.getIDs / Arquero directly)
  helpers.js → Monitor.js (only for the `instanceof Monitor` check in assertIsMonitor)
```

Shared foundations that affect many modules: **`helpers.js`** (validation +
`round1`, used by most transforms) and **Arquero / Luxon** (the data model and
datetime contract). A change to `validateDataTable` or the datetime convention
ripples everywhere.

### Key Design Decisions

1. **Thin class, logic in `internal_*` utilities.** `Monitor` methods are
   one-line delegators. This keeps the public API small and testable and lets the
   utilities be pure functions returning `{ meta, data }`. Don't move logic into
   the class.
2. **Transforms return a NEW `Monitor`; `load*()` mutate in place and return
   `this`.** Every transform method wraps its `{ meta, data }` result in
   `new Monitor(...)` and re-checks it with `assertIsMonitor`. The `load*()`
   methods, by contrast, replace `this.meta`/`this.data` (in-place mutation) and
   then `return this`, so `const m = await new Monitor().loadLatest(...)` and the
   bare-`await` mutation pattern both work.
3. **Strict datetime validation gate.** `validateDataTable` enforces UTC +
   hourly + gap-free at parse time so downstream code (binary-search range
   filtering, daily/diurnal trimming) can assume a regular axis.
4. **Algorithms are delegated, not reimplemented.** NowCast and stats come from
   `air-monitor-algorithms` so the scientific logic has a single home.
5. **`-1` sentinel for "no valid observation"** in `getCurrentStatus`, so a
   fully-empty series is distinguishable from one whose only valid value is at
   row 0 (a previously fixed bug). `filterByValue` similarly samples the first
   **non-null** value for type inference rather than row 0.

### Public API Contract

A breaking change (requires version bump + `NEWS.md` entry) is any change to:

- The `Monitor` class name or its construction signature `new Monitor(meta, data)`.
- Method names, parameter order/meaning, or return **shape/type** of:
  `loadLatest`, `loadDaily`, `loadAnnual`, `loadCustom`, `getIDs`, `count`,
  `getDatetime`, `getMetadata`, `getMetaObject`, `getTimezone`, `getPM25`,
  `getNowcast`, `getDailyStats`, `getDiurnalStats`, `collapse`, `combine`,
  `select`, `filterByValue`, `filterDatetime`, `dropEmpty`, `trimDate`,
  `getCurrentStatus`, `createGeoJSON`.
- Units or semantics of returned values (e.g. PM2.5 rounding to 1 decimal, the
  GeoJSON property names).

### Validation and Error Handling

| Condition | Behavior | Where |
|-----------|----------|-------|
| CSV load fails | Retry (`loadWithRetry`, default 2 attempts), then throw | `load.js` |
| `maxAttempts < 1` | Throw immediately (avoid silent `undefined`) | `load.js` |
| Non-UTC / non-hourly / gappy datetime, or non-numeric data | Throw with row context | `helpers.js: validateDataTable` |
| Unknown / malformed `deviceDeploymentID` | Throw with the offending value | `helpers.js: validateDeviceID` |
| Missing timezone for string/Date datetime, or invalid timezone | Throw | `helpers.js: parseDatetime` |
| `filterByValue` column missing / unsupported type | Throw | `transform.js` |
| `filterDatetime` inverted range | Throw | `transform.js` |
| `filterDatetime` no overlap | Return empty data table (same schema) | `transform.js` |
| Transform result not a `Monitor` | Throw via `assertIsMonitor` | `Monitor.js` |
| Fully-empty series in `getCurrentStatus` | Report `null` (via `-1` sentinel), not row 0 | `geojson.js` |

The house style is **fail loudly with context**, never silently. Follow it.

### Build and Distribution

- Bundler: **Rollup** (`rollup.config.js`). `npm run build` emits ESM
  (`dist/air-monitor.esm.js`) + UMD (`dist/air-monitor.umd.js`) with sourcemaps.
- `dist/` is committed and shipped; **do not hand-edit it**.
- Published to npm; `package.json` `files` = `dist`, `src`, `README.md`,
  `LICENSE`. Version in `package.json`, changelog in `NEWS.md`.

### Testing

- Framework: **UVU** (`npm test` runs `uvu tests`). 91 tests currently pass.
- Tests live in `tests/`, one file per area, with CSV fixtures `test_meta.csv` /
  `test_data.csv`. `interactive_tests.js` is a manual harness (no assertions).
- There is **no CI workflow** yet; tests run manually. New/changed behavior
  should add tests — the suite already carries regression tests for previously
  fixed bugs.

### Documentation

- Tool: **JSDoc** (`npm run docs`, config in `jsdoc.conf.json`), output to
  `docs/` (generated; do not hand-edit).
- Every public method and exported function carries JSDoc with `@param`,
  `@returns`, units, and `@throws`. `README.md` is the user-facing overview;
  `NEWS.md` is the changelog.

### Known Limitations and Future Work

- `internal_collapse` derives address-style metadata columns (`houseNumber`,
  `street`, `city`, `zip`) that may not exist in the input schema, so a collapsed
  monitor can have a wider `meta` schema than its inputs — relevant if later
  `combine`d.
