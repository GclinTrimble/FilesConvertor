// js/main.js
/**
 * @file Main entry point for the Multi-DEM Viewer application.
 * Initializes all modules and sets up primary event listeners.
 */

// --- Module Imports ---
import * as THREE from 'three'; 

import { state, resetFirstDemAbsoluteOrigin } from './appState.js';

import { 
    uiElements, 
    initDOMElements, 
    setStatusMessage, 
    showLoader, 
    addDemToPanelList, 
    setDemControlsEnabled,
    showAIDescriptionPanel,
    hideAIDescriptionPanel
} from './uiManager.js';

import { parseASCIIGrid } from './demParser.js';
import { processAndChunkDEM } from './demProcessor.js';

import { 
    initScene, 
    addMeshToScene, 
    centerView,
    getCanvasClickIntersectionAndDem, // This is the key function from threeSceneManager for clicks
    addPathLineVisual,          
    clearAllPathLineVisuals     
} from './threeSceneManager.js';

import { 
    updateDemMaterial, 
    updateAllDemMaterials 
} from './materialManager.js';
import { createDefaultDemMaterial } from './shaderManager.js'; 
import { exportUnifiedVisibleDemsGLB } from './exportManager.js';
import { fetchAIDescription } from './apiManager.js';
import { calculateRaindropPath } from './waterFlowSimulator.js';


// --- Main Application Logic ---

/**
 * Initializes all application modules and sets up global event listeners.
 * This is the main function called when the DOM is ready.
 */
function initializeApp() {
    console.log("[Main] Initializing DEM Viewer Application...");
    initDOMElements(); 
    // Pass handleCanvasPrimaryClick as the callback to initScene
    initScene(uiElements.canvasContainer, handleCanvasPrimaryClick); 
    setupEventListeners(); 
    setDemControlsEnabled(false); 
    setStatusMessage("Please load DEM file(s). Click on terrain for coordinates or to simulate raindrop.");
    console.log("[Main] Application initialized.");
}

/**
 * Sets up event listeners for the main UI controls.
 * The primary canvas click listener is now set up within threeSceneManager.js via callback.
 */
function setupEventListeners() {
    console.log("[Main] Setting up event listeners...");
    if (uiElements.fileInput) {
        uiElements.fileInput.addEventListener('change', handleFileLoad);
    }
    if (uiElements.centerViewBtn) {
        uiElements.centerViewBtn.addEventListener('click', centerView); 
    }
    if (uiElements.materialTypeSelect) {
        uiElements.materialTypeSelect.addEventListener('change', handleMaterialChange);
    }
    if (uiElements.getAIDescriptionBtn) {
        uiElements.getAIDescriptionBtn.addEventListener('click', handleGetAIDescription);
    }
    if (uiElements.closeAIDescriptionBtn) {
        uiElements.closeAIDescriptionBtn.addEventListener('click', hideAIDescriptionPanel);
    }
    if (uiElements.exportUnifiedBtn) {
        uiElements.exportUnifiedBtn.addEventListener('click', handleExportUnified);
    }
    
    // The primary canvas click listener is now set up inside threeSceneManager's initScene
    // by passing `handleCanvasPrimaryClick` as a callback.
    console.log("[Main] Event listeners set up (primary canvas click handled by threeSceneManager callback).");
}

/**
 * Handles the 'change' event on the file input element.
 * Orchestrates reading, parsing, chunking (if needed), and rendering of DEM files.
 * @param {Event} event - The file input change event.
 */
