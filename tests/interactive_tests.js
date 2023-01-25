import Monitor from "../src/index.js";

const monitor = new Monitor();

await monitor.loadLatest("airnow");

console.log(monitor.count());

let id = monitor.getIDs()[234];

let daily = monitor.getDailyAverage(id);

let diurnal = monitor.getDiurnalAverage(id);

let geojson = monitor.createGeoJSON();

let z = 1;
