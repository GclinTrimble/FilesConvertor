// js/threeSceneManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; 
import { state } from './appState.js'; 
import { uiElements, setStatusMessage } from './uiManager.js'; 

/**
 * @file Manages the Three.js scene, camera, renderer, lighting, OrbitControls,
 * and the main animation loop. Also handles mouse interactions on the canvas,
 * an orientation cube, and visualization of raindrop paths.
 */

let scene, camera, renderer, controls; 
let directionalLight, ambientLight;
let cubeScene, cubeCamera, orientationCube;
const CUBE_SIZE = 50; 
const CUBE_MARGIN = 10; 
let raycaster; 
const pointer = new THREE.Vector2(); 
let raindropPathLineObjects = []; 
const lightWorldDirection = new THREE.Vector3();
const viewSpaceLightDirection = new THREE.Vector3();

/**
 * Initializes the core Three.js components and OrbitControls navigation.
 * @param {HTMLElement} canvasContainerDOM - The HTML element for the canvas.
 * @param {function} onPrimaryCanvasClickCallback - Callback function from main.js to handle primary canvas clicks. 
 * It will receive intersectionData as an argument.
 */
export function initScene(canvasContainerDOM, onPrimaryCanvasClickCallback) {
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x2d3748); 

    camera = new THREE.PerspectiveCamera( 75, canvasContainerDOM.clientWidth / canvasContainerDOM.clientHeight, 0.1, 100000 );
    camera.position.set(0, -200, 200); 
    camera.up.set(0, 0, 1); 

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setSize(canvasContainerDOM.clientWidth, canvasContainerDOM.clientHeight);
    renderer.autoClear = false; 
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

    cubeScene = new THREE.Scene();
    const aspect = 1; 
    cubeCamera = new THREE.OrthographicCamera(-CUBE_SIZE/2*aspect, CUBE_SIZE/2*aspect, CUBE_SIZE/2, -CUBE_SIZE/2, 0.1, 1000);
    cubeCamera.position.z = 100; 
    cubeCamera.up.set(0,0,1); 
    const cubeGeometry = new THREE.BoxGeometry(30, 30, 30); 
    const cubeMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0x800000, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0x008000, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0x0000ff, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: 0x000080, side: THREE.DoubleSide })
    ];
    orientationCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
    cubeScene.add(orientationCube);
    const cubeLight = new THREE.AmbientLight(0xffffff, 1.0);
    cubeScene.add(cubeLight);

    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onCanvasMouseDown, false); 
    renderer.domElement.addEventListener('wheel', onCanvasWheel, { passive: false }); 

    // Attach the primary click handler passed from main.js
    if (onPrimaryCanvasClickCallback && typeof onPrimaryCanvasClickCallback === 'function') {
        renderer.domElement.addEventListener('click', (event) => {
            const intersectionData = getCanvasClickIntersectionAndDem(event); // Perform raycast
            onPrimaryCanvasClickCallback(intersectionData); // Call main.js handler with result
        }, false);
        console.log("[ThreeSceneManager] Primary canvas click listener (from main.js) attached to renderer.domElement.");
    } else {
        console.warn("[ThreeSceneManager] No valid onPrimaryCanvasClickCallback provided during initScene.");
    }

    window.addEventListener('resize', onWindowResize, false); 
    
    animate(); 
    setTimeout(onWindowResize, 0); 
    console.log("Three.js scene initialized with OrbitControls.");
}

function onWindowResize() {
    if (!renderer || !camera || !uiElements.canvasContainer) return; 
    const mainCanvasWidth = uiElements.canvasContainer.clientWidth; 
    const mainCanvasHeight = uiElements.canvasContainer.clientHeight;
    if (mainCanvasWidth > 0 && mainCanvasHeight > 0) {
        camera.aspect = mainCanvasWidth / mainCanvasHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mainCanvasWidth, mainCanvasHeight);
    }
}

