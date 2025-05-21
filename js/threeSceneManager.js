// js/threeSceneManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from './appState.js'; // To access loadedDEMs for raycasting, centering
import { uiElements, setStatusMessage } from './uiManager.js'; // For canvas container and status messages
import { updateDemMaterial } from './materialManager.js'; // Will create this file next


/**
 * @file Manages the Three.js scene, camera, renderer, lighting, controls,
 * and the main animation loop. Also handles mouse interactions on the canvas.
 */

// --- Scope-Specific Variables ---
// These are specific to the Three.js scene management module.
let scene, camera, renderer, controls;
let directionalLight, ambientLight;
let raycaster; // For mouse picking
const pointer = new THREE.Vector2(); // Normalized mouse coordinates

// Temporary vectors for calculations to avoid re-allocation in loops (performance)
const lightWorldDirection = new THREE.Vector3();
const viewSpaceLightDirection = new THREE.Vector3();

/**
 * Initializes the core Three.js components: scene, camera, renderer, controls, and lighting.
 * Also sets up essential event listeners for interactivity on the canvas.
 * @param {HTMLElement} canvasContainerDOM - The HTML element where the canvas will be appended.
 */
export function initScene(canvasContainerDOM) {
    // Create the main scene container
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x2d3748); // Dark gray background

    // Set up the perspective camera
    camera = new THREE.PerspectiveCamera(
        75, // Field of View (degrees)
        canvasContainerDOM.clientWidth / canvasContainerDOM.clientHeight, // Aspect ratio
        0.1, // Near clipping plane
        100000 // Far clipping plane (large enough for extensive terrains)
    );
    camera.position.set(0, -200, 200); // Initial camera position (looking somewhat down, Z-up)
    camera.up.set(0, 0, 1); // IMPORTANT: Define Z-axis as "up" for the camera and OrbitControls

    // Set up the WebGL renderer
    renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias for smoother edges
    renderer.setSize(canvasContainerDOM.clientWidth, canvasContainerDOM.clientHeight);
    canvasContainerDOM.appendChild(renderer.domElement); // Add the renderer's <canvas> to the HTML

    // Set up OrbitControls for camera navigation
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Makes camera movement smoother
    controls.dampingFactor = 0.05; // How much damping to apply
    controls.minPolarAngle = 0; // Allow looking straight down
    controls.maxPolarAngle = Math.PI * 0.495; // Restrict looking too far up (prevents camera flipping under terrain)
    // The initial target will be (0,0,0) or updated by centering/mouse interaction.

    // Add lighting
    ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); 
    directionalLight.position.set(50, 50, 50); 
    scene.add(directionalLight); 
            
    raycaster = new THREE.Raycaster(); // Initialize raycaster for mouse picking

    // Attach event listeners for canvas interactivity
    renderer.domElement.addEventListener('click', onCanvasClick, false);
    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onCanvasMouseDown, false);
    renderer.domElement.addEventListener('wheel', onCanvasWheel, { passive: false });

    window.addEventListener('resize', onWindowResize, false); // Handle window resizing
    
    animate(); // Start the rendering loop
    setTimeout(onWindowResize, 0); // Ensure initial canvas size is correct
    console.log("Three.js scene initialized.");
}

/**
 * Handles window resize events. Updates the camera's aspect ratio and the renderer's size.
 */
function onWindowResize() {
    if (!renderer || !camera || !uiElements.canvasContainer) return; 
    const newWidth = uiElements.canvasContainer.clientWidth; 
    const newHeight = uiElements.canvasContainer.clientHeight;
    if (newWidth > 0 && newHeight > 0) {
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
        console.log("Canvas resized:", newWidth, newHeight);
    }
}

/**
 * The main animation/rendering loop.
 */
function animate() {
    requestAnimationFrame(animate); 
    controls.update(); // Required if enableDamping is true

    // Update lighting uniforms for custom shaders
    if (directionalLight && camera && state.loadedDEMs.length > 0) {
        directionalLight.getWorldDirection(lightWorldDirection); 
        lightWorldDirection.negate(); 
        viewSpaceLightDirection.copy(lightWorldDirection).transformDirection(camera.matrixWorldInverse).normalize();
        
        state.loadedDEMs.forEach(demEntry => {
            if (demEntry.isVisible && demEntry.mesh && demEntry.mesh.material instanceof THREE.ShaderMaterial) {
                if (demEntry.mesh.material.uniforms.uDirectionalLightDirection) {
                    demEntry.mesh.material.uniforms.uDirectionalLightDirection.value.copy(viewSpaceLightDirection);
                }
                // Update light color uniforms if they can change dynamically
                if (demEntry.mesh.material.uniforms.uAmbientLightColor && ambientLight) {
                     demEntry.mesh.material.uniforms.uAmbientLightColor.value.copy(ambientLight.color).multiplyScalar(ambientLight.intensity);
                }
                 if (demEntry.mesh.material.uniforms.uDirectionalLightColor && directionalLight) {
                    demEntry.mesh.material.uniforms.uDirectionalLightColor.value.copy(directionalLight.color).multiplyScalar(directionalLight.intensity);
                }
            }
        });
    }
    renderer.render(scene, camera);
}

/**
 * Updates the 'pointer' Vector2 with normalized mouse coordinates.
 * @param {MouseEvent} event - The mouse event.
 */
function updatePointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/**
 * Handles mouse move events on the canvas for cursor-centric navigation.
 * @param {MouseEvent} event - The mouse move event.
 */
