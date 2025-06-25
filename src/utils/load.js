/**
 * Utility functions for loading air quality monitoring data into Monitor objects.
 *
 * This module provides internal asynchronous functions that populate a Monitor
 * instance’s `meta` and `data` tables by loading remote CSVs from the USFS
 * AirFire repository or a custom user-supplied location. It includes loaders
 * for:
 * - `latest`: recent 10-day window (updated frequently)
 * - `daily`: rolling 45-day archive (updated daily)
 * - `annual`: year-to-date or historical year summaries
 * - `custom`: user-supplied paired metadata and data files
 */

import * as aq from 'arquero';
import { parseMeta, parseData } from './parse.js';

// ----- Constants -----------------------------------------------------------

const DEFAULT_URL = 'https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2';

/** @type {string[]} Minimal set of metadata fields. */
const minimalMetadataNames = [
  'deviceDeploymentID',
  'locationName',
  'longitude',
  'latitude',
  'elevation',
  'countryCode',
  'stateCode',
  'timezone',
];

/** @type {string[]} Standard metadata fields used by most methods. */
const coreMetadataNames = [
  'deviceDeploymentID',
  'deviceID',
  'deviceType',
  'deploymentType',
  'deviceDescription',
  'pollutant',
  'units',
  'dataIngestSource',
  'locationID',
  'locationName',
  'longitude',
  'latitude',
  'elevation',
  'countryCode',
  'stateCode',
  'countyName',
  'timezone',
  'AQSID',
  'fullAQSID',
];

/** @type {string[]} Subset of fields used in annual summaries. */
const annual_coreMetadataNames = [
  'deviceDeploymentID',
  'deviceID',
  'deviceType',
  'deviceDescription',
  'pollutant',
  'units',
  'dataIngestSource',
  'locationID',
  'locationName',
  'longitude',
  'latitude',
  'elevation',
  'countryCode',
  'stateCode',
  'countyName',
  'timezone',
  'AQSID',
];

// ----- Helper functions ------------------------------------------------------

/**
 * Loads metadata and data CSVs for the specified provider and timespan,
 * and updates the given Monitor object in place.
 *
 * @note This is an internal function.
 * @param {Monitor} monitor - The Monitor instance to populate.
 * @param {string} provider - One of "airnow", "airsis", or "wrcc".
 * @param {string} timespan - One of "latest" or "daily".
 * @param {string} archiveBaseUrl - Base URL to retrieve files from.
 */
async function providerLoad(monitor, provider, timespan, archiveBaseUrl) {
  const metaURL = `${archiveBaseUrl}/${timespan}/data/${provider}_PM2.5_${timespan}_meta.csv`;
  const dataURL = `${archiveBaseUrl}/${timespan}/data/${provider}_PM2.5_${timespan}_data.csv`;

  const [metaCSV, dataCSV] = await Promise.all([
    aq.loadCSV(metaURL),
    aq.loadCSV(dataURL),
  ]);

  monitor.meta = parseMeta(metaCSV, false, coreMetadataNames);
  monitor.data = parseData(dataCSV);
}

// ----- Public API ------------------------------------------------------------

/**
 * Asynchronously loads 'latest' Monitor objects from USFS AirFire repositories
 * for 'airnow', 'airsis' or 'wrcc' data.
 *
 * This function replaces the 'meta' and 'data' properties of the Monitor
 * object with the latest available data. Data cover the most recent 10 days
 * and are updated every few minutes.
 *
* @param {Monitor} monitor - Monitor object.
 * @param {string} provider - One of "airnow|airsis|wrcc"
 * @param {string} baseUrl - Base URL for monitoring v2 data files.
 * @returns {Promise<void>} Resolves when the monitor's .meta and .data fields have been populated.
 * @throws {Error} If there's an issue loading the data.
 * @example
 * await internal_loadLatest(monitor, 'airnow'); * @async
 */
export async function internal_loadLatest(monitor, provider = 'airnow', baseUrl = DEFAULT_URL) {
  return providerLoad(monitor, provider, 'latest', baseUrl);
}

