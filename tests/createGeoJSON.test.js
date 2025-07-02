// This test uses:
// - test.before(...) to load a Monitor instance from 'test.meta.csv' and 'test.data.csv'
// - a consistent layout for assert checks
// - standard ES module setup with __dirname and file:// URLs

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import path from 'path';
import { fileURLToPath } from 'url';
import Monitor from '../src/index.js';

// test.before.each(async () => {
test.before(async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const baseName = 'test';
  const baseUrl = `file://${path.resolve(__dirname)}`;

  monitor = new Monitor();
  await monitor.loadCustom(baseName, baseUrl);
});

let monitor;

test('createGeoJSON returns a FeatureCollection object', () => {
  const geojson = monitor.createGeoJSON();

  assert.ok(geojson, 'Returns an object');
  assert.is(geojson.type, 'FeatureCollection', 'Top-level type is FeatureCollection');
  assert.ok(Array.isArray(geojson.features), 'Features array is present');
});

test('each feature has valid geometry and properties', () => {
  const geojson = monitor.createGeoJSON();
  const features = geojson.features;

  for (const feature of features) {
    assert.is(feature.type, 'Feature', 'Feature has correct type');
    assert.ok(feature.geometry, 'Feature has geometry');
    assert.is(feature.geometry.type, 'Point', 'Geometry type is Point');
    assert.ok(Array.isArray(feature.geometry.coordinates), 'Coordinates are an array');
    assert.is(feature.geometry.coordinates.length, 2, 'Coordinates array has length 2');

    const [lng, lat] = feature.geometry.coordinates;
    assert.type(lng, 'number', 'Longitude is a number');
    assert.type(lat, 'number', 'Latitude is a number');

    const props = feature.properties;
    assert.ok(props, 'Feature has properties');
    assert.type(props.deviceDeploymentID, 'string', 'deviceDeploymentID is present');
    assert.type(props.locationName, 'string', 'locationName is present');
    assert.ok(
      props.last_time instanceof Date || props.last_time === null,
      'last_time is Date or null'
    );
    assert.ok(
      typeof props.last_pm25 === 'number' || props.last_pm25 === null,
      'last_pm25 is number or null'
    );
  }
});

test('number of features matches number of metadata rows', () => {
  const geojson = monitor.createGeoJSON();
  const nMeta = monitor.meta.numRows();
  assert.is(geojson.features.length, nMeta, 'Feature count matches metadata row count');
});
