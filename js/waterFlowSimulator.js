// js/waterFlowSimulator.js
import * as THREE from 'three';
import { state } from './appState.js'; // Import state to access firstDemAbsoluteOrigin

/**
 * @file Contains logic for simulating water flow, starting with a single raindrop path.
 */

const MAX_PATH_STEPS = 2000; // Maximum steps for a single raindrop path to prevent infinite loops

/**
 * Converts world coordinates (from raycaster, relative to scene origin) to grid cell (column, row) 
 * indices for a given DEM chunk.
 * @param {THREE.Vector3} sceneWorldPoint - The point in "scene world" coordinates.
 * @param {object} demHeader - The header object of the DEM chunk (contains absolute geographic xllcorner, yllcorner, cellsize, etc.).
 * @returns {{col: number, row: number}|null} Object with col and row, or null if outside DEM bounds or error.
 */
function worldToGrid(sceneWorldPoint, demHeader) {
    if (!demHeader || typeof demHeader.cellsize !== 'number' || demHeader.cellsize <= 0) {
        console.error("[WaterSim-worldToGrid] Invalid demHeader or cellsize provided:", demHeader);
        return null;
    }
    if (state.firstDemAbsoluteOrigin.x === null || state.firstDemAbsoluteOrigin.y === null) {
        console.error("[WaterSim-worldToGrid] firstDemAbsoluteOrigin is not set. Cannot convert coordinates.");
        return null;
    }

    const absGeoClickX = sceneWorldPoint.x + state.firstDemAbsoluteOrigin.x;
    const absGeoClickY = sceneWorldPoint.y + state.firstDemAbsoluteOrigin.y;
    const planeWidth = (demHeader.ncols - 1) * demHeader.cellsize;
    const planeHeight = (demHeader.nrows - 1) * demHeader.cellsize;
    const chunkGeoExtentBottomLeftX = demHeader.xllcorner - (planeWidth / 2);
    const chunkGeoExtentBottomLeftY = demHeader.yllcorner - (planeHeight / 2);
    const xRelativeToChunkBLExtent = absGeoClickX - chunkGeoExtentBottomLeftX;
    const yRelativeToChunkBLExtent = absGeoClickY - chunkGeoExtentBottomLeftY;
    let col = Math.floor(xRelativeToChunkBLExtent / demHeader.cellsize);
    let row = Math.floor(yRelativeToChunkBLExtent / demHeader.cellsize); 

    // console.log(`[WaterSim-worldToGrid] Input SceneClick: (${sceneWorldPoint.x.toFixed(2)}, ${sceneWorldPoint.y.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] firstDemAbsoluteOrigin: (${state.firstDemAbsoluteOrigin.x?.toFixed(2)}, ${state.firstDemAbsoluteOrigin.y?.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] -> AbsoluteGeoClick: (${absGeoClickX.toFixed(2)}, ${absGeoClickY.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] DEM Chunk Header: ncols=${demHeader.ncols}, nrows=${demHeader.nrows}, cellsize=${demHeader.cellsize.toFixed(4)}, xll=${demHeader.xllcorner.toFixed(2)}, yll=${demHeader.yllcorner.toFixed(2)}`);
    // console.log(`[WaterSim-worldToGrid] PlaneGeom W/H: (${planeWidth.toFixed(2)}, ${planeHeight.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] ChunkGeoExtentBL: (${chunkGeoExtentBottomLeftX.toFixed(2)}, ${chunkGeoExtentBottomLeftY.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] -> RelToChunkBLExtent: (${xRelativeToChunkBLExtent.toFixed(2)}, ${yRelativeToChunkBLExtent.toFixed(2)})`);
    // console.log(`[WaterSim-worldToGrid] -> Calculated Grid (col, row): (${col}, ${row})`);

    const isColLessThanZero = col < 0;
    const isColGTEQNCols = col >= demHeader.ncols; 
    const isRowLessThanZero = row < 0;
    const isRowGTEQNRows = row >= demHeader.nrows; 

    if (isColLessThanZero || isColGTEQNCols || isRowLessThanZero || isRowGTEQNRows) {
        // console.warn(
        //     `[WaterSim-worldToGrid] Calculated grid position (${col}, ${row}) is OUTSIDE DEM chunk bounds ` +
        //     `(ncols: ${demHeader.ncols}, nrows: ${demHeader.nrows}).`
        // );
        return null;
    }
    return { col, row };
}


