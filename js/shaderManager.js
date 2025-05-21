// js/shaderManager.js
import * as THREE from 'three';

/**
 * @file Manages GLSL shader code and creation of Three.js ShaderMaterial instances.
 */

// --- Shader Definitions (GLSL Code Strings) ---

/**
 * Vertex shader for elevation-based coloring.
 * Passes elevation (original Z position) and view-space normal to the fragment shader.
 */
export const elevationVertexShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    void main() { 
        vElevation = position.z; 
        vNormal = normalize(normalMatrix * normal); // Transform normal to view space
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
    }
`;

/**
 * Fragment shader for coloring terrain based on elevation with a color ramp.
 * Also applies basic Lambertian diffuse and ambient lighting.
 */
export const colorElevationFragmentShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    uniform float minElevation; 
    uniform float maxElevation; 
    uniform vec3 uDirectionalLightDirection; // In view space
    uniform vec3 uDirectionalLightColor; 
    uniform vec3 uAmbientLightColor; 

    // Helper function to generate a color based on a normalized value (t from 0 to 1)
    // Maps: Blue (low) -> Green -> Yellow -> Red (high)
    vec3 colorRamp(float t) { 
        vec3 c1 = vec3(0.0, 0.0, 1.0); // Blue
        vec3 c2 = vec3(0.0, 1.0, 0.0); // Green
        vec3 c3 = vec3(1.0, 1.0, 0.0); // Yellow
        vec3 c4 = vec3(1.0, 0.0, 0.0); // Red

        if(t < 0.0) t = 0.0; 
        if(t > 1.0) t = 1.0; 

        if(t < 0.33) return mix(c1, c2, t / 0.33); 
        if(t < 0.66) return mix(c2, c3, (t - 0.33) / 0.33); 
        return mix(c3, c4, (t - 0.66) / 0.34); 
    } 

    void main() { 
        vec3 baseColor; 
        if(maxElevation == minElevation){ // Handle flat terrain to avoid division by zero
            baseColor = vec3(0.5, 0.5, 0.5); // Default gray
        } else { 
            float normalizedElevation = (vElevation - minElevation) / (maxElevation - minElevation);
            baseColor = colorRamp(normalizedElevation); 
        } 
        
        // Basic lighting calculation
        vec3 norm = normalize(vNormal); 
        float dotNL = max(dot(norm, normalize(uDirectionalLightDirection)), 0.0); // Diffuse factor
        vec3 diffuse = uDirectionalLightColor * dotNL; 
        
        vec3 finalColor = baseColor * (uAmbientLightColor + diffuse); // Combine base color with lighting
        gl_FragColor = vec4(finalColor, 1.0); 
    }
`;

/**
 * Fragment shader for coloring terrain in grayscale based on elevation.
 * Also applies basic Lambertian diffuse and ambient lighting.
 */
export const grayElevationFragmentShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    uniform float minElevation; 
    uniform float maxElevation; 
    uniform vec3 uDirectionalLightDirection; // In view space
    uniform vec3 uDirectionalLightColor; 
    uniform vec3 uAmbientLightColor; 

    void main() { 
        vec3 baseColor; 
        if(maxElevation == minElevation){ // Handle flat terrain
            baseColor = vec3(0.5, 0.5, 0.5); 
        } else { 
            float normalizedElevation = (vElevation - minElevation) / (maxElevation - minElevation); 
            normalizedElevation = clamp(normalizedElevation, 0.0, 1.0); // Ensure value is between 0 and 1
            baseColor = vec3(normalizedElevation, normalizedElevation, normalizedElevation); // Grayscale
        } 
        
        // Basic lighting calculation
        vec3 norm = normalize(vNormal); 
        float dotNL = max(dot(norm, normalize(uDirectionalLightDirection)), 0.0); 
        vec3 diffuse = uDirectionalLightColor * dotNL; 
        
        vec3 finalColor = baseColor * (uAmbientLightColor + diffuse); 
        gl_FragColor = vec4(finalColor, 1.0); 
    }
`;


/**
 * Creates a ShaderMaterial for coloring by elevation.
 * @param {object} uniforms - Object containing minElevation, maxElevation, and light uniforms.
 * @returns {THREE.ShaderMaterial}
 */
export function createColorElevationShaderMaterial(uniforms) {
    return new THREE.ShaderMaterial({
        vertexShader: elevationVertexShader,
        fragmentShader: colorElevationFragmentShader,
        uniforms: THREE.UniformsUtils.clone(uniforms), // Clone to ensure each mesh gets its own uniform instances
        lights: true // Important if merging THREE.UniformsLib.lights (though not strictly needed with current manual light uniforms)
    });
}

/**
 * Creates a ShaderMaterial for grayscale coloring by elevation.
 * @param {object} uniforms - Object containing minElevation, maxElevation, and light uniforms.
 * @returns {THREE.ShaderMaterial}
 */
export function createGrayElevationShaderMaterial(uniforms) {
    return new THREE.ShaderMaterial({
        vertexShader: elevationVertexShader,
        fragmentShader: grayElevationFragmentShader,
        uniforms: THREE.UniformsUtils.clone(uniforms),
        lights: true
    });
}

/**
 * Creates a default MeshStandardMaterial.
 * @returns {THREE.MeshStandardMaterial}
 */
export function createDefaultDemMaterial() {
    return new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        flatShading: false 
        // Add other PBR properties here if desired (e.g., roughness, metalness)
    });
}