function animate() {
    requestAnimationFrame(animate); 
    controls.update(); 
    if (directionalLight && camera && state.loadedDEMs.length > 0) {
        directionalLight.getWorldDirection(lightWorldDirection); 
        lightWorldDirection.negate(); 
        viewSpaceLightDirection.copy(lightWorldDirection).transformDirection(camera.matrixWorldInverse).normalize();
        state.loadedDEMs.forEach(demEntry => {
            if (demEntry.isVisible && demEntry.mesh && demEntry.mesh.material instanceof THREE.ShaderMaterial) {
                const uniforms = demEntry.mesh.material.uniforms;
                if (uniforms?.uDirectionalLightDirection?.value instanceof THREE.Vector3) {
                    uniforms.uDirectionalLightDirection.value.copy(viewSpaceLightDirection);
                }
                if (uniforms?.uAmbientLightColor?.value instanceof THREE.Color && ambientLight) {
                     uniforms.uAmbientLightColor.value.copy(ambientLight.color).multiplyScalar(ambientLight.intensity);
                }
                 if (uniforms?.uDirectionalLightColor?.value instanceof THREE.Color && directionalLight) {
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
    renderer.setViewport( mainCanvasWidth - CUBE_SIZE - CUBE_MARGIN, mainCanvasHeight - CUBE_SIZE - CUBE_MARGIN, CUBE_SIZE, CUBE_SIZE );
    if (orientationCube) orientationCube.quaternion.copy(camera.quaternion).invert(); 
    renderer.render(cubeScene, cubeCamera); 
}

function updatePointerFromEvent(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

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
        
function onCanvasMouseDown(event) {
    updatePointerFromEvent(event); 
    raycaster.setFromCamera(pointer, camera);
    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    if (visibleMeshes.length > 0) {
        const intersects = raycaster.intersectObjects(visibleMeshes);
        if (intersects.length > 0) {
            if (!state.lastMouseIntersectionPoint) state.lastMouseIntersectionPoint = new THREE.Vector3();
            state.lastMouseIntersectionPoint.copy(intersects[0].point);
            if (controls) { 
                 if ( (event.button === controls.mouseButtons.LEFT && controls.enableRotate) ||
                     (event.button === controls.mouseButtons.MIDDLE && controls.enablePan) ||
                     (event.button === controls.mouseButtons.RIGHT && controls.enablePan) ) {
                    controls.target.copy(state.lastMouseIntersectionPoint);
                }
            }
        }
    }
}

function onCanvasWheel(event) {
    if (state.lastMouseIntersectionPoint && controls && controls.enableZoom) {
        controls.target.copy(state.lastMouseIntersectionPoint);
    }
}

/**
 * Performs raycasting from the mouse click position to find intersections with DEMs.
 * Returns the closest intersection object and the associated demEntry.
 * This function is EXPORTED and called by main.js (via the callback in initScene).
 * @param {MouseEvent} event - The mouse click event.
 * @returns {{intersection: THREE.Intersection, demEntry: object}|null} 
 * An object with the intersection and demEntry, or null if no valid intersection.
 */
export function getCanvasClickIntersectionAndDem(event) {
    console.log("[ThreeSceneManager] getCanvasClickIntersectionAndDem called with event:", event); 
    updatePointerFromEvent(event); 
    console.log("[ThreeSceneManager] Pointer updated:", pointer.x, pointer.y); 
    
    if (!camera) {
        console.error("[ThreeSceneManager] Camera is not initialized for raycasting.");
        return null;
    }
    raycaster.setFromCamera(pointer, camera);

    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    console.log("[ThreeSceneManager] Number of visible meshes for raycasting:", visibleMeshes.length); 
    if (visibleMeshes.length === 0) return null;

    const intersects = raycaster.intersectObjects(visibleMeshes);
    console.log("[ThreeSceneManager] Raycaster intersections found:", intersects.length); 

    if (intersects.length > 0) {
        const intersection = intersects[0]; 
        console.log("[ThreeSceneManager] Closest intersection object name:", intersection.object.name); 
        console.log("[ThreeSceneManager] Closest intersection userData:", intersection.object.userData); 
        
        const demEntry = intersection.object.userData.demEntry; 
        if (demEntry) {
            console.log("[ThreeSceneManager] Found demEntry in userData:", demEntry.name); 
            return { intersection, demEntry };
        } else {
            console.warn("[ThreeSceneManager] Intersected mesh does not have demEntry in userData.", intersection.object);
        }
    }
    return null;
}

export function addMeshToScene(mesh) { if (scene && mesh) scene.add(mesh); }
export function removeMeshFromScene(mesh) { if (scene && mesh) scene.remove(mesh); }

export function centerView() {
    const visibleMeshes = state.loadedDEMs.filter(dem => dem.isVisible).map(dem => dem.mesh);
    const targetPointForSync = new THREE.Vector3(); 
    if (visibleMeshes.length === 0) { 
        camera.position.set(0, -200, 200); 
        if (controls) controls.target.set(0,0,0); 
        targetPointForSync.set(0,0,0);
    } else {
        const overallBoundingBox = new THREE.Box3();
        visibleMeshes.forEach((mesh, index) => {
            mesh.updateMatrixWorld(); 
            const meshBoundingBox = new THREE.Box3().setFromObject(mesh, true); 
            if (index === 0) overallBoundingBox.copy(meshBoundingBox); 
            else overallBoundingBox.union(meshBoundingBox);
        });
        if (overallBoundingBox.isEmpty()) {
             camera.position.set(0, -200, 200); 
             if (controls) controls.target.set(0,0,0); 
             targetPointForSync.set(0,0,0);
        } else {
            const center = overallBoundingBox.getCenter(new THREE.Vector3()); 
            const size = overallBoundingBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim === 0 || !isFinite(maxDim)) { 
                camera.position.set(0, -200, 200); 
                if (controls) controls.target.set(0,0,0); 
                targetPointForSync.set(0,0,0);
            } else {
                const fov = camera.fov * (Math.PI / 180);
                const largerXYDim = Math.max(size.x, size.y);
                let cameraDistance = Math.abs(largerXYDim / 2 / Math.tan(fov / 2));
                cameraDistance = Math.max(cameraDistance, size.z); 
                cameraDistance *= 1.5; 
                camera.position.set(center.x, center.y - cameraDistance * 0.707, center.z + cameraDistance * 0.707); 
                if (controls) controls.target.copy(center); 
                targetPointForSync.copy(center);
            }
        }
    }
    if (!state.lastMouseIntersectionPoint) state.lastMouseIntersectionPoint = new THREE.Vector3();
    state.lastMouseIntersectionPoint.copy(targetPointForSync);
    if (controls) controls.update(); 
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getAmbientLight() { return ambientLight; }
export function getDirectionalLight() { return directionalLight; }

export function addPathLineVisual(pathPoints, colorHex = 0x007bff) {
    if (!scene || !pathPoints || pathPoints.length < 2) {
        console.warn("Path too short to draw a line or scene not available.");
        return null;
    }
    const material = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 }); 
    const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    raindropPathLineObjects.push(line); 
    console.log("Added path line to scene with points:", pathPoints.length);
    return line;
}

export function clearAllPathLineVisuals() {
    if (!scene) return;
    raindropPathLineObjects.forEach(line => {
        scene.remove(line);
        if(line.geometry) line.geometry.dispose(); 
        if(line.material) line.material.dispose(); 
    });
    raindropPathLineObjects = []; 
    console.log("Cleared all raindrop path lines.");
}
