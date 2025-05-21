// js/demProcessor.js
import { MAX_POINTS_PER_CHUNK } from './constants.js';
/**
 * @file Contains logic for processing parsed DEM data, primarily for splitting large DEMs into smaller chunks.
 */

/**
 * Processes parsed DEM data. If the DEM is too large (exceeds MAX_POINTS_PER_CHUNK),
 * it splits the DEM into smaller, more manageable rectangular chunks.
 * Each chunk gets its own derived header (ncols, nrows, xllcorner, yllcorner) and elevation data.
 * @param {object} fullParsedData - The full parsed DEM data object from demParser.js 
 * ({ header, data, minElev, maxElev }).
 * @param {string} originalFileName - The original name of the file, used for naming chunks.
 * @returns {Array<object>} An array of objects. Each object represents a DEM (or chunk)
 * and contains {name: string, parsedData: object with {header, data, minElev, maxElev}}.
 * Returns an array with the original data if not split, or an empty array on error.
 */
export function processAndChunkDEM(fullParsedData, originalFileName) {
    if (!fullParsedData || !fullParsedData.header || !fullParsedData.data) {
        console.error(`[${originalFileName}] Invalid data provided to processAndChunkDEM.`);
        return []; // Return empty array if input is invalid
    }

    const { header: originalHeader, data: originalElevationData } = fullParsedData;
    const totalPoints = originalHeader.ncols * originalHeader.nrows;

    // If DEM is within size limits, return it as a single "chunk" (the original data)
    if (totalPoints <= MAX_POINTS_PER_CHUNK) {
        console.log(`[${originalFileName}] DEM is within size limit (${totalPoints} points). Not splitting.`);
        return [{ name: originalFileName, parsedData: fullParsedData }];
    }

    console.log(`[${originalFileName}] DEM is too large (${totalPoints} points). Attempting to split...`);
    // UIManager.setStatusMessage(`Splitting ${originalFileName} (large file)...`); // Caller can handle this

    const resultsArray = []; // To store data for each new chunk
    let numChunksX = 1; // Number of chunks along the X-axis (columns)
    let numChunksY = 1; // Number of chunks along the Y-axis (rows)

    // Determine how many chunks are needed in X and Y directions to meet MAX_POINTS_PER_CHUNK
    // This loop tries to find a good balance for chunk dimensions.
    while (true) {
        const currentChunkCols = Math.ceil(originalHeader.ncols / numChunksX);
        const currentChunkRows = Math.ceil(originalHeader.nrows / numChunksY);
        if (currentChunkCols * currentChunkRows <= MAX_POINTS_PER_CHUNK) {
            break; // Current chunk dimensions are acceptable
        }
        // Increment chunk count in the dimension that leads to squarer chunks (heuristic)
        // This tries to avoid very long, thin chunks if possible.
        if (numChunksX * originalHeader.nrows > numChunksY * originalHeader.ncols) {
            numChunksY++;
        } else {
            numChunksX++;
        }
        // Safety break: if splitting becomes excessively granular (e.g., more chunks than cells),
        // which shouldn't happen with a reasonable MAX_POINTS_PER_CHUNK.
        if (numChunksX > originalHeader.ncols && numChunksY > originalHeader.nrows) { 
            console.error(`[${originalFileName}] Cannot split DEM further to meet point limit. This might indicate an issue with MAX_POINTS_PER_CHUNK or very small DEM dimensions.`);
            return [{ name: originalFileName, parsedData: fullParsedData }]; // Fallback to original if splitting fails catastrophically
        }
    }
    console.log(`[${originalFileName}] Will be split into ${numChunksX}x${numChunksY} chunks.`);
    // UIManager.setStatusMessage(`Splitting ${originalFileName} into ${numChunksX * numChunksY} chunks...`);

    // Iterate through each conceptual chunk grid cell
    for (let cy = 0; cy < numChunksY; cy++) { // cy is the chunk's row index
        for (let cx = 0; cx < numChunksX; cx++) { // cx is the chunk's column index
            const chunkName = `${originalFileName}_part${cy}_${cx}`; // e.g., mydem.asc_part0_0
            
            // Calculate row and column boundaries for the current chunk within the original DEM data
            // Math.floor is used to ensure integer indices.
            const startRowOrig = Math.floor(cy * originalHeader.nrows / numChunksY);
            const endRowOrig = Math.floor((cy + 1) * originalHeader.nrows / numChunksY);
            const chunkNRows = endRowOrig - startRowOrig;

            const startColOrig = Math.floor(cx * originalHeader.ncols / numChunksX);
            const endColOrig = Math.floor((cx + 1) * originalHeader.ncols / numChunksX);
            const chunkNCols = endColOrig - startColOrig;

            // Skip if chunk dimensions are invalid (e.g., due to rounding on the last chunk if dimensions aren't perfectly divisible)
            if (chunkNCols <= 0 || chunkNRows <= 0) {
                console.warn(`[${originalFileName}] Skipping empty chunk at [${cy},${cx}].`);
                continue;
            }

            // Create a new header for this chunk
            const chunkHeader = { ...originalHeader }; // Start by copying the original header
            chunkHeader.ncols = chunkNCols;
            chunkHeader.nrows = chunkNRows;
            // Calculate xllcorner for the chunk based on its column position and original cellsize
            chunkHeader.xllcorner = originalHeader.xllcorner + (startColOrig * originalHeader.cellsize);
            // Calculate yllcorner for the chunk based on its row position (standard interpretation)
            // This assumes yllcorner is the bottom-left and rows are ordered top-to-bottom in the file.
            chunkHeader.yllcorner = originalHeader.yllcorner + ((originalHeader.nrows - endRowOrig) * originalHeader.cellsize); 
            
            console.log(`[${chunkName}] Chunk Header: ncols=${chunkNCols}, nrows=${chunkNRows}, xll=${chunkHeader.xllcorner.toFixed(2)}, yll=${chunkHeader.yllcorner.toFixed(2)}`);

            const chunkElevationData = []; // To store elevation data for this specific chunk
            let chunkMinElev = Infinity;
            let chunkMaxElev = -Infinity;
            let chunkValidPoints = 0;

            // Extract elevation data for the current chunk from the original full dataset
            for (let r = 0; r < chunkNRows; r++) {
                const originalRowIndex = startRowOrig + r; // Get the corresponding row index in the original data
                // Safety check, though floor logic above should prevent out-of-bounds
                if (originalRowIndex < 0 || originalRowIndex >= originalHeader.nrows) {
                    console.warn(`[${chunkName}] Original row index ${originalRowIndex} out of bounds during chunk data extraction.`);
                    continue; 
                }
                
                const originalRowData = originalElevationData[originalRowIndex];
                if (!originalRowData) {
                     console.warn(`[${chunkName}] Missing original row data at index ${originalRowIndex}.`);
                     chunkElevationData.push(new Array(chunkNCols).fill(chunkHeader.nodata_value));
                     continue;
                }
                // Extract the relevant columns for this chunk from the original row
                const newRow = originalRowData.slice(startColOrig, endColOrig); 
                chunkElevationData.push(newRow);

                // Calculate min/max elevation specifically for this chunk's data, respecting NODATA
                for (const val of newRow) {
                    if (val !== chunkHeader.nodata_value && !isNaN(val)) {
                        if (val < chunkMinElev) chunkMinElev = val;
                        if (val > chunkMaxElev) chunkMaxElev = val;
                        chunkValidPoints++;
                    }
                }
            }
            
            // Handle cases where the chunk might be all NODATA or have no valid points
            if (chunkValidPoints === 0) { 
                chunkMinElev = 0; // Default min/max if no valid data in chunk
                chunkMaxElev = 0; 
                console.warn(`[${chunkName}] No valid data points found in this chunk.`);
            }
            // Ensure minElev and maxElev are not Infinity if all data was NODATA
            if (chunkMinElev === Infinity) chunkMinElev = chunkHeader.nodata_value !== -Infinity ? chunkHeader.nodata_value : 0;
            if (chunkMaxElev === -Infinity) chunkMaxElev = chunkHeader.nodata_value !== Infinity ? chunkHeader.nodata_value : 0;

            // Add the processed chunk data to the results array
            resultsArray.push({ 
                name: chunkName, 
                parsedData: { 
                    header: chunkHeader, 
                    data: chunkElevationData, 
                    minElev: chunkMinElev, 
                    maxElev: chunkMaxElev 
                } 
            });
            console.log(`[${originalFileName}] Created chunk: ${chunkName} (${chunkNCols}x${chunkNRows}), MinElev: ${chunkMinElev.toFixed(2)}, MaxElev: ${chunkMaxElev.toFixed(2)}`);
        }
    }
    return resultsArray;
}
