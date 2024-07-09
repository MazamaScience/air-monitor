import Monitor from "../src/index.js";

const monitor = new Monitor();

await monitor.loadLatest("airnow");

console.log(monitor.count());

// await monitor.loadAnnual("2021");

// console.log(monitor.count());

let id = monitor.getIDs()[234];

let daily = monitor.getDailyStats(id);

let diurnal = monitor.getDiurnalStats(id);

let geojson = monitor.createGeoJSON();

// -----

let airnow = new Monitor();
await airnow.loadLatest("airnow");

let airsis = new Monitor();
await airsis.loadLatest("airsis");

//let bop = new Monitor();
let bop = airnow.combine(airsis);

let z = 1;

// ----- Methow Valley Monitors ------------------------------------------------

// await monitor.loadCustom(
//   "PM2.5",
//   "https://airfire-data-exports.s3.us-west-2.amazonaws.com/community-smoke/v1/methow-valley/data/monitor"
// );

// monitor.meta.columnNames();

// let a = 1;

// let id = monitor.getIDs()[1];

// let daily = monitor.getDailyStats(id);

// let diurnal = monitor.getDiurnalStats(id);

// let geojson = monitor.createGeoJSON();

// let z = 1;

// ----- filterByValue ---------------------------------------------------------

// let WA = monitor.filterByValue("stateCode", "WA");

// let z = 1;

// ----- Methow Valley Sensors ------------------------------------------------

// await monitor.loadCustom(
//   "PM2.5",
//   "https://airfire-data-exports.s3.us-west-2.amazonaws.com/community-smoke/v1/methow-valley/data/sensor"
// );

// let a = monitor.filterByValue("HUC", "1702000805");

// let b = a.collapse("max", "max");

// let c = a.collapse("quantile_08", "quantile", 0.8);

// let z = 1;
