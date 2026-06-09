# CLAUDE.md

## Project Overview

This project is `air-monitor`, a JavaScript library of utilities for working with
hourly air quality monitoring data, with a focus on small particulates (PM2.5).

Features:

- Published to npm as an ES module (with a UMD build for legacy consumers).
- Provides a compact data model built on two aligned **Arquero** tables:
  - `meta`: one row per device deployment (spatial metadata).
  - `data`: an hourly, UTC time-series table linked to `meta` by `deviceDeploymentID`.
- A single `Monitor` class exposes a chaining API for loading, filtering,
  collapsing, summarizing, and exporting monitoring data.
- Loads data from the USFS AirFire data archives or from custom CSV sources.
- Exports GeoJSON for use in interactive maps.
- Intended for scientific analysis and for use in data-driven web apps
  (including Svelte and Vue).

The primary goals of this project are:

- Reliability
- Correctness of scientific algorithms
- Maintainability
- Simplicity

This library is operational infrastructure for air quality analysis. Correctness
and robustness are more important than architectural sophistication.

---

## Known Preferences of the Maintainer

The maintainer values clarity, correctness, and long-term maintainability over
novelty or abstraction.

### General Philosophy

- Prefer simple, understandable code over clever solutions.
- Favor maintainability over optimization unless performance is a demonstrated problem.
- Prefer explicit code over metaprogramming or excessive abstraction.
- Small, incremental improvements are preferred over large rewrites.
- Existing working code should be respected and changed conservatively.
- Avoid introducing complexity unless there is a clear operational benefit.

### JavaScript Style

- Use modern ES6 JavaScript.
- Use ESM (`import` / `export`) syntax.
- Prefer async/await over promise chains.
- Prefer descriptive variable and function names.
- Prefer small functions with clear responsibilities.
- Avoid introducing dependencies unless they provide significant value.

### Documentation and Comments

- Write code for future maintainers.
- Include explanatory comments describing intent, not just implementation.
- Public methods should have clear JSDoc documentation (this project generates
  its docs from JSDoc).
- Operational scripts should have clear file-level descriptions and usage notes.
- Many consumers are scientists and operational staff who are not professional
  software engineers. Code readability and clear documentation are therefore
  especially important.

### Refactoring

- Do not propose architectural rewrites unless specifically requested.
- Preserve existing behavior unless a bug or design issue has been identified.
- When suggesting refactoring, explain the expected benefit.
- Prefer minimal diffs that are easy to review.
- Small improvements are generally preferred over large rewrites.

### Error Handling

- Failures should be detected and reported clearly.
- Avoid silent failures.
- Error messages should provide useful operational context (e.g. which method
  and which `deviceDeploymentID` was involved).
- Reliability is more important than elegance.

### Communication Style

- Explain recommendations before making substantial changes.
- Distinguish between required fixes and optional improvements.
- Identify risks and tradeoffs.
- Rank recommendations by priority.
- Do not assume a rewrite is desired.

---

## Project-Specific Constraints

### Code Organization

The public API lives in `src/Monitor.js`. Each public method is intentionally
thin and delegates to an `internal_*` function in `src/utils/`:

- `load.js` — data loading (`loadLatest`, `loadDaily`, `loadAnnual`, `loadCustom`)
- `analysis.js` — per-device extraction and statistics (PM2.5, NowCast, daily/diurnal)
- `transform.js` — reshaping (`collapse`, `combine`, `select`, `filterByValue`,
  `filterDatetime`, `dropEmpty`, `trimDate`)
- `geojson.js` — current status and GeoJSON export
- `parse.js` — CSV parsing
- `helpers.js` — validation utilities (`assertIsMonitor`, `validateDeviceID`)

When adding a method, preserve this pattern: keep the public method small and
well-documented, and put the implementation in the appropriate `utils` module.

### Immutability and the Monitor Contract

- Transformation methods return a **new** `Monitor` instance rather than mutating
  the existing one. Preserve this behavior.
- Both tables must stay aligned: every non-`datetime` column in `data` corresponds
  to a `deviceDeploymentID` row in `meta`. Use `assertIsMonitor()` to validate
  results of transformations.

### Date and Time Handling

- Use Luxon for all date and time operations.
- The `data.datetime` axis is stored in UTC and assumed to be a regular hourly
  axis with no gaps.
- Be explicit about timezones rather than relying on system defaults; many
  operations (e.g. `trimDate`, `filterDatetime`, daily/diurnal stats) are
  local-time and DST aware.
- Avoid mixing Luxon `DateTime` objects and native JavaScript `Date` objects.

### Data Model and External Interfaces

Be conservative when modifying:

- Core `meta` column names and the default `meta` schema in the `Monitor` constructor.
- Expected CSV input structure (`<baseName>_meta.csv`, `<baseName>_data.csv`).
- GeoJSON output structure.
- The set and signatures of public `Monitor` methods.

These interfaces are consumed by downstream systems, related packages, and web
apps. Preserve backward compatibility whenever practical, and note breaking
changes clearly.

### Missing Values

- A value is considered missing if it is `null`, `undefined`, `NaN`, or an invalid
  string such as `'NA'`. Non-`datetime` values should otherwise be finite numbers.
- Preserve the existing missing-value handling during parsing and transformation.

### Dependencies

- Core runtime dependencies are `arquero`, `luxon`, and `air-monitor-algorithms`.
  Scientific algorithms (NowCast, daily/diurnal stats) live in
  `air-monitor-algorithms`; prefer extending that package over re-implementing
  algorithms here.
- Avoid adding new dependencies unless they provide significant value.

---

## Build, Test, and Release

- **Build:** `npm run build` (rollup → `dist/air-monitor.esm.js` and
  `dist/air-monitor.umd.js`).
- **Test:** `npm test` (uvu over the `tests/` directory). Add or update tests for
  any behavior change; the test suite aims for full coverage of transformations.
- **Docs:** `npm run docs` (JSDoc → `docs/`).
- **Versioning:** use `npm version` after committing code changes, and record
  user-facing changes in `NEWS.md`.

---

## Review Expectations

When reviewing code:

1. Identify correctness issues (especially in time handling and table alignment).
2. Identify operational risks.
3. Identify documentation gaps.
4. Suggest low-risk improvements.

Prioritize recommendations in this order:

1. Correctness
2. Reliability
3. Maintainability
4. Readability
5. Performance

Performance optimizations should generally be proposed only after correctness and
maintainability concerns have been addressed.

Do not assume a rewrite is desired.
