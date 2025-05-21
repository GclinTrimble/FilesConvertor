// js/utils.js

/**
 * @file Contains general utility or helper functions that can be used across different modules.
 */

/**
 * Example utility function (currently not used by the main application).
 * Generates a simple unique ID.
 * @param {string} [prefix='id-'] - A prefix for the ID.
 * @returns {string} A unique ID string.
 */
export function generateUniqueId(prefix = 'id-') {
    return prefix + Math.random().toString(36).substr(2, 9);
}

// Add other general utility functions here as needed.
// For instance, functions for:
// - Debouncing or throttling event handlers
// - Formatting numbers or dates
// - Complex geometric calculations not specific to Three.js
// - etc.
