// js/exportManager.js
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { state } from './appState.js'; // To access loadedDEMs
// import { setStatusMessage } from './uiManager.js'; // If we want to centralize status updates here

/**
 * @file Manages the export of DEM meshes to GLB format.
 */

/**
 * Triggers a browser download for the given GLB data.
 * @param {ArrayBuffer} glbData - The binary GLB data.
 * @param {string} fileName - The desired filename for the download.
 * @param {function} setStatusFn - Function to update status message (e.g., uiManager.setStatusMessage).
 */
function triggerGLBDownload(glbData, fileName, setStatusFn) {
    try {
        const blob = new Blob([glbData], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link); // Required for Firefox for the click to work
        link.click();
        document.body.removeChild(link); // Clean up the temporary link
        URL.revokeObjectURL(link.href); // Release the object URL to free up resources
        if (setStatusFn) setStatusFn(`Exported ${fileName}`);
        console.log(`Successfully triggered download for ${fileName}`);
    } catch (error) {
        console.error(`Error triggering download for ${fileName}:`, error);
        if (setStatusFn) setStatusFn(`Error downloading ${fileName}. See console.`, true);
    }
}

/**
 * Exports an individual DEM entry (a single mesh) as a GLB file.
 * The mesh is exported with its current world transform.
 * @param {object} demEntry - The DEM entry object containing the mesh to export.
 * @param {function} setStatusFn - Function to update status message.
 * @returns {Promise<void>} A promise that resolves when export is attempted.
 */
export function exportIndividualDemGLB(demEntry, setStatusFn) {
    return new Promise((resolve, reject) => {
        if (!demEntry || !demEntry.mesh) {
            const errorMsg = "Error: DEM entry or mesh not found for individual export.";
            console.error(errorMsg);
            if (setStatusFn) setStatusFn(errorMsg, true);
            reject(new Error(errorMsg));
            return;
        }

        if (setStatusFn) setStatusFn(`Exporting ${demEntry.name} as GLB...`);
        console.log(`Starting export for individual DEM: ${demEntry.name}`);

        const exporter = new GLTFExporter();
        
        // The mesh is already positioned correctly in world space relative to the scene's logical origin.
        // Exporting it directly will preserve this world position if the GLB is imported at (0,0,0).
        exporter.parse(
            demEntry.mesh, // Export the specific mesh
            (glb) => { // Success callback
                triggerGLBDownload(glb, `${demEntry.name.replace('.asc', '')}.glb`, setStatusFn);
                resolve();
            },
            (error) => { // Error callback
                console.error(`Error exporting individual GLB for ${demEntry.name}:`, error); 
                if (setStatusFn) setStatusFn(`Error exporting ${demEntry.name}. See console.`, true);
                reject(error);
            },
            { binary: true } // Export options: binary true for .glb format
        );
    });
}

/**
 * Exports all currently visible DEMs as a single, unified GLB file.
 * Meshes are cloned and added to a temporary group to maintain their relative world positions.
 * @param {function} setStatusFn - Function to update status message.
 * @returns {Promise<void>} A promise that resolves when export is attempted.
 */
export function exportUnifiedVisibleDemsGLB(setStatusFn) {
    return new Promise((resolve, reject) => {
        const visibleDems = state.loadedDEMs.filter(dem => dem.isVisible);
        if (visibleDems.length === 0) {
            if (setStatusFn) setStatusFn("No visible DEMs to export.");
            resolve(); // Resolve even if nothing to export, not strictly an error
            return;
        }

        if (setStatusFn) setStatusFn("Exporting unified GLB of visible DEMs...");
        console.log(`Starting export for ${visibleDems.length} visible DEMs.`);

        const group = new THREE.Group(); // Create a temporary group to hold all meshes for export
        
        visibleDems.forEach(demEntry => {
            const clone = demEntry.mesh.clone(true); // Deep clone the mesh (including geometry and material if possible)
            // The mesh's position is already relative to the firstDemAbsoluteOrigin.
            // When these clones are added to a group at (0,0,0), their positions in the GLB
            // will reflect their correct relative world positions.
            group.add(clone); 
        });

        const exporter = new GLTFExporter();
        exporter.parse(
            group, // Export the group containing all cloned visible DEMs
            (glb) => { // Success callback
                triggerGLBDownload(glb, 'unified_dems.glb', setStatusFn);
                resolve();
            },
            (error) => { // Error callback
                 console.error('Error exporting unified GLB:', error);
                 if (setStatusFn) setStatusFn("Error exporting unified GLB. See console.", true);
                 reject(error);
            },
            { binary: true } // Export as binary GLB
        );
    });
}
