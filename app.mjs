// Test that we can work with a Monitor instance.
import Monitor from "./index.js";

const monitor = new Monitor();

monitor.loadLatest("airnow").then(() => {
  console.log("Loaded %d airnow monitors.", monitor.count());
});
