// js/demParser.js
import { DEFAULT_NODATA_VALUE, DEFAULT_XLLCORNER, DEFAULT_YLLCORNER } from './constants.js';

/**
 * @file Contains logic for parsing DEM file formats, starting with ASCII Grid.
 */

/**
 * Parses the full content of an ASCII Grid DEM file.
 * Extracts header information (ncols, nrows, xllcorner, yllcorner, cellsize, nodata_value)
 * and all elevation data points. Also calculates min/max elevation for the dataset.
 * @param {string} fileContent - The string content of the .asc file.
 * @param {string} fileNameForLogging - The name of the file, used for logging messages.
 * @returns {object|null} An object containing {header, data, minElev, maxElev} or null if parsing fails.
 */
export function parseASCIIGrid(fileContent, fileNameForLogging = "Unknown File") {
    try {
        console.log(`[${fileNameForLogging}] Starting ASCII Grid parsing.`);
        const lines = fileContent.split(/\r?\n/); // Split file content into an array of lines
        const header = {}; // Object to store parsed header values
        let dataStartIndex = 0; // Index in 'lines' array where the actual elevation data begins
        
        // Standard header keys expected in an ASCII Grid file
        const headerKeys = ["ncols", "nrows", "xllcorner", "yllcorner", "cellsize", "nodata_value"];

        // --- Parse Header Section ---
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim(); // Remove leading/trailing whitespace
            if (!line) continue; // Skip empty lines

            const parts = line.split(/\s+/); // Split line by one or more whitespace characters
            
            // Check if the first part of the line is a known header key
            if (parts.length >= 2 && headerKeys.includes(parts[0].toLowerCase())) {
                header[parts[0].toLowerCase()] = parseFloat(parts[1]); // Store the numeric value
            } else if (Object.keys(header).length >= headerKeys.length - 1 && parts.every(p => !isNaN(parseFloat(p)))) {
                // Heuristic: If most header keys are found (nodata_value might be missing)
                // AND the current line consists only of numbers, assume this is the start of the data section.
                dataStartIndex = i;
                console.log(`[${fileNameForLogging}] Header parsing complete. Data starts at line index ${dataStartIndex}.`);
                break; 
            }
            // Another heuristic: if after 10 lines, we haven't found at least 4 header keys, it's likely not a valid DEM.
            if (i > 10 && Object.keys(header).length < 4) {
                throw new Error("Invalid DEM header format (too few standard keys found after 10 lines).");
            }
            if (i === lines.length -1 && dataStartIndex === 0) { // Reached end of file without finding data start
                 throw new Error("Reached end of file without finding start of data section. Header might be incomplete or malformed.");
            }
        }

        // --- Validate Essential Header Fields ---
        const requiredKeys = ["ncols", "nrows", "cellsize"];
        for (const key of requiredKeys) {
            if (typeof header[key] !== 'number' || isNaN(header[key])) {
                throw new Error(`Missing or invalid required header field: '${key}'. Value found: '${header[key]}'.`);
            }
        }

        // --- Provide Defaults for Optional/Often Missing Header Fields ---
        if (typeof header["xllcorner"] !== 'number' || isNaN(header["xllcorner"])) {
            console.warn(`[${fileNameForLogging}] Missing or invalid 'xllcorner'. Using default: ${DEFAULT_XLLCORNER}.`);
            header["xllcorner"] = DEFAULT_XLLCORNER;
        }
        if (typeof header["yllcorner"] !== 'number' || isNaN(header["yllcorner"])) {
            console.warn(`[${fileNameForLogging}] Missing or invalid 'yllcorner'. Using default: ${DEFAULT_YLLCORNER}.`);
            header["yllcorner"] = DEFAULT_YLLCORNER;
        }
        if (typeof header["nodata_value"] !== 'number' || isNaN(header["nodata_value"])) {
            console.warn(`[${fileNameForLogging}] Missing or invalid 'nodata_value'. Using default: ${DEFAULT_NODATA_VALUE}.`);
            header["nodata_value"] = DEFAULT_NODATA_VALUE;
        }
        
        const ncols = Math.floor(header.ncols); 
        const nrows = Math.floor(header.nrows);
        const nodata_value = header.nodata_value; 
        const elevationData = []; // 2D array to store [row][col] elevation values
        let minElev = Infinity; 
        let maxElev = -Infinity; 
        let validDataPoints = 0; // Count of cells that are not NODATA

        // --- Parse Elevation Data Section ---
        console.log(`[${fileNameForLogging}] Parsing ${nrows} rows of elevation data...`);
        for (let i = 0; i < nrows; i++) {
            const lineIndex = dataStartIndex + i;
            if (lineIndex >= lines.length) { // Check if we've run out of lines in the file
                console.warn(`[${fileNameForLogging}] Expected ${nrows} data rows, but file ended prematurely at row ${i}. Filling remaining with NODATA.`);
                elevationData.push(new Array(ncols).fill(nodata_value));
                continue;
            }
            const line = lines[lineIndex];
            if (!line && i < nrows) { // Handle missing or empty data lines within the expected data block
                console.warn(`[${fileNameForLogging}] Missing data line for row ${i}. Filling with NODATA.`);
                elevationData.push(new Array(ncols).fill(nodata_value)); 
                continue; 
            }
            const values = line.trim().split(/\s+/).map(parseFloat);
            
            // Ensure each row has the correct number of columns, padding/truncating if necessary
            const rowToAdd = new Array(ncols).fill(nodata_value); 
            if (values.length !== ncols) {
                console.warn(`[${fileNameForLogging}] Row ${i} has ${values.length} values, expected ${ncols}. Adjusting row.`);
            }
            for(let k=0; k < Math.min(values.length, ncols); k++) {
                rowToAdd[k] = values[k];
            }
            elevationData.push(rowToAdd);

            // Calculate min/max elevation for the dataset, excluding NODATA values
            for (const val of rowToAdd) {
                if (val !== nodata_value && !isNaN(val)) {
                    if (val < minElev) minElev = val;
                    if (val > maxElev) maxElev = val;
                    validDataPoints++;
                }
            }
        }
        
        // Handle cases with no valid data points or if all data is NODATA
        if (validDataPoints === 0) { 
            minElev = 0; // Default min/max if no valid data
            maxElev = 0; 
            console.warn(`[${fileNameForLogging}] No valid data points found in the DEM (all NODATA or empty).`);
        }
        // Ensure minElev and maxElev are not Infinity if all data was NODATA but NODATA itself is not Infinity
        if (minElev === Infinity) minElev = nodata_value !== -Infinity ? nodata_value : 0;
        if (maxElev === -Infinity) maxElev = nodata_value !== Infinity ? nodata_value : 0;
        
        console.log(`[${fileNameForLogging}] Successfully parsed. Header:`, JSON.stringify(header), `MinElev: ${minElev}, MaxElev: ${maxElev}`);
        return { header, data: elevationData, minElev, maxElev };

    } catch (error) { 
        console.error(`ASCII Grid Parse Error (${fileNameForLogging}):`, error); 
        // Optionally, re-throw or notify UI manager: UIManager.setStatusMessage(`Parse Error...`, true);
        return null; // Return null to indicate failure
    }
}

// Future: Add parseGeoTIFF function here
// export async function parseGeoTIFF(fileObject, fileNameForLogging) { /* ... */ }
