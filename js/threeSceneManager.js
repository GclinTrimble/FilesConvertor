// js/threeSceneManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from './appState.js'; 
import { uiElements, setStatusMessage } from './uiManager.js'; 
// import { updateDemMaterial } from './materialManager.js'; // Not needed here directly

/**
 * @file Manages the Three.js scene, camera, renderer, lighting, controls,
 * and the main animation loop. Also handles mouse interactions on the canvas and an orientation cube.
 */

// --- Main Scene Components ---
let scene, camera, renderer, controls;
let directionalLight, ambientLight;

// --- Orientation Cube Components ---
let cubeScene, cubeCamera, orientationCube;
const CUBE_SIZE = 50; // Size of the orientation cube in pixels on screen
const CUBE_MARGIN = 10; // Margin from the corner of the screen

// --- Mouse Interaction & Raycasting ---
let raycaster; 
const pointer = new THREE.Vector2(); 

// --- Utility Vectors (reused to avoid allocations) ---
const lightWorldDirection = new THREE.Vector3();
const viewSpaceLightDirection = new THREE.Vector3();

/**
 * Initializes the core Three.js components: main scene, camera, renderer, controls, lighting,
 * and the secondary scene/camera/mesh for the orientation cube.
 * Also sets up essential event listeners for interactivity on the canvas.
 * @param {HTMLElement} canvasContainerDOM - The HTML element where the canvas will be appended.
 */
export function initScene(canvasContainerDOM) {
    // --- Main Scene Setup ---
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x2d3748); 

    camera = new THREE.PerspectiveCamera(
        75, 
        canvasContainerDOM.clientWidth / canvasContainerDOM.clientHeight, 
        0.1, 
        100000 
    );
    camera.position.set(0, -200, 200); 
    camera.up.set(0, 0, 1); // Z-axis is "up"

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setSize(canvasContainerDOM.clientWidth, canvasContainerDOM.clientHeight);
    renderer.autoClear = false; // We will manually clear for multi-scene rendering
    canvasContainerDOM.appendChild(renderer.domElement); 

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.minPolarAngle = 0; 
    controls.maxPolarAngle = Math.PI * 0.495; 

    ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambientLight);
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.7); 
    directionalLight.position.set(70, 70, 70); 
    scene.add(directionalLight); 
            
    raycaster = new THREE.Raycaster(); 

    // --- Orientation Cube Setup ---
    cubeScene = new THREE.Scene();
    const aspect = 1; 
    cubeCamera = new THREE.OrthographicCamera(
        -CUBE_SIZE / 2 * aspect, CUBE_SIZE / 2 * aspect, 
        CUBE_SIZE / 2, -CUBE_SIZE / 2, 
        0.1, 1000
    );
    cubeCamera.position.z = 100; 
    cubeCamera.up.set(0,0,1); 

    const cubeGeometry = new THREE.BoxGeometry(30, 30, 30); 
    const cubeMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }), // Right (+X, Red)
        new THREE.MeshBasicMaterial({ color: 0x800000, side: THREE.DoubleSide }), // Left (-X, Dark Red)
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide }), // Back (+Y, Green)
        new THREE.MeshBasicMaterial({ color: 0x008000, side: THREE.DoubleSide }), // Front (-Y, Dark Green)
        new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide }), // Top (+Z, Blue)
        new THREE.MeshBasicMaterial({ color: 0x000080, side: THREE.DoubleSide })  // Bottom (-Z, Dark Blue)
    ];
    orientationCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
    cubeScene.add(orientationCube);
    const cubeLight = new THREE.AmbientLight(0xffffff, 1.0);
    cubeScene.add(cubeLight);

    renderer.domElement.addEventListener('click', onCanvasClick, false);
    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onCanvasMouseDown, false);
    renderer.domElement.addEventListener('wheel', onCanvasWheel, { passive: false });

    window.addEventListener('resize', onWindowResize, false); 
    
    animate(); 
    setTimeout(onWindowResize, 0); 
    console.log("Three.js scene and orientation cube initialized.");
}

/**
 * Handles window resize events. Updates aspect ratios and sizes for both main and cube cameras/renderers.
 */
function onWindowResize() {
    if (!renderer || !camera || !uiElements.canvasContainer) return; 
    const mainCanvasWidth = uiElements.canvasContainer.clientWidth; 
    const mainCanvasHeight = uiElements.canvasContainer.clientHeight;

    if (mainCanvasWidth > 0 && mainCanvasHeight > 0) {
        camera.aspect = mainCanvasWidth / mainCanvasHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mainCanvasWidth, mainCanvasHeight);
        console.log("Canvas resized:", mainCanvasWidth, mainCanvasHeight);
    }
}

/**
 * The main animation/rendering loop.
 * Renders the main scene, then renders the orientation cube in a corner.
 */
function animate() {
    requestAnimationFrame(animate); 
    controls.update(); // Crucial for damping and applying any programmatic changes to controls or camera

    if (directionalLight && camera && state.loadedDEMs.length > 0) {
        directionalLight.getWorldDirection(lightWorldDirection); 
        lightWorldDirection.negate(); 
        viewSpaceLightDirection.copy(lightWorldDirection).transformDirection(camera.matrixWorldInverse).normalize();
        
        state.loadedDEMs.forEach(demEntry => {
            if (demEntry.isVisible && demEntry.mesh && demEntry.mesh.material instanceof THREE.ShaderMaterial) {
                const uniforms = demEntry.mesh.material.uniforms;
                if (uniforms && uniforms.uDirectionalLightDirection && uniforms.uDirectionalLightDirection.value instanceof THREE.Vector3) {
                    uniforms.uDirectionalLightDirection.value.copy(viewSpaceLightDirection);
                }
                if (uniforms && uniforms.uAmbientLightColor && uniforms.uAmbientLightColor.value instanceof THREE.Color && ambientLight) {
                     uniforms.uAmbientLightColor.value.copy(ambientLight.color).multiplyScalar(ambientLight.intensity);
                }
                 if (uniforms && uniforms.uDirectionalLightColor && uniforms.uDirectionalLightColor.value instanceof THREE.Color && directionalLight) {
                    uniforms.uDirectionalLightColor.value.copy(directionalLight.color).multiplyScalar(directionalLight.intensity);
                }
            }
        });
    }

    renderer.clear(); 
    renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height); 
    renderer.render(scene, camera); 

    renderer.clearDepth(); 

    const mainCanvasWidth = renderer.domElement.width;
    const mainCanvasHeight = renderer.domElement.height;
    renderer.setViewport(
        mainCanvasWidth - CUBE_SIZE - CUBE_MARGIN, 
        mainCanvasHeight - CUBE_SIZE - CUBE_MARGIN, 
        CUBE_SIZE,  
        CUBE_SIZE   
    );

    if (orientationCube) {
        orientationCube.quaternion.copy(camera.quaternion).invert(); 
    }
    
    renderer.render(cubeScene, cubeCamera); 
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
            // REMOVED: controls.update(); // Let OrbitControls internal handlers and animate loop handle update.
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
        // REMOVED: controls.update(); // Let OrbitControls internal handlers and animate loop handle update.
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
    // An explicit controls.update() here might be useful if centerView is called
    // and an immediate visual update is desired without waiting for the next animate frame or user interaction.
    // However, for now, we rely on the animate loop's update.
    // If jiggles persist after *this* function, then adding controls.update() here might be the next step.
}

// --- Getters for other modules to access scene components if necessary ---
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getAmbientLight() { return ambientLight; }
export function getDirectionalLight() { return directionalLight; }