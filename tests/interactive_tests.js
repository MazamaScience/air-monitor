import Monitor from "../src/index.js";

const monitor = new Monitor();

await monitor.loadLatest("airnow");

console.log(monitor.count());

let bop; // Generic variable for reuse

// await monitor.loadAnnual("2021");

// console.log(monitor.count());

let id = monitor.getIDs()[234];
let timezone = monitor.getTimezone(id);

console.log(`id: %s, timezone = %s`, id, timezone);

// const idsArray = monitor.getIDs();
// const ids = [idsArray[234], idsArray[512]];
// let sub = monitor.select(ids);
// sub.data.print();

// bop = monitor.dropEmpty();

let WA = monitor.filterByValue('stateCode', 'WA');
console.log(`WA has %d monitors`, WA.count());

let WA_trimmed = WA.trimDate("America/Los_Angeles");
let OR_trimmed = monitor
  .filterByValue('stateCode', 'OR')
  .trimDate("America/Los_Angeles");

console.log(`OR has %d monitors`, OR_trimmed.count());

let PNW = WA_trimmed.combine(OR_trimmed);

console.log(`PNW has %d monitors`, PNW.count());

// bop = PNW.combine(OR_trimmed); // This should drop the duplicate sites

// let OR_1 = OR_trimmed.collapse('mean')
// OR_1.data.print()

// let pm25 = monitor.getPM25(id);

// let nowcast = monitor.getNowcast(id);

// let daily = monitor.getDailyStats(id);

// let diurnal = monitor.getDiurnalStats(id);

let geojson = monitor.createGeoJSON();

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
