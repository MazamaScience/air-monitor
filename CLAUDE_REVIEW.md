# CLAUDE_REVIEW.md
# Project Review & Improvement Suggestions — air-monitor

**Date:** 2026-06-09
**Scope:** Review of current design, identification of correctness/risk issues,
a prioritized list of low-risk improvements, and a proposed fix for the one
confirmed bug. Generated from the `review-project.md`, `suggest-improvements.md`,
and `propose-fix.md` prompts.

> Status: review only. No source files have been modified. The proposed fix in
> Section 3 is awaiting maintainer approval.

---

## 1. Project Review

### Design Summary

**Purpose.** `air-monitor` is a JavaScript library providing a compact in-memory
data model (the `Monitor` class) for hourly air quality monitoring data, focused
on PM2.5. It loads CSVs, transforms/summarizes/exports them, and hands back
arrays, plain objects, GeoJSON, or new `Monitor` instances. Scientific algorithms
themselves are delegated to the companion `air-monitor-algorithms` package.

**Structure & responsibilities (`src/`):**

| Module                  | Responsibility |
|-------------------------|----------------|
| `index.js`              | The only export surface; exposes `Monitor` as both default and named export. |
| `Monitor.js`            | The `Monitor` class. Thin, JSDoc-documented methods that delegate to `internal_*` functions. Holds two aligned Arquero tables: `meta` + `data`. |
| `utils/load.js`         | Remote/custom CSV loaders (`loadLatest/Daily/Annual/Custom`); parallel fetch with retry (`Promise.allSettled` + `loadWithRetry`). |
| `utils/parse.js`        | CSV cleaning (`'NA'`→null, float parse, negatives→0, non-finite→null) and the `validateDataTable` structural gate. |
| `utils/analysis.js`     | Per-device extraction/stats (`getPM25`, `getNowcast`, daily/diurnal); delegates algorithms to `air-monitor-algorithms`. |
| `utils/transform.js`    | Reshaping (`collapse`, `combine`, `select`, `filterByValue`, `filterDatetime`, `dropEmpty`, `trimDate`). |
| `utils/geojson.js`      | Current-status computation and GeoJSON `FeatureCollection` export. |
| `utils/helpers.js`      | Shared primitives: `arrayMean`, `round1`, `validateDeviceID`, `assertIsMonitor`, `validateDataTable`, `parseDatetime`. |

**Execution flow / data movement.** `new Monitor()` → `await load*()` (populates
`meta`/`data` **in place** via `parseMeta`/`parseData`) → chained transformations
(each returns a **new** `Monitor`) → terminal accessors (`getPM25`,
`getDailyStats`, `createGeoJSON`, …). Internally: CSV → Arquero table → cleaning →
`validateDataTable` (UTC/hourly/gap-free) → transform (mostly via `round1`) →
output.

**External dependencies.** Runtime: `arquero` 7.2.1, `luxon` 3.6.1,
`air-monitor-algorithms`. Data source (HTTP, load-time only): the USFS AirFire S3
archive. Dev tooling: `rollup` (+ plugins), `uvu`. Build emits ESM + UMD bundles
to `dist/`.

**Assumptions / constraints.** `data.datetime` is a Luxon `DateTime`, UTC, sorted,
strictly hourly, gap-free; non-datetime values are finite numbers or `null`;
`deviceDeploymentID` is unique and is the join key; negative measurements are
clamped to `0` (a PM2.5 domain rule); local time is requested via explicit IANA
`timezone`.

### Findings by Priority

#### 🔴 High — Correctness

**H1. `filterByValue` infers the column type from row 0 only, so a `null` first
row makes filtering throw.** `src/utils/transform.js:214` does
`const colType = typeof monitor.meta.get(columnName);`. Arquero's `.get(name)`
defaults to **row 0**, and `typeof null === 'object'`, which matches neither the
`'number'` nor `'string'` branch and falls through to the `else` that throws
`Unsupported column type for filtering`. This fails even when every other row in
the column is valid. Confirmed by repro:

```
typeof meta.get("countyName") => object
THROWS: Unsupported column type for filtering: object
countyName array => [ null, 'King', 'Pierce' ]
```

This bites real metadata: optional columns such as `countyName`, `AQSID`, or
`fullAQSID` are routinely `null`, and row order is not guaranteed. Existing tests
miss it because the fixture's first row is populated. Detailed fix in Section 3.

**H2. `getCurrentStatus` reports a false "last valid" status for fully-empty
series.** `src/utils/geojson.js:33` maps invalid values to index `0`
(`op.is_finite(...) ? d.index : 0`), then takes the per-column `max` index. A
series with **no** valid observations yields `max === 0`, so the code reads row 0's
datetime/value and reports them as the most recent valid status instead of `null`.
That false status then propagates into `createGeoJSON` output (maps/dashboards).

**H3. `loadWithRetry` can silently resolve to `undefined`.**
`src/utils/load.js:90` returns inside a `while (attempt < maxAttempts)` loop and
throws only on the final failed attempt. If called with `maxAttempts <= 0` the
loop never runs and the function returns `undefined`, which then flows into
`parseMeta`/`parseData` as a non-table. Defaults (`2`) avoid this today, but there
is no guard.

#### 🟠 Medium

- **M1. Loader duplication.** `providerLoad`, `providerLoadAnnual`, and
  `internal_loadCustom` repeat the same ~25-line allSettled / destructure / log /
  throw block. Extractable into one helper.
