// src/utils/status.js

import * as aq from 'arquero';
const op = aq.op;

export function internal_getCurrentStatus(monitor) {
  const data = monitor.data;
  const ids = monitor.meta.array('deviceDeploymentID');

  // Step 1: Add row index to data table (excluding datetime)
  const dataBrick = data
    .select(aq.not('datetime'))
    .derive({ index: () => op.row_number() - 1 });

  // Step 2: For each column, replace valid values with their row index
  const validIndexMap = {};
  for (const id of ids) {
    validIndexMap[id] = d => op.is_finite(d[id]) ? d.index : 0;
  }

  // Step 3: Roll up to find the max row index per column (i.e., last valid)
  const lastIndexObj = dataBrick
    .derive(validIndexMap)
    .rollup(Object.fromEntries(ids.map(id => [id, d => op.max(d[id])])))
    .object(0);

  // Step 4: Map indices to datetimes and PM2.5 values
  const datetimeArray = data.array('datetime');
  const lastValidDatetime = ids.map(id => datetimeArray[lastIndexObj[id]]);
  const lastValidPM_25 = ids.map(id => data.get(id, lastIndexObj[id]));

  // Step 5: Create additional columns
  const statusTable = aq.table({
    lastValidDatetime,
    lastValidPM_25,
  });

  // Step 6: Combine with existing metadata
  return monitor.meta.assign(statusTable);
}
