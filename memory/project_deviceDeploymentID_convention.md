---
name: project_deviceDeploymentID_convention
description: Convention for constructing deviceDeploymentID as deviceID + '_' + locationID, a very strong preference close to a contract
metadata:
  type: project
---

`deviceDeploymentID` should be constructed as `{deviceID}_{locationID}`.

**Why:** This is the existing convention in the real-world data (e.g., `1b9c1ccb7dc266b8_840490353010` where `1b9c1ccb7dc266b8` is the locationID geohash and `840490353010` is the deviceID). The maintainer treats this as a very strong preference, close to a contract. Deviating from it (e.g., using a bare `deviceID` or `"xxx"`) would produce IDs that don't match what downstream consumers and human users expect.

**How to apply:** Any time code creates or derives a `deviceDeploymentID` — in `internal_collapse`, any future synthetic monitor construction, or any data reshaping that produces a new series — use `${deviceID}_${locationID}` as the ID. For `internal_collapse`, `locationID` is a 10-character geohash of the mean lat/lon (via `latlon-geohash`). Never hardcode a placeholder like `"xxx"` or reuse a bare `deviceID` as the `deviceDeploymentID`.