/**
 * Gets the elevation at a specific grid cell (col, row) of a DEM.
 * @param {number} col - Column index.
 * @param {number} row - Row index (0-indexed from bottom).
 * @param {object} demData - The demData object {header, data, minElev, maxElev}.
 * @returns {number|null} Elevation value, or null if out of bounds or NODATA.
 */
function getElevationAtGrid(col, row, demData) {
    if (row < 0 || row >= demData.header.nrows || col < 0 || col >= demData.header.ncols) {
        return null; 
    }
    const elevation = demData.data[row]?.[col]; 
    if (elevation === undefined || elevation === null || elevation === demData.header.nodata_value || isNaN(elevation)) {
        return null; 
    }
    return elevation;
}

/**
 * Converts grid cell (column, row) indices of a specific DEM chunk back to 
 * "scene world" X, Y, Z coordinates (relative to firstDemAbsoluteOrigin).
 * These coordinates are for the CENTER of the specified grid cell.
 * @param {number} col - Column index.
 * @param {number} row - Row index (0-indexed from bottom).
 * @param {object} demData - The demData object for the specific DEM/chunk.
 * @returns {THREE.Vector3|null} Scene world coordinates, or null if error.
 */
function gridToWorld(col, row, demData) {
    const elevation = getElevationAtGrid(col, row, demData);
    if (elevation === null) {
        // console.warn(`[WaterSim-gridToWorld] No elevation for grid (${col},${row}) to convert to world.`);
        return null;
    }
    if (state.firstDemAbsoluteOrigin.x === null || state.firstDemAbsoluteOrigin.y === null) {
        console.error("[WaterSim-gridToWorld] firstDemAbsoluteOrigin is not set.");
        return null;
    }

    const header = demData.header; 
    const planeWidth = (header.ncols - 1) * header.cellsize;
    const planeHeight = (header.nrows - 1) * header.cellsize;
    const absGeoCellCenterX = header.xllcorner + ((col + 0.5) * header.cellsize - planeWidth / 2);
    const absGeoCellCenterY = header.yllcorner + ((row + 0.5) * header.cellsize - planeHeight / 2);
    const sceneWorldX = absGeoCellCenterX - state.firstDemAbsoluteOrigin.x;
    const sceneWorldY = absGeoCellCenterY - state.firstDemAbsoluteOrigin.y;

    return new THREE.Vector3(sceneWorldX, sceneWorldY, elevation);
}


/**
 * Calculates the path a raindrop would take on a DEM from a starting point.
 * @param {THREE.Vector3} initialClickSceneWorldPoint - The starting point in "scene world" coordinates (from raycast).
 * @param {object} demEntry - The DEM entry object { id, name, mesh, demData, ... }.
 * @returns {Array<THREE.Vector3>} An array of THREE.Vector3 points representing the path,
 * in "scene world" coordinates. Returns empty array if path cannot be calculated.
 */