async function handleFileLoad(event) {
    console.log("[Main] File input changed.");
    const files = event.target.files; 
    if (!files || files.length === 0) {
        console.log("[Main] No files selected.");
        return; 
    }
    if (state.loadedDEMs.length === 0) { 
        resetFirstDemAbsoluteOrigin(); 
        console.log("[Main] First DEM load, reset absolute origin.");
    }
    showLoader(true); 
    setStatusMessage(`Loading ${files.length} file(s)...`);
    hideAIDescriptionPanel(); 
    let filesProcessedSuccessfully = 0;
    for (const file of files) { 
        console.log(`[Main] Processing file: ${file.name}`);
        if (!file.name.toLowerCase().endsWith('.asc')) { 
            setStatusMessage(`Skipping non .asc file: ${file.name}`, true); 
            console.warn(`[Main] Skipping non .asc file: ${file.name}`); 
            continue;
        }
        try {
            const fileContent = await file.text(); 
            const parsedFullDem = parseASCIIGrid(fileContent, file.name);
            if (!parsedFullDem) {
                setStatusMessage(`Failed to parse ${file.name}. Check console.`, true);
                console.error(`[Main] Parsing failed for ${file.name}.`);
                continue; 
            }
            const demChunksToProcess = processAndChunkDEM(parsedFullDem, file.name);
            if (demChunksToProcess && demChunksToProcess.length > 0) {
                for (const chunkData of demChunksToProcess) { 
                    createAndAddTerrainMesh(chunkData.name, chunkData.parsedData); 
                }
                filesProcessedSuccessfully++;
            } else { 
                setStatusMessage(`No processable chunks generated for ${file.name}. Check console.`, true); 
                console.warn(`[Main] No processable chunks for ${file.name}.`);
            }
        } catch (error) { 
            console.error(`[Main] Error processing file ${file.name}:`, error);
            setStatusMessage(`Error processing file ${file.name}: ${error.message}`, true);
        }
    }
    showLoader(false); 
    if (state.loadedDEMs.length > 0) {
         setStatusMessage(`${state.loadedDEMs.length} DEM(s)/chunk(s) loaded. Click on terrain for coordinates or raindrop.`); 
         centerView(); 
         setDemControlsEnabled(true); 
    } else if (files.length > 0 && filesProcessedSuccessfully === 0) {
         setStatusMessage("No valid DEMs were loaded. Check files or console.", true);
         setDemControlsEnabled(false);
    } else { 
         setStatusMessage("Please load DEM file(s). Click on terrain for coordinates or raindrop."); 
         setDemControlsEnabled(false);
    }
    if (uiElements.fileInput) uiElements.fileInput.value = ''; 
    console.log("[Main] File loading process complete.");
}

/**
 * Creates a 3D terrain mesh from parsed DEM data and adds it to the scene and UI.
 * This function is called for each DEM or each chunk of a split DEM.
 * @param {string} fileName - The name of the DEM (or chunk).
 * @param {object} parsedData - The object containing {header, data, minElev, maxElev}.
 */
function createAndAddTerrainMesh(fileName, parsedData) {
    const { header, data, minElev, maxElev } = parsedData;
    const ncols = Math.floor(header.ncols); 
    const nrows = Math.floor(header.nrows);
    const cellsize = header.cellsize; 
    const nodata_value = header.nodata_value;
    const planeWidthForGeom = (ncols - 1) * cellsize; 
    const planeHeightForGeom = (nrows - 1) * cellsize;
    if (state.firstDemAbsoluteOrigin.x === null) { 
        state.firstDemAbsoluteOrigin.x = header.xllcorner;
        state.firstDemAbsoluteOrigin.y = header.yllcorner;
    }
    const relativeX = header.xllcorner - state.firstDemAbsoluteOrigin.x;
    const relativeY = header.yllcorner - state.firstDemAbsoluteOrigin.y;
    const geometry = new THREE.PlaneGeometry(planeWidthForGeom, planeHeightForGeom, Math.max(1, ncols - 1), Math.max(1, nrows - 1));
    const positions = geometry.attributes.position;
    for (let j = 0; j < nrows; j++) {
        for (let i = 0; i < ncols; i++) {
            const vertexIndex = i + j * ncols;
            const demRow = j; 
            const demCol = i; 
            let elevation = (data[demRow] && data[demRow][demCol] !== undefined) ? data[demRow][demCol] : nodata_value;
            if (elevation === undefined || elevation === null || isNaN(elevation) || elevation === nodata_value) elevation = minElev; 
            if (positions.array.length > vertexIndex * 3 + 2) positions.setZ(vertexIndex, elevation);
        }
    }
    geometry.computeVertexNormals();
    state.fileIdCounter++;
    const demEntry = {
        id: `dem-${state.fileIdCounter}`, 
        name: fileName,
        mesh: new THREE.Mesh(geometry, createDefaultDemMaterial()), 
        demData: parsedData, 
        materials: { default: null }, 
        isVisible: true, 
        fileId: state.fileIdCounter
    };
    demEntry.materials.default = demEntry.mesh.material; 
    demEntry.mesh.userData.demEntry = demEntry; 
    demEntry.mesh.position.set(relativeX, relativeY, 0); 
    addMeshToScene(demEntry.mesh); 
    state.loadedDEMs.push(demEntry);
    addDemToPanelList(demEntry, (demId, isVisible) => {
        const changedDem = state.loadedDEMs.find(d => d.id === demId);
        if (changedDem) {
            changedDem.isVisible = isVisible;
            changedDem.mesh.visible = isVisible;
        }
    }); 
    updateDemMaterial(demEntry, state.currentShadingMode); 
}

/**
 * Handles changes in the material/shading type dropdown.
 * Updates the materials of all loaded DEMs via the materialManager.
 */
