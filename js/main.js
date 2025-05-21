// js/main.js
/**
 * @file Main entry point for the Multi-DEM Viewer application.
 * Initializes all modules and sets up primary event listeners.
 */

// --- Module Imports ---
import * as THREE from 'three'; 
import { state, resetFirstDemAbsoluteOrigin, clearLoadedDEMs } from './appState.js';
import { MAX_POINTS_PER_CHUNK } from './constants.js'; 

import { 
    uiElements, 
    initDOMElements, 
    setStatusMessage, 
    showLoader, 
    addDemToPanelList, 
    clearDemListPanel,
    setDemControlsEnabled,
    showAIDescriptionPanel,
    hideAIDescriptionPanel
} from './uiManager.js';

import { 
    parseASCIIGrid 
} from './demParser.js';

import { 
    processAndChunkDEM 
} from './demProcessor.js';

import { 
    initScene, 
    addMeshToScene, 
    removeMeshFromScene, 
    centerView,
    getCamera, 
    getScene   
} from './threeSceneManager.js';

import { 
    updateDemMaterial, 
    updateAllDemMaterials 
} from './materialManager.js';

// ***** THIS IS THE CRUCIAL IMPORT *****
import { createDefaultDemMaterial } from './shaderManager.js'; 
// Make sure 'shaderManager.js' is in the same 'js/' folder and exports this function.

import { 
    exportIndividualDemGLB, 
    exportUnifiedVisibleDemsGLB 
} from './exportManager.js';

import { 
    fetchAIDescription 
} from './apiManager.js';


// --- Main Application Logic ---

/**
 * Initializes all application modules and sets up global event listeners.
 */
function initializeApp() {
    console.log("Initializing DEM Viewer Application...");
    initDOMElements(); 
    initScene(uiElements.canvasContainer); 
    setupEventListeners(); 
    setDemControlsEnabled(false); 
    setStatusMessage("Please load DEM file(s). Click on terrain for coordinates.");
    console.log("Application initialized.");
}

/**
 * Sets up event listeners for the main UI controls.
 */
function setupEventListeners() {
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
}

/**
 * Handles the 'change' event on the file input element.
 * Processes selected .asc files, parses them (splitting if necessary), 
 * creates 3D terrain meshes, and adds them to the scene and UI.
 * @param {Event} event - The file input change event.
 */
async function handleFileLoad(event) {
    const files = event.target.files; 
    if (!files || files.length === 0) return; 
    
    if (state.loadedDEMs.length === 0) { 
        resetFirstDemAbsoluteOrigin(); 
    }

    showLoader(true); 
    setStatusMessage(`Loading ${files.length} file(s)...`);
    hideAIDescriptionPanel(); 
    
    let filesProcessedSuccessfully = 0;
    for (const file of files) { 
        if (!file.name.toLowerCase().endsWith('.asc')) { 
            setStatusMessage(`Skipping non .asc file: ${file.name}`, true); 
            console.warn(`Skipping non .asc file: ${file.name}`); 
            continue;
        }
        try {
            const fileContent = await file.text(); 
            
            const parsedFullDem = parseASCIIGrid(fileContent, file.name);
            if (!parsedFullDem) {
                setStatusMessage(`Failed to parse ${file.name}. Check console.`, true);
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
            }
        } catch (error) { 
            console.error(`Error processing file ${file.name}:`, error);
            setStatusMessage(`Error processing file ${file.name}: ${error.message}`, true);
        }
    }
    showLoader(false); 
    
    if (state.loadedDEMs.length > 0) {
         setStatusMessage(`${state.loadedDEMs.length} DEM(s)/chunk(s) loaded. Click on terrain for coordinates.`); 
         centerView(); 
         setDemControlsEnabled(true); 
    } else if (files.length > 0 && filesProcessedSuccessfully === 0) {
         setStatusMessage("No valid DEMs were loaded. Check files or console.", true);
         setDemControlsEnabled(false);
    } else { 
         setStatusMessage("Please load DEM file(s). Click on terrain for coordinates."); 
         setDemControlsEnabled(false);
    }
    if (uiElements.fileInput) uiElements.fileInput.value = ''; 
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
    
    const relativeX = header.xllcorner - state.firstDemAbsoluteOrigin.x;
    const relativeY = header.yllcorner - state.firstDemAbsoluteOrigin.y;
    
    console.log(`[${fileName}] Creating Terrain Mesh. Abs xll=${header.xllcorner}, yll=${header.yllcorner}. Rel X=${relativeX}, Rel Y=${relativeY} for mesh center.`);

    const geometry = new THREE.PlaneGeometry(planeWidthForGeom, planeHeightForGeom, Math.max(1, ncols - 1), Math.max(1, nrows - 1));
    const positions = geometry.attributes.position;
    
    console.log(`[${fileName}] Applying DEM row mapping: demRow = j (assumes DEM data rows are bottom-to-top).`);
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
        mesh: new THREE.Mesh(geometry, createDefaultDemMaterial()), // <<<< Function is called here
        demData: parsedData, 
        materials: { default: null }, 
        isVisible: true, 
        fileId: state.fileIdCounter
    };
    demEntry.materials.default = demEntry.mesh.material; 

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
 * Updates the materials of all loaded DEMs.
 */
function handleMaterialChange() {
    if (uiElements.materialTypeSelect) {
        state.currentShadingMode = uiElements.materialTypeSelect.value;
        updateAllDemMaterials(); 
    }
}

/**
 * Handles the click event for the "Get AI Description" button.
 * Fetches and displays a description for the most relevant DEM.
 */
async function handleGetAIDescription() {
    let targetDemEntry = null; 
    for (let i = state.loadedDEMs.length - 1; i >= 0; i--) {
        if (state.loadedDEMs[i].isVisible) { 
            targetDemEntry = state.loadedDEMs[i]; 
            break; 
        }
    }
    if (!targetDemEntry) { 
        showAIDescriptionPanel("No visible DEM selected to describe.");
        return; 
    }
    
    showAIDescriptionPanel(`<div class="flex items-center justify-center"><div class="loader-small border-t-purple-500" style="width:20px; height:20px; border-width:3px; animation: spin 1s linear infinite;"></div><span class="ml-2">Generating for ${targetDemEntry.name}...</span></div>`);
    if (uiElements.getAIDescriptionBtn) uiElements.getAIDescriptionBtn.disabled = true;
    
    try {
        const description = await fetchAIDescription(
            targetDemEntry.name, 
            targetDemEntry.demData.header, 
            targetDemEntry.demData.minElev, 
            targetDemEntry.demData.maxElev
        );
        showAIDescriptionPanel(description);
    } catch (error) {
        showAIDescriptionPanel(`Error: ${error.message}`);
    } finally {
        if (uiElements.getAIDescriptionBtn) uiElements.getAIDescriptionBtn.disabled = false;
    }
}

/**
 * Handles the click event for the "Export Unified GLB" button.
 */
async function handleExportUnified() {
    setStatusMessage("Preparing unified export...");
    try {
        await exportUnifiedVisibleDemsGLB(setStatusMessage);
    } catch (error) {
        console.error("Unified export error in main:", error);
        setStatusMessage("Error during unified export. See console.", true);
    }
}

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', initializeApp);
