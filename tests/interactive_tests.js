// ----- README.md example -----------------------------------------------------

// import Monitor from 'air-monitor';
// const monitor = new Monitor();
// await monitor.loadLatest("airnow");
// console.log(`airnow has ${monitor.count()} monitors`);

// // Filter to a single state
// const wa = monitor.filterByValue('stateCode', 'WA');
// console.log(`washington has ${wa.count()} monitors`);

// const id = wa
// .filterByValue('locationName', 'Entiat')
// .getIDs();
// const pm25 = wa.getPM25(id);
// const meta = wa.getMetaObject(id);

// console.log(pm25);
// console.log(JSON.stringify(meta, null, 2));

// ----- test subset -----------------------------------------------------------

// import Monitor from "../src/index.js";
// const monitor = new Monitor();
// await monitor.loadLatest("airnow");

// const WA = monitor.filterByValue('stateCode', 'WA');
// console.log(`WA has %d monitors`, WA.count());
// const WA_meta = WA.meta;
// const WA_data = WA.data;

// import fs from 'fs';

// // Export `meta` and `data` to a JSON file
// fs.writeFileSync(
//   './tests/WA_test_data.json',
//   JSON.stringify({ WA_meta, WA_data }, null, 2)
// );

// // -----------------------------------------------------------------------------

import Monitor from "../src/index.js";
const monitor = new Monitor();

// await monitor.loadLatest("airnow");
// console.log(monitor.count());

// let trimmed = monitor.trimDate("America/Los_Angeles")


// let bop; // Generic variable for reuse

// // // await monitor.loadAnnual("2021");

// // console.log(monitor.count());

// let id = monitor.getIDs()[234];
// let timezone = monitor.getTimezone(id);

// console.log(`id: %s, timezone = %s`, id, timezone);

// const idsArray = monitor.getIDs();
// const ids = [idsArray[234], idsArray[512]];
// let sub = monitor.select(ids);
// sub.data.print();

// bop = monitor.dropEmpty();

// let WA_trimmed = monitor
//   .filterByValue('stateCode', 'WA')
//   .trimDate("America/Los_Angeles");

// let OR_trimmed = monitor
//   .filterByValue('stateCode', 'OR')
//   .trimDate("America/Los_Angeles");

// console.log(`OR has %d monitors`, OR_trimmed.count());

// let PNW = WA_trimmed.combine(OR_trimmed);

// console.log(`PNW has %d monitors`, PNW.count());

// bop = PNW.combine(OR_trimmed); // This should drop the duplicate sites

// let OR_1 = OR_trimmed.collapse('mean')
// OR_1.data.print()

// let pm25 = monitor.getPM25(id);

// let nowcast = monitor.getNowcast(id);

// let daily = monitor.getDailyStats(id);

// let diurnal = monitor.getDiurnalStats(id);

// let geojson = monitor.createGeoJSON();

// ----- Methow Valley Monitors ------------------------------------------------

await monitor.loadCustom(
  "PM2.5",
  "https://airfire-data-exports.s3.us-west-2.amazonaws.com/community-smoke/v1/methow-valley/data/monitor"
);

console.log(monitor.meta.array('locationName'));

// ----- Methow Valley Sensors ------------------------------------------------

await monitor.loadCustom(
  "PM2.5",
  "https://airfire-data-exports.s3.us-west-2.amazonaws.com/community-smoke/v1/methow-valley/data/sensor"
);

let huc = monitor.filterByValue("HUC", "1702000805");
huc.data.print();

let huc_max = huc.collapse("max", "max");
huc_max.data.print();

let huc_quantile = huc.collapse("quantile_08", "quantile", 0.8);
huc_quantile.data.print();

let z = 1;