function handleMaterialChange() {
    if (uiElements.materialTypeSelect) {
        state.currentShadingMode = uiElements.materialTypeSelect.value;
        console.log(`[Main] Material changed to: ${state.currentShadingMode}`);
        updateAllDemMaterials(); 
    }
}

/**
 * Primary handler for clicks on the 3D canvas.
 * This function is now called by threeSceneManager with intersectionData.
 * @param {{intersection: THREE.Intersection, demEntry: object}|null} intersectionData - Data from raycast.
 */
function handleCanvasPrimaryClick(intersectionData) { 
    console.log("[Main] handleCanvasPrimaryClick called with intersectionData:", intersectionData); 
    if (state.loadedDEMs.length === 0 && !intersectionData) { 
        setStatusMessage("Please load a DEM first to interact.");
        console.log("[Main] No DEMs loaded, click ignored.");
        return;
    }

    if (intersectionData && intersectionData.demEntry && intersectionData.intersection) {
        const demEntry = intersectionData.demEntry;
        const startPoint = intersectionData.intersection.point; 

        setStatusMessage(`Simulating raindrop from X:${startPoint.x.toFixed(2)}, Y:${startPoint.y.toFixed(2)} on ${demEntry.name}...`);
        console.log(`[Main] Simulating raindrop for ${demEntry.name} at`, startPoint);
        
        clearAllPathLineVisuals(); 

        const pathPoints = calculateRaindropPath(startPoint, demEntry);
        console.log("[Main] Calculated path points:", pathPoints ? pathPoints.length : 0); 

        if (pathPoints && pathPoints.length >= 2) {
            addPathLineVisual(pathPoints, 0x007bff); 
            setStatusMessage(`Raindrop path simulated on ${demEntry.name} with ${pathPoints.length} points.`);
        } else if (pathPoints && pathPoints.length === 1) {
            setStatusMessage(`Raindrop started at X:${startPoint.x.toFixed(2)}, Y:${startPoint.y.toFixed(2)} but did not move (local minimum or edge).`);
        } else {
            setStatusMessage(`Could not simulate raindrop path from X:${startPoint.x.toFixed(2)}, Y:${startPoint.y.toFixed(2)}.`);
        }
    } else if (intersectionData && intersectionData.intersection) { 
        const point = intersectionData.intersection.point;
        setStatusMessage(`Clicked at X: ${point.x.toFixed(2)}, Y: ${point.y.toFixed(2)}, Z: ${point.z.toFixed(2)} (Not a recognized DEM for path simulation).`);
        console.log("[Main] Clicked, but not a recognized DEM for path sim:", intersectionData);
    } else {
        setStatusMessage("No terrain clicked. Click on terrain for coordinates or raindrop.");
        console.log("[Main] No terrain intersection found on click.");
    }
}


/**
 * Handles the click event for the "Get AI Description" button.
 * Fetches and displays a description for the most relevant (last loaded, visible) DEM.
 */
async function handleGetAIDescription() {
    let targetDemEntry = null; 
    for (let i = state.loadedDEMs.length - 1; i >= 0; i--) {
        if (state.loadedDEMs[i].isVisible) { targetDemEntry = state.loadedDEMs[i]; break; }
    }
    if (!targetDemEntry) { showAIDescriptionPanel("No visible DEM selected to describe."); return; }
    showAIDescriptionPanel(`<div class="flex items-center justify-center"><div class="loader-small border-t-purple-500" style="width:20px; height:20px; border-width:3px; animation: spin 1s linear infinite;"></div><span class="ml-2">Generating for ${targetDemEntry.name}...</span></div>`);
    if (uiElements.getAIDescriptionBtn) uiElements.getAIDescriptionBtn.disabled = true;
    try {
        const description = await fetchAIDescription( targetDemEntry.name, targetDemEntry.demData.header, targetDemEntry.demData.minElev, targetDemEntry.demData.maxElev );
        showAIDescriptionPanel(description); 
    } catch (error) {
        showAIDescriptionPanel(`Error: ${error.message}`); 
    } finally {
        if (uiElements.getAIDescriptionBtn) uiElements.getAIDescriptionBtn.disabled = false; 
    }
}

/**
 * Handles the click event for the "Export Unified GLB" button.
 * Calls the exportManager to perform the export.
 */
async function handleExportUnified() {
    setStatusMessage("Preparing unified export...");
    try {
        await exportUnifiedVisibleDemsGLB(setStatusMessage);
    } catch (error) {
        console.error("[Main] Unified export error:", error);
        setStatusMessage("Error during unified export. See console.", true);
    }
}


// --- Application Initialization ---
// Wait for the DOM to be fully loaded before initializing the app
document.addEventListener('DOMContentLoaded', initializeApp);
