import Monitor from "./index.js";

const monitor = new Monitor();

await monitor.loadLatest("airnow");

console.log(monitor.count());

let id = monitor.getIDs()[234];

let daily = monitor.getDailyAverageObject(id);

let diurnal = monitor.getDiurnalAverageObject(id);

let z = 1;