function onCanvasMouseMove(event) {
    updatePointerFromEvent(event); 
    raycaster.setFromCamera(pointer, camera);
    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    if (visibleMeshes.length > 0) {
        const intersects = raycaster.intersectObjects(visibleMeshes);
        if (intersects.length > 0) {
            if (!state.lastMouseIntersectionPoint) state.lastMouseIntersectionPoint = new THREE.Vector3();
            state.lastMouseIntersectionPoint.copy(intersects[0].point);
        }
    }
}
        
/**
 * Handles mouse down events on the canvas to set OrbitControls target.
 * @param {MouseEvent} event - The mouse down event.
 */
function onCanvasMouseDown(event) {
    if (state.lastMouseIntersectionPoint && controls) {
        if ( (event.button === controls.mouseButtons.LEFT && controls.enableRotate) ||
             (event.button === controls.mouseButtons.MIDDLE && controls.enablePan) ||
             (event.button === controls.mouseButtons.RIGHT && controls.enablePan) ) {
            controls.target.copy(state.lastMouseIntersectionPoint);
        }
    }
}

/**
 * Handles mouse wheel events on the canvas to set OrbitControls target for zoom.
 * @param {WheelEvent} event - The mouse wheel event.
 */
function onCanvasWheel(event) {
    if (state.lastMouseIntersectionPoint && controls && controls.enableZoom) {
        controls.target.copy(state.lastMouseIntersectionPoint);
    }
}

/**
 * Handles click events on the canvas to display coordinates.
 * @param {MouseEvent} event - The click event.
 */
function onCanvasClick(event) {
    updatePointerFromEvent(event); 
    raycaster.setFromCamera(pointer, camera);
    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    if (visibleMeshes.length === 0) return;
    const intersects = raycaster.intersectObjects(visibleMeshes);
    if (intersects.length > 0) {
        const intersect = intersects[0]; 
        const point = intersect.point;
        const demName = state.loadedDEMs.find(d => d.mesh === intersect.object)?.name || "Unknown DEM";
        setStatusMessage(`Clicked on ${demName}: X: ${point.x.toFixed(2)}, Y: ${point.y.toFixed(2)}, Z (Elevation): ${point.z.toFixed(2)}`);
    } else {
        setStatusMessage("No terrain clicked. Click on terrain for coordinates.");
    }
}

/**
 * Adds a DEM mesh to the Three.js scene.
 * @param {THREE.Mesh} mesh - The mesh to add.
 */
export function addMeshToScene(mesh) {
    if (scene && mesh) {
        scene.add(mesh);
    }
}

/**
 * Removes a DEM mesh from the Three.js scene.
 * @param {THREE.Mesh} mesh - The mesh to remove.
 */
export function removeMeshFromScene(mesh) {
    if (scene && mesh) {
        scene.remove(mesh);
        // It's good practice to also dispose of geometry and material if the mesh is permanently removed
        // and not just hidden, to free up GPU memory. This might be handled elsewhere
        // when a DEM is fully "deleted" rather than just hidden.
        // if (mesh.geometry) mesh.geometry.dispose();
        // if (mesh.material) {
        //     if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        //     else mesh.material.dispose();
        // }
    }
}


/**
 * Centers the camera view to encompass all currently visible DEMs.
 */
export function centerView() {
    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    const targetPointForSync = new THREE.Vector3(); 

    if (visibleMeshes.length === 0) { 
        camera.position.set(0, -200, 200); 
        controls.target.set(0,0,0); 
        targetPointForSync.set(0,0,0);
    } else {
        const overallBoundingBox = new THREE.Box3();
        visibleMeshes.forEach((mesh, index) => {
            mesh.updateMatrixWorld(); 
            const meshBoundingBox = new THREE.Box3().setFromObject(mesh, true); 
            if (index === 0) {
                overallBoundingBox.copy(meshBoundingBox);
            } else {
                overallBoundingBox.union(meshBoundingBox);
            }
        });

        if (overallBoundingBox.isEmpty()) {
             camera.position.set(0, -200, 200); 
             controls.target.set(0,0,0); 
             targetPointForSync.set(0,0,0);
        } else {
            const center = overallBoundingBox.getCenter(new THREE.Vector3()); 
            const size = overallBoundingBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            if (maxDim === 0 || !isFinite(maxDim)) { 
                camera.position.set(0, -200, 200); 
                controls.target.set(0,0,0); 
                targetPointForSync.set(0,0,0);
            } else {
                const fov = camera.fov * (Math.PI / 180);
                const largerXYDim = Math.max(size.x, size.y);
                let cameraDistance = Math.abs(largerXYDim / 2 / Math.tan(fov / 2));
                cameraDistance = Math.max(cameraDistance, size.z); 
                cameraDistance *= 1.5; 

                camera.position.set(center.x, center.y - cameraDistance * 0.707, center.z + cameraDistance * 0.707); 
                controls.target.copy(center); 
                targetPointForSync.copy(center);
            }
        }
    }
    if (!state.lastMouseIntersectionPoint) state.lastMouseIntersectionPoint = new THREE.Vector3();
    state.lastMouseIntersectionPoint.copy(targetPointForSync);
    // controls.update() will be called by the animate loop
}

/**
 * Gets the current scene instance.
 * @returns {THREE.Scene} The Three.js scene.
 */
export function getScene() {
    return scene;
}

/**
 * Gets the current camera instance.
 * @returns {THREE.PerspectiveCamera} The Three.js camera.
 */
export function getCamera() {
    return camera;
}

/**
 * Gets the ambient light instance.
 * @returns {THREE.AmbientLight}
 */
export function getAmbientLight() {
    return ambientLight;
}

/**
 * Gets the directional light instance.
 * @returns {THREE.DirectionalLight}
 */
export function getDirectionalLight() {
    return directionalLight;
}