- **M2. Mixed Arquero expression styles.** Some code builds string expressions
  with manual column-name interpolation (`parse.js`, `geojson.js`), others use
  `aq.escape` / function form. String interpolation of column names is brittle
  (breaks on names containing quotes) and harder to read.
- **M3. `internal_getDiurnalStats` skips `validateDeviceID`.** It calls
  `internal_getPM25`/`internal_getTimezone` directly, so its error messages are
  less consistent than the sibling `getDailyStats`.
- **M4. `collapse` ships placeholder identifiers.** `locationID = "xxx"` and
  `deviceDeploymentID = "xxx_<id>"` (with a `TODO` for a geohash) mean collapsed
  monitors carry non-meaningful IDs.

#### 🟡 Low / Documentation

- **L1.** README omits `filterDatetime` (added in 1.2.4) and the dual default/named
  export (1.2.3).
- **L2.** The negative→0 clamping in `parseData` is a real scientific decision but
  is undocumented in the README / public API.
- **L3.** `createGeoJSON` emits only 4 properties; the richer set (nowcast,
  latency, yesterday average, local timestamp) is stubbed in comments.
- **L4.** The public `trimDate` hardcodes `trimEmptyDays = true`; the internal
  function already supports `false` but the option isn't exposed.
- **L5.** No `.d.ts` types; typed consumers rely on JSDoc only.

The architecture is sound; no rewrite is warranted. The modular delegation pattern
(public method → `internal_*`) is working well.

---

## 2. Improvement Suggestions

Ten small, low-risk tasks, favoring reliability / clarity / docs / maintenance:

| #  | Title | Why valuable | Effort | Risk |
|----|-------|--------------|--------|------|
| **1** DONE  | Fix `filterByValue` null-first-row type inference (H1) | Eliminates a data-dependent crash in a core, frequently-chained method | Small | Low |
| **2** DONE  | Add regression test for an all-null / null-first metadata column | Locks in the H1 fix; current fixtures never hit it | Small | Low |
| **3** DONE  | Correct `getCurrentStatus` for fully-empty series (H2) | Prevents false "last valid" status leaking into GeoJSON/maps | Small | Low |
| 4  | Guard `loadWithRetry` against returning `undefined` (H3) | Turns a silent bad-state into a clear error | Small | Low |
| 5  | Route `getDiurnalStats` through `validateDeviceID` (M3) | Consistent, clearer error messages across analysis fns | Small | Low |
| 6  | Extract a shared loader helper (M1) | Removes ~3× duplicated allSettled/log/throw blocks | Medium | Low |
| 7  | Document the negative→0 clamping in README + JSDoc (L2) | Surfaces a real scientific decision currently hidden in `parse.js` | Small | Low |
| 8  | Add README coverage for `filterDatetime` + dual export (L1) | Docs lag two releases behind the API | Small | Low |
| 9  | Introduce a minimal injectable logger for loaders | Makes load failures testable and silenceable in apps | Medium | Low |
| 10 | Replace string-interpolated Arquero exprs with `aq.escape`/fn form (M2) | Hardens against unusual column names; improves readability | Medium | Medium |

Suggested sequence: 1 → 2 → 3 → 4 (correctness + lock-in), then 7/8/5 (docs +
consistency), then 6/9/10 (maintainability).

---

## 3. Proposed Fix for H1

> No files have been modified. Awaiting maintainer approval.

**1. The issue & why it matters.** `filterByValue(column, value)` is a core,
frequently-chained method. It throws `Unsupported column type for filtering:
object` whenever `meta` row 0 holds `null` in the requested column — even though
the filter could succeed on the remaining rows. Optional metadata columns
(`countyName`, `AQSID`, …) are routinely null and row order is not guaranteed, so
this is a latent, data-dependent failure.

**2. Root cause.**

```js
// src/utils/transform.js:214
const colType = typeof monitor.meta.get(columnName);
```

Arquero's `Table.get(name)` returns the value at **row 0**. When that value is
`null`, `typeof null === 'object'`, which matches neither the `'number'` nor
`'string'` branch and falls through to the `else` that throws (lines 217–228).

**3. Smallest reasonable fix.** Determine the column type from the **first
non-null value** in the column rather than from row 0:

```js
const colArray = monitor.meta.array(columnName);
const sample = colArray.find(v => v !== null && v !== undefined);
const colType = typeof sample;
```

If every value is null (`sample === undefined` → `colType === 'undefined'`), keep
the existing `else` throw — filtering an all-null column has no meaningful match,
and the error message is then accurate.

**4. Why preferable.** Minimal, localized 2–3 line change that preserves the
existing number/string branches and all downstream logic. Alternatives are
riskier: inferring type from the `value` argument wouldn't reflect the stored
column type (the argument is always a caller-supplied string/number), and coercion
could silently change matching semantics.

**5. Risks / edge cases / operational impact.** Very low. (a) All-null column →
still throws, now with an accurate message (could instead return an empty monitor
if preferred — maintainer's call). (b) Mixed-type columns (shouldn't occur
post-parse) resolve to the first non-null's type, matching today's intent.
(c) `meta.array()` is O(n), but metadata tables are small. No change to the public
signature or return type; existing tests stay green.

**6. Files to modify.**

- `src/utils/transform.js` (the fix)
- `tests/filterByValue.test.js` (regression test for a null-first / all-null
  column)
- `dist/*` would only change on the next `npm run build` — not edited by hand.
