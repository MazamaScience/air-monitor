import Monitor from "../src/index.js";

const monitor = new Monitor();

await monitor.loadLatest("airnow");

console.log(monitor.count());

await monitor.loadAnnual("2021");

console.log(monitor.count());

let id = monitor.getIDs()[234];

let daily = monitor.getDailyStats(id);

let diurnal = monitor.getDiurnalStats(id);

let geojson = monitor.createGeoJSON();

let z = 1;