export function calculateRaindropPath(initialClickSceneWorldPoint, demEntry) {
    if (!demEntry || !demEntry.demData || !demEntry.mesh) {
        console.error("[WaterSim-calculatePath] Invalid demEntry provided.");
        return [];
    }
    console.log("[WaterSim-calculatePath] Calculating raindrop path from initial click (scene coords):", initialClickSceneWorldPoint, "on DEM:", demEntry.name);

    const demHeader = demEntry.demData.header; 
    const demData = demEntry.demData;

    // 1. Determine the starting grid cell from the initial click point.
    let currentGridPos = worldToGrid(initialClickSceneWorldPoint, demHeader);
    if (!currentGridPos) {
        console.warn("[WaterSim-calculatePath] Initial click point is outside DEM chunk bounds. No path calculated.");
        return []; // Cannot start path if click is off-grid
    }
    
    // 2. Get the elevation of this starting cell.
    let currentElevation = getElevationAtGrid(currentGridPos.col, currentGridPos.row, demData);
    if (currentElevation === null) { 
        console.warn("[WaterSim-calculatePath] Cannot get elevation at starting grid cell:", currentGridPos, ". No path calculated.");
        return []; // Cannot start if cell has no valid elevation
    }

    // 3. The actual path starts from the CENTER of this initial grid cell.
    const startCellCenterSceneWorldPoint = gridToWorld(currentGridPos.col, currentGridPos.row, demData);
    if (!startCellCenterSceneWorldPoint) {
        console.warn("[WaterSim-calculatePath] Could not determine world coordinates for the center of the starting cell. No path calculated.");
        return [];
    }
    
    // Ensure the Z value of startCellCenterSceneWorldPoint is the actual elevation of that cell's center.
    // gridToWorld already includes this.
    // currentElevation is already the elevation of this cell.

    const pathPoints = [startCellCenterSceneWorldPoint.clone()]; 
    console.log(`[WaterSim-calculatePath] Path starting from cell center: (${startCellCenterSceneWorldPoint.x.toFixed(2)}, ${startCellCenterSceneWorldPoint.y.toFixed(2)}, ${startCellCenterSceneWorldPoint.z.toFixed(2)})`);
    console.log(`[WaterSim-calculatePath] Start grid: col=${currentGridPos.col}, row=${currentGridPos.row}, elev=${currentElevation.toFixed(2)}`);


    for (let step = 0; step < MAX_PATH_STEPS; step++) {
        let steepestSlope = 0; 
        let nextGridPos = null;
        let nextCellCenterElevation = currentElevation; // Elevation of the center of the next chosen cell

        const neighbors = [
            { dc: -1, dr:  0, dist: 1 }, { dc: 1, dr:  0, dist: 1 }, 
            { dc:  0, dr: -1, dist: 1 }, { dc: 0, dr:  1, dist: 1 }, 
            { dc: -1, dr: -1, dist: Math.SQRT2 }, { dc: 1, dr: -1, dist: Math.SQRT2 }, 
            { dc: -1, dr:  1, dist: Math.SQRT2 }, { dc: 1, dr:  1, dist: Math.SQRT2 }  
        ];

        for (const neighbor of neighbors) {
            const ncol = currentGridPos.col + neighbor.dc;
            const nrow = currentGridPos.row + neighbor.dr;
            
            const nElev = getElevationAtGrid(ncol, nrow, demData); 

            if (nElev !== null && nElev < currentElevation) { 
                const deltaElev = currentElevation - nElev; 
                const slope = deltaElev / (neighbor.dist * demHeader.cellsize); 

                if (slope > steepestSlope) { 
                    steepestSlope = slope;
                    nextGridPos = { col: ncol, row: nrow };
                    nextCellCenterElevation = nElev;
                }
            }
        }

        if (!nextGridPos) { 
            console.log("[WaterSim-calculatePath] Raindrop stopped: No downhill path from current cell. Steps:", step);
            break;
        }

        currentGridPos = nextGridPos;
        currentElevation = nextCellCenterElevation; // Update current elevation to the center elevation of the new cell

        const nextSceneWorldPoint = gridToWorld(currentGridPos.col, currentGridPos.row, demData);
        
        if (nextSceneWorldPoint) {
            pathPoints.push(nextSceneWorldPoint);
        } else {
            console.warn("[WaterSim-calculatePath] Could not convert next grid point to world coordinates. Stopping path.");
            break;
        }

        if (step === MAX_PATH_STEPS - 1) {
            console.log("[WaterSim-calculatePath] Raindrop stopped: Max steps reached.");
        }
    }
    console.log("[WaterSim-calculatePath] Calculated path points count:", pathPoints.length);
    return pathPoints;
}
