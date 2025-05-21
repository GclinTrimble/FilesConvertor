// js/appState.js

/**
 * @file Manages the shared state of the application.
 * This includes data about loaded DEMs, reference points, and UI states.
 */

export const state = {
    /**
     * Array to store information about each loaded DEM (or DEM chunk).
     * Each entry is an object: 
     * { 
     * id: string, // Unique ID for the DEM entry (e.g., 'dem-0')
     * name: string, // Filename or chunk name (e.g., 'myDEM.asc' or 'myDEM.asc_part0_0')
     * mesh: THREE.Mesh, // The Three.js mesh object for this DEM
     * demData: { // Parsed data for this DEM/chunk
     * header: object, // Original header (ncols, nrows, xllcorner, yllcorner, etc.)
     * data: Array<Array<number>>, // 2D array of elevation values
     * minElev: number, 
     * maxElev: number 
     * },
     * materials: { // Cache for different materials applied to this DEM
     * default: THREE.Material, 
     * color?: THREE.ShaderMaterial, 
     * gray?: THREE.ShaderMaterial 
     * },
     * isVisible: boolean, // Current visibility state in the scene
     * fileId: number // Internal counter ID, can be used for tracking
     * }
     */
    loadedDEMs: [],

    /**
     * Stores the absolute xllcorner and yllcorner of the very first DEM (or its first chunk) loaded.
     * This is used as a reference origin (0,0 in logical scene space) to position all 
     * subsequent DEMs relatively, ensuring they align correctly if they are adjacent.
     * { x: number | null, y: number | null }
     */
    firstDemAbsoluteOrigin: { x: null, y: null },

    /**
     * Counter for generating unique IDs for DEM entries in the list panel and internal tracking.
     */
    fileIdCounter: 0,

    /**
     * Stores the 3D world coordinates of the last detected mouse intersection with a DEM surface.
     * Used for cursor-centric navigation and click-to-query functionality.
     * Is a THREE.Vector3 or null if no intersection.
     */
    lastMouseIntersectionPoint: null,

    /**
     * The currently selected global shading mode (e.g., 'default', 'colorElevation', 'grayElevation').
     * This is typically read from the materialTypeSelect dropdown in the UI.
     * Initialized by UIManager reading the select element.
     */
    currentShadingMode: 'default', // Set a default, will be updated by UIManager
};

/**
 * Resets the `firstDemAbsoluteOrigin` to null.
 * This should be called when all DEMs are cleared or before a new, independent set of DEMs is loaded.
 */
export function resetFirstDemAbsoluteOrigin() {
    state.firstDemAbsoluteOrigin.x = null;
    state.firstDemAbsoluteOrigin.y = null;
    console.log("Reset firstDemAbsoluteOrigin.");
}

/**
 * Resets the fileIdCounter.
 */
export function resetFileIdCounter() {
    state.fileIdCounter = 0;
}

/**
 * Clears all loaded DEMs from the state.
 * This would typically be followed by calls to clear them from the scene and UI.
 */
export function clearLoadedDEMs() {
    state.loadedDEMs = [];
    resetFirstDemAbsoluteOrigin();
    resetFileIdCounter();
    console.log("Cleared all loaded DEMs from state.");
}
