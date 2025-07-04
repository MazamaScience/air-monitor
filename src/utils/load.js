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
import { DateTime } from 'luxon';

// ----- Constants -----------------------------------------------------------

const DEFAULT_URL = 'https://airfire-data-exports.s3.us-west-2.amazonaws.com/monitoring/v2';

/* Minimal set of metadata fields. */
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

/* Standard metadata fields used by most methods. */
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

/* Subset of fields used in annual summaries. */
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
 * Attempts to load a CSV file using aq.loadCSV(), retrying on failure.
 *
 * @async
 * @function loadWithRetry
 * @param {string} url - The URL of the CSV file to load.
 * @param {number} [maxAttempts=2] - The maximum number of attempts to try loading the file.
 * @returns {Promise<aq.Table>} A promise that resolves to an Arquero Table if loading succeeds.
 * @throws {Error} If all attempts to load the CSV fail.
 */
async function loadWithRetry(url, maxAttempts = 2) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await aq.loadCSV(url, {
        // IMPORTANT! Always parse any 'datetime' field as timezone-aware luxon DateTime.
        // IMPORTANT! Specifying "zone: 'UTC'" is only required in cases where
        // IMPORTANT! the time string may not end with 'Z'.
        parse: {
          datetime: (s) => DateTime.fromISO(s, { zone: 'UTC' }),
        },
      });
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw err;
      }
      console.warn(`Retrying (${attempt}/${maxAttempts}) for: ${url}`);
    }
  }
}

/**
 * Loads metadata and data CSVs for the specified provider and timespan,
 * and updates the given Monitor object in place.
 *
 * @note This is an internal function.
 * @async
 * @param {Monitor} monitor - The Monitor instance to populate.
 * @param {string} provider - One of "airnow", "airsis", or "wrcc".
 * @param {string} timespan - One of "latest" or "daily".
 * @param {string} archiveBaseUrl - Base URL to retrieve files from.
 */
async function providerLoad(monitor, provider, timespan, archiveBaseUrl) {
  const metaURL = `${archiveBaseUrl}/${timespan}/data/${provider}_PM2.5_${timespan}_meta.csv`;
  const dataURL = `${archiveBaseUrl}/${timespan}/data/${provider}_PM2.5_${timespan}_data.csv`;

  // Parallel download with retries
  const results = await Promise.allSettled([
    loadWithRetry(metaURL),
    loadWithRetry(dataURL),
  ]);

  // Destructure the individual result objects
  const [metaResult, dataResult] = results;

  // Check if both loads succeeded
  if (metaResult.status === 'fulfilled' && dataResult.status === 'fulfilled') {
    const metaCSV = metaResult.value;
    const dataCSV = dataResult.value;
    // Proceed with processing
    monitor.meta = parseMeta(metaCSV, false, coreMetadataNames);
    monitor.data = parseData(dataCSV);
  } else {
    // Something failed
    if (metaResult.status === 'rejected') {
      console.error('Failed to load meta CSV after retry:', metaResult.reason);
    }
    if (dataResult.status === 'rejected') {
      console.error('Failed to load data CSV after retry:', dataResult.reason);
    }
    throw new Error('Failed to load data from URL.');
  }
}

/**
 * Loads annual metadata and data CSVs for a given year and updates the
 * given Monitor object in place.
 *
 * @note This is an internal function.
 * @async
 * @param {Monitor} monitor - The Monitor instance to populate.
 * @param {string} year - Four-digit year string.
 * @param {string} archiveBaseUrl - Base URL to retrieve files from.
 */
