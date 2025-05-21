// js/constants.js

/**
 * Maximum number of points a DEM chunk can have before it's split into smaller pieces.
 * This helps manage memory and performance for very large DEM files.
 */
export const MAX_POINTS_PER_CHUNK = 10_000_000;

/**
 * Default NODATA value commonly used in ASCII Grid DEMs if not specified in the header.
 */
export const DEFAULT_NODATA_VALUE = -99;

/**
 * Default XLLCORNER value if not specified in the header.
 */
export const DEFAULT_XLLCORNER = 0;

/**
 * Default YLLCORNER value if not specified in the header.
 */
export const DEFAULT_YLLCORNER = 0;

/**
 * Default shading mode.
 */
export const DEFAULT_SHADING_MODE = 'default';

// Add any other global constants your application might need here.
// For example, API endpoints (though the Gemini one is constructed dynamically),
// default colors, or configuration settings.
