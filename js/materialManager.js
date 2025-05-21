// js/materialManager.js
import * as THREE from 'three';
import { state } from './appState.js';
import { 
    createColorElevationShaderMaterial, 
    createGrayElevationShaderMaterial,
    createDefaultDemMaterial 
} from './shaderManager.js';
import { getAmbientLight, getDirectionalLight } from './threeSceneManager.js';

/**
 * @file Manages the creation, assignment, and updating of materials for DEM meshes.
 */

/**
 * Updates the material of a specific DEM mesh based on the selected shading type.
 * Creates new shader materials if they don't exist for this DEM yet, or updates existing ones.
 * @param {object} demEntry - The DEM entry object from appState.js.
 * @param {string} materialType - The selected material type ('default', 'colorElevation', 'grayElevation').
 */
export function updateDemMaterial(demEntry, materialType) {
    if (!demEntry || !demEntry.mesh || !demEntry.demData) {
        console.error("updateDemMaterial: Invalid demEntry provided.", demEntry);
        return;
    }

    const { minElev, maxElev } = demEntry.demData;
    const ambientLight = getAmbientLight(); // Get from threeSceneManager
    const directionalLight = getDirectionalLight(); // Get from threeSceneManager

    // Ensure lights are available before proceeding
    if (!ambientLight || !directionalLight) {
        console.error("updateDemMaterial: Lights not available from threeSceneManager.");
        return;
    }

    const effectiveAmbientColor = new THREE.Color().copy(ambientLight.color).multiplyScalar(ambientLight.intensity);
    const effectiveDirectionalColor = new THREE.Color().copy(directionalLight.color).multiplyScalar(directionalLight.intensity);

    // Prepare common uniforms for shader materials
    const commonShaderUniforms = {
        minElevation: { value: minElev },
        maxElevation: { value: maxElev },
        uDirectionalLightDirection: { value: new THREE.Vector3(0.5, 0.5, 1).normalize() }, // Initial, updated in animate loop
        uDirectionalLightColor: { value: effectiveDirectionalColor },
        uAmbientLightColor: { value: effectiveAmbientColor }
    };
    
    let targetMaterial;

    switch (materialType) {
        case 'colorElevation':
            if (!demEntry.materials.color) {
                demEntry.materials.color = createColorElevationShaderMaterial(commonShaderUniforms);
            } else {
                // Update existing uniforms
                demEntry.materials.color.uniforms.minElevation.value = minElev;
                demEntry.materials.color.uniforms.maxElevation.value = maxElev;
                demEntry.materials.color.uniforms.uDirectionalLightColor.value.copy(effectiveDirectionalColor);
                demEntry.materials.color.uniforms.uAmbientLightColor.value.copy(effectiveAmbientColor);
            }
            targetMaterial = demEntry.materials.color;
            break;
        case 'grayElevation':
            if (!demEntry.materials.gray) {
                demEntry.materials.gray = createGrayElevationShaderMaterial(commonShaderUniforms);
            } else {
                demEntry.materials.gray.uniforms.minElevation.value = minElev;
                demEntry.materials.gray.uniforms.maxElevation.value = maxElev;
                demEntry.materials.gray.uniforms.uDirectionalLightColor.value.copy(effectiveDirectionalColor);
                demEntry.materials.gray.uniforms.uAmbientLightColor.value.copy(effectiveAmbientColor);
            }
            targetMaterial = demEntry.materials.gray;
            break;
        case 'default':
        default:
            // Ensure the 'default' material exists in the demEntry.materials cache
            // The actual defaultMaterial instance is shared, but we store a reference.
            if (!demEntry.materials.default) {
                // This assumes createDefaultDemMaterial() returns a shared instance or a clone
                // For simplicity, let's assume it's okay if multiple DEMs share the exact same default material instance.
                // If unique default material properties per DEM were needed, this would need cloning.
                demEntry.materials.default = createDefaultDemMaterial(); 
            }
            targetMaterial = demEntry.materials.default;
            break;
    }

    if (demEntry.mesh.material !== targetMaterial) {
        demEntry.mesh.material = targetMaterial;
        // Note: ShaderMaterial uniforms are objects, so direct assignment is fine.
        // If you were changing properties of a shared material, you'd need material.needsUpdate = true.
        // For swapping entire materials, this is generally not needed unless the new material itself needs an update.
    }
     console.log(`[${demEntry.name}] Material updated to: ${materialType}`);
}

/**
 * Applies the currently selected global shading type (from state.currentShadingMode) 
 * to all loaded DEMs.
 */
export function updateAllDemMaterials() {
    console.log("Updating materials for all DEMs to:", state.currentShadingMode);
    state.loadedDEMs.forEach(dem => {
        updateDemMaterial(dem, state.currentShadingMode);
    });
}