async function providerLoadAnnual(monitor, year, archiveBaseUrl) {
  const metaURL = `${archiveBaseUrl}/airnow/${year}/data/airnow_PM2.5_${year}_meta.csv`;
  const dataURL = `${archiveBaseUrl}/airnow/${year}/data/airnow_PM2.5_${year}_data.csv`;

  // Parallel download with retries
  const results = await Promise.allSettled([
    loadWithRetry(metaURL),
    loadWithRetry(dataURL),
  ]);

  // Destructure the individual result objects
  const [metaResult, dataResult] = results;

  // Check if both loads succeeded
  if (metaResult.status === 'fulfilled' && dataResult.status === 'fulfilled') {
    const metaCSV = metaResult.value;
    const dataCSV = dataResult.value;
    // Proceed with processing
    monitor.meta = parseMeta(metaCSV, false, annual_coreMetadataNames);
    monitor.data = parseData(dataCSV);
  } else {
    // Something failed
    if (metaResult.status === 'rejected') {
      console.error('Failed to load meta CSV after retry:', metaResult.reason);
    }
    if (dataResult.status === 'rejected') {
      console.error('Failed to load data CSV after retry:', dataResult.reason);
    }
    throw new Error('Failed to load data from URL.');
  }
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
 * @async
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

/**
 * Asynchronously loads 'daily' Monitor objects from USFS AirFire repositories
 * for 'airnow', 'airsis' or 'wrcc' data.
 *
 * This function replaces the 'meta' and 'data' properties of the Monitor
 * object with the latest available data. Data cover the most recent 45 days
 * and are updated once per day around 10:00 UTC (2am US Pacific Time).
 *
 * @async
 * @param {Monitor} monitor - Monitor object.
 * @param {string} provider - One of "airnow|airsis|wrcc".
 * @param {string} baseUrl - Base URL for monitoring v2 data files.
 * @returns {Promise<void>} Resolves when the monitor's .meta and .data fields have been populated.
 * @throws {Error} If there's an issue loading the data.
 */
export async function internal_loadDaily(monitor, provider = 'airnow', baseUrl = DEFAULT_URL) {
  return providerLoad(monitor, provider, 'daily', baseUrl);
}

/**
 * Asynchronously loads 'annual' Monitor objects from USFS AirFire repositories
 * for 'airnow', 'airsis' or 'wrcc' data.
 *
 * This function replaces the 'meta' and 'data' properties of the Monitor
 * object with the latest available data. Data cover an entire year or
 * year-to-date. Current year data are updated daily.
 *
 * @async
 * @param {Monitor} monitor - Monitor object.
 * @param {string} year - Year of interest.
 * @param {string} baseUrl - Base URL for monitoring v2 data files.
 * @returns {Promise<void>} Resolves when the monitor's .meta and .data fields have been populated.
 * @throws {Error} If there's an issue loading the data.
 */
export async function internal_loadAnnual(monitor, year = String(new Date().getFullYear()), baseUrl = DEFAULT_URL) {
  return providerLoadAnnual(monitor, year, baseUrl);
}

/**
 * Asynchronously loads custom monitoring data.
 *
 * Two files will be loaded from <baseUrl>:
 *   1. <baseName>_data.csv
 *   2. <baseName>_meta.csv
 *
 * @async
 * @param {Monitor} monitor - Monitor object.
 * @param {string} baseName - File name base.
 * @param {string} baseUrl - URL path under which data files are found.
 * @param {boolean} useAllColumns - Whether to retain all available columns in the metadata.
 * @returns {Promise<void>} Resolves when the monitor's .meta and .data fields have been populated.
 * @throws {Error} If there's an issue loading the data.
 */
export async function internal_loadCustom(monitor, baseName = '', baseUrl = '', useAllColumns = true) {
  const metaURL = `${baseUrl}/${baseName}_meta.csv`;
  const dataURL = `${baseUrl}/${baseName}_data.csv`;

  // Parallel download with retries
  const results = await Promise.allSettled([
    loadWithRetry(metaURL),
    loadWithRetry(dataURL),
  ]);

  // Destructure the individual result objects
  const [metaResult, dataResult] = results;

  // Check if both loads succeeded
  if (metaResult.status === 'fulfilled' && dataResult.status === 'fulfilled') {
    const metaCSV = metaResult.value;
    const dataCSV = dataResult.value;
    // Proceed with processing
    monitor.meta = parseMeta(metaCSV, useAllColumns);
    monitor.data = parseData(dataCSV);
  } else {
    // Something failed
    if (metaResult.status === 'rejected') {
      console.error('Failed to load meta CSV after retry:', metaResult.reason);
    }
    if (dataResult.status === 'rejected') {
      console.error('Failed to load data CSV after retry:', dataResult.reason);
    }
    throw new Error('Failed to load data from URL.');
  }
}

