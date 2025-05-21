// js/shaderManager.js
import * as THREE from 'three';

/**
 * @file Manages GLSL shader code and creation of Three.js ShaderMaterial instances.
 */

// --- Shader Definitions (GLSL Code Strings) ---
export const elevationVertexShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    void main() { 
        vElevation = position.z; 
        vNormal = normalize(normalMatrix * normal); 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); 
    }
`;

export const colorElevationFragmentShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    uniform float minElevation; 
    uniform float maxElevation; 
    uniform vec3 uDirectionalLightDirection; 
    uniform vec3 uDirectionalLightColor; 
    uniform vec3 uAmbientLightColor; 
    vec3 colorRamp(float t) { 
        vec3 c1=vec3(0.0,0.0,1.0); vec3 c2=vec3(0.0,1.0,0.0); 
        vec3 c3=vec3(1.0,1.0,0.0); vec3 c4=vec3(1.0,0.0,0.0); 
        if(t<0.0) t=0.0; if(t>1.0) t=1.0; 
        if(t<0.33) return mix(c1,c2,t/0.33); 
        if(t<0.66) return mix(c2,c3,(t-0.33)/0.33); 
        return mix(c3,c4,(t-0.66)/0.34); 
    } 
    void main() { 
        vec3 baseColor; 
        if(maxElevation==minElevation){ baseColor=vec3(0.5,0.5,0.5); } 
        else { baseColor=colorRamp((vElevation-minElevation)/(maxElevation-minElevation)); } 
        vec3 norm=normalize(vNormal); 
        float dotNL=max(dot(norm,normalize(uDirectionalLightDirection)),0.0); 
        vec3 diffuse=uDirectionalLightColor*dotNL; 
        vec3 finalColor=baseColor*(uAmbientLightColor+diffuse); 
        gl_FragColor=vec4(finalColor,1.0); 
    }
`;

export const grayElevationFragmentShader = `
    varying float vElevation; 
    varying vec3 vNormal; 
    uniform float minElevation; 
    uniform float maxElevation; 
    uniform vec3 uDirectionalLightDirection; 
    uniform vec3 uDirectionalLightColor; 
    uniform vec3 uAmbientLightColor; 
    void main() { 
        vec3 baseColor; 
        if(maxElevation==minElevation){ baseColor=vec3(0.5,0.5,0.5); } 
        else { 
            float nE=(vElevation-minElevation)/(maxElevation-minElevation); 
            nE=clamp(nE,0.0,1.0); 
            baseColor=vec3(nE,nE,nE); 
        } 
        vec3 norm=normalize(vNormal); 
        float dotNL=max(dot(norm,normalize(uDirectionalLightDirection)),0.0); 
        vec3 diffuse=uDirectionalLightColor*dotNL; 
        vec3 finalColor=baseColor*(uAmbientLightColor+diffuse); 
        gl_FragColor=vec4(finalColor,1.0); 
    }
`;

/**
 * Creates a ShaderMaterial for coloring by elevation.
 * @param {object} initialUniforms - Object containing initial values for minElevation, maxElevation, and light uniforms.
 * @returns {THREE.ShaderMaterial}
 */
export function createColorElevationShaderMaterial(initialUniforms) {
    const clonedUniforms = THREE.UniformsUtils.clone(initialUniforms);
    console.log("[ShaderManager] Creating ColorElevationShaderMaterial with uniforms:", JSON.parse(JSON.stringify(clonedUniforms))); // Deep log for inspection
    
    return new THREE.ShaderMaterial({
        vertexShader: elevationVertexShader,
        fragmentShader: colorElevationFragmentShader,
        uniforms: clonedUniforms,
        // lights: true, // DEFINITELY REMOVE/KEEP REMOVED: We manage lighting uniforms manually.
    });
}

/**
 * Creates a ShaderMaterial for grayscale coloring by elevation.
 * @param {object} initialUniforms - Object containing initial values for minElevation, maxElevation, and light uniforms.
 * @returns {THREE.ShaderMaterial}
 */
export function createGrayElevationShaderMaterial(initialUniforms) {
    const clonedUniforms = THREE.UniformsUtils.clone(initialUniforms);
    console.log("[ShaderManager] Creating GrayElevationShaderMaterial with uniforms:", JSON.parse(JSON.stringify(clonedUniforms))); // Deep log for inspection

    return new THREE.ShaderMaterial({
        vertexShader: elevationVertexShader,
        fragmentShader: grayElevationFragmentShader,
        uniforms: clonedUniforms,
        // lights: true, // DEFINITELY REMOVE/KEEP REMOVED
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
    });
}
