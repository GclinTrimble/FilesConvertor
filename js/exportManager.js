// js/exportManager.js
import * as THREE from 'three'; // Import the THREE namespace
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { state } from './appState.js'; 
// We'll need the default material creation function if not already available globally
// For simplicity, let's assume the default material instance is accessible or we create a new one.

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
        document.body.appendChild(link); 
        link.click();
        document.body.removeChild(link); 
        URL.revokeObjectURL(link.href); 
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
 * Temporarily switches to a basic material for export to avoid issues with custom shaders.
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
        const originalMaterial = demEntry.mesh.material; // Store original material
        
        // Create a simple, known-good material for export.
        // Using MeshStandardMaterial is generally good for GLTF.
        const exportMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc, // A default gray color
            vertexColors: false // Assuming no vertex colors are being explicitly used that need export
        });
        
        // If the original material has a color, try to use it for the export material
        if (originalMaterial.color && exportMaterial.color) {
            exportMaterial.color.copy(originalMaterial.color);
        }
        // If the original material was a shader that calculated color based on elevation,
        // this basic material won't replicate that. The geometry will be correct.

        demEntry.mesh.material = exportMaterial; // Temporarily assign export material

        exporter.parse(
            demEntry.mesh, 
            (glb) => { 
                demEntry.mesh.material = originalMaterial; // Restore original material
                triggerGLBDownload(glb, `${demEntry.name.replace('.asc', '')}.glb`, setStatusFn);
                resolve();
            },
            (error) => { 
                demEntry.mesh.material = originalMaterial; // Restore original material on error too
                console.error(`Error exporting individual GLB for ${demEntry.name}:`, error); 
                if (setStatusFn) setStatusFn(`Error exporting ${demEntry.name}. See console.`, true);
                reject(error);
            },
            { binary: true } 
        );
    });
}

/**
 * Exports all currently visible DEMs as a single, unified GLB file.
 * Meshes are cloned and added to a temporary group to maintain their relative world positions.
 * Temporarily switches to a basic material for export.
 * @param {function} setStatusFn - Function to update status message.
 * @returns {Promise<void>} A promise that resolves when export is attempted.
 */
export function exportUnifiedVisibleDemsGLB(setStatusFn) {
    return new Promise((resolve, reject) => {
        const visibleDems = state.loadedDEMs.filter(dem => dem.isVisible);
        if (visibleDems.length === 0) {
            if (setStatusFn) setStatusFn("No visible DEMs to export.");
            resolve(); 
            return;
        }

        if (setStatusFn) setStatusFn("Exporting unified GLB of visible DEMs...");
        console.log(`Starting export for ${visibleDems.length} visible DEMs.`);

        const group = new THREE.Group(); 
        const originalMaterialsMap = new Map(); // To store original materials of clones

        visibleDems.forEach(demEntry => {
            const clone = demEntry.mesh.clone(false); // Shallow clone for position, then handle geometry/material
            clone.geometry = demEntry.mesh.geometry; // Share geometry to avoid re-cloning complex data unnecessarily for export

            originalMaterialsMap.set(clone, demEntry.mesh.material); // Store original material reference

            // Create a simple, known-good material for export for this clone
            const exportMaterial = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                vertexColors: false
            });
            if (demEntry.mesh.material.color && exportMaterial.color) {
                 exportMaterial.color.copy(demEntry.mesh.material.color);
            }
            clone.material = exportMaterial;
            
            group.add(clone); 
        });

        const exporter = new GLTFExporter();
        exporter.parse(
            group, 
            (glb) => { 
                // Restore original materials on the clones if they were part of the scene (though they are not)
                // More importantly, this example doesn't modify originals, only clones.
                triggerGLBDownload(glb, 'unified_dems.glb', setStatusFn);
                resolve();
            },
            (error) => { 
                 console.error('Error exporting unified GLB:', error);
                 if (setStatusFn) setStatusFn("Error exporting unified GLB. See console.", true);
                 reject(error);
            },
            { binary: true } 
        );
    });
}
