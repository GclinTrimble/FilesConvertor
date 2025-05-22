// js/appState.js

/**
 * @file Manages the shared state of the application.
 * This includes data about loaded DEMs, reference points, UI states, and visualization objects.
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
     * Structure: { x: number | null, y: number | null }
     */
    firstDemAbsoluteOrigin: { x: null, y: null },

    /**
     * Counter for generating unique IDs for DEM entries in the list panel and internal tracking.
     */
    fileIdCounter: 0,

    /**
     * Stores the 3D world coordinates of the last detected mouse intersection with a DEM surface.
     * Used for cursor-centric navigation (if OrbitControls were used) and click-to-query functionality.
     * Is a THREE.Vector3 or null if no intersection.
     */
    lastMouseIntersectionPoint: null,

    /**
     * The currently selected global shading mode (e.g., 'default', 'colorElevation', 'grayElevation').
     * This is typically read from the materialTypeSelect dropdown in the UI.
     */
    currentShadingMode: 'default', // Default value, updated by UIManager or main.js

    /**
     * Array to store references to THREE.Line objects representing raindrop paths.
     * This is managed by threeSceneManager.js for adding/clearing paths from the scene.
     * While threeSceneManager has its own internal `raindropPathLineObjects`,
     * this could be used if other modules needed to inspect these paths, though currently not the case.
     * For now, it serves as a placeholder if broader state management of paths is needed.
     * The primary management of these line objects is within threeSceneManager.js's local array.
     */
    // raindropPathLineObjects: [], // This was in threeSceneManager, keeping it there is fine.
                                 // If global access is needed, it can be moved here.
};

/**
 * Resets the `firstDemAbsoluteOrigin` to null.
 * This should be called when all DEMs are cleared or before a new, independent set of DEMs is loaded,
 * allowing the next loaded DEM to establish a new reference origin.
 */
export function resetFirstDemAbsoluteOrigin() {
    state.firstDemAbsoluteOrigin.x = null;
    state.firstDemAbsoluteOrigin.y = null;
    console.log("[AppState] Reset firstDemAbsoluteOrigin.");
}

/**
 * Resets the fileIdCounter back to 0.
 */
export function resetFileIdCounter() {
    state.fileIdCounter = 0;
    console.log("[AppState] Reset fileIdCounter.");
}

/**
 * Clears all loaded DEMs from the application state.
 * Also resets the reference origin and file ID counter.
 * Note: This function only clears the state. Actual removal from the 3D scene
 * and UI list needs to be handled by the respective managers (threeSceneManager, uiManager).
 */
export function clearLoadedDEMsState() {
    state.loadedDEMs = [];
    resetFirstDemAbsoluteOrigin();
    resetFileIdCounter(); // It's good practice to reset this if all DEMs are cleared.
    console.log("[AppState] Cleared all loaded DEMs from state.");
}
