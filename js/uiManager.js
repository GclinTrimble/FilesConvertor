// js/uiManager.js
import { state } from './appState.js';
import { exportIndividualDemGLB } from './exportManager.js'; // For individual export buttons

/**
 * @file Manages all direct interactions with the HTML DOM elements,
 * such as updating lists, messages, and handling UI control states.
 */

// Object to hold references to frequently accessed HTML elements
export const uiElements = {
    canvasContainer: null,
    fileInput: null,
    centerViewBtn: null,
    materialTypeSelect: null,
    statusMessage: null,
    loader: null,
    getAIDescriptionBtn: null,
    aiDescriptionPanel: null,
    aiDescriptionPanelContent: null,
    closeAIDescriptionBtn: null,
    demListUl: null,
    exportUnifiedBtn: null,
};

/**
 * Initializes the uiElements object by getting references to DOM elements.
 * Should be called once when the application starts.
 */
export function initDOMElements() {
    uiElements.canvasContainer = document.getElementById('canvasContainer');
    uiElements.fileInput = document.getElementById('fileInput');
    uiElements.centerViewBtn = document.getElementById('centerViewBtn');
    uiElements.materialTypeSelect = document.getElementById('materialType');
    uiElements.statusMessage = document.getElementById('statusMessage');
    uiElements.loader = document.getElementById('loader');
    uiElements.getAIDescriptionBtn = document.getElementById('getAIDescriptionBtn');
    uiElements.aiDescriptionPanel = document.getElementById('aiDescriptionPanel');
    uiElements.aiDescriptionPanelContent = document.getElementById('aiDescriptionPanelContent');
    uiElements.closeAIDescriptionBtn = document.getElementById('closeAIDescriptionBtn');
    uiElements.demListUl = document.getElementById('demList');
    uiElements.exportUnifiedBtn = document.getElementById('exportUnifiedBtn');

    // Initialize currentShadingMode from the select element's value
    if (uiElements.materialTypeSelect) {
        state.currentShadingMode = uiElements.materialTypeSelect.value;
    }
}

/**
 * Sets the text content of the status message area.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, styles the message as an error.
 */
export function setStatusMessage(message, isError = false) {
    if (uiElements.statusMessage) {
        uiElements.statusMessage.textContent = message;
        uiElements.statusMessage.style.color = isError ? 'red' : 'white'; // Basic error styling
    }
}

/**
 * Shows or hides the loading spinner.
 * @param {boolean} show - True to show the loader, false to hide it.
 */
export function showLoader(show) {
    if (uiElements.loader) {
        uiElements.loader.style.display = show ? 'block' : 'none';
    }
}

/**
 * Adds a DEM entry to the side panel list in the UI.
 * Includes the DEM name, a visibility checkbox, an export button, and its absolute origin coordinates.
 * @param {object} demEntry - The DEM entry object from appState.js (contains demData, mesh, etc.).
 * @param {function} onVisibilityToggle - Callback function when visibility checkbox changes.
 * Receives (demId, isVisible).
 */
export function addDemToPanelList(demEntry, onVisibilityToggle) {
    if (!uiElements.demListUl) return;

    const li = document.createElement('li'); 
    li.id = `item-${demEntry.id}`; // Unique ID for the list item
    
    const headerDiv = document.createElement('div'); 
    headerDiv.className = 'dem-item-header'; // For styling the top part of the list item
    
    const checkbox = document.createElement('input'); 
    checkbox.type = 'checkbox'; 
    checkbox.id = `vis-${demEntry.id}`; // Unique ID for checkbox
    checkbox.checked = demEntry.isVisible; // Set initial checked state
    checkbox.addEventListener('change', (e) => { 
        onVisibilityToggle(demEntry.id, e.target.checked); // Call the provided callback
    });

    const label = document.createElement('label'); 
    label.setAttribute('for', `vis-${demEntry.id}`); // Associate label with checkbox
    label.textContent = demEntry.name; 
    label.title = demEntry.name; // Show full name on hover if it's truncated
            
    const exportButton = document.createElement('button');
    exportButton.textContent = 'GLB';
    exportButton.className = 'export-btn-small'; // For styling
    exportButton.title = 'Export this DEM as GLB';
    exportButton.onclick = () => {
        setStatusMessage(`Exporting ${demEntry.name}...`);
        exportIndividualDemGLB(demEntry) // Call export function from exportManager
            .then(() => setStatusMessage(`Exported ${demEntry.name}.`))
            .catch(err => {
                console.error("Individual export error:", err);
                setStatusMessage(`Error exporting ${demEntry.name}. See console.`, true);
            });
    };

    // Assemble the header part of the list item
    headerDiv.appendChild(checkbox);
    headerDiv.appendChild(label);
    headerDiv.appendChild(exportButton);
    li.appendChild(headerDiv);
    
    // Add a div to display the absolute origin coordinates of this DEM/chunk
    const coordsDiv = document.createElement('div');
    coordsDiv.className = 'dem-item-coords';
    // Displaying the original absolute xllcorner/yllcorner from the header of this specific DEM/chunk
    coordsDiv.textContent = `Origin (abs): X: ${demEntry.demData.header.xllcorner.toFixed(2)}, Y: ${demEntry.demData.header.yllcorner.toFixed(2)}`;
    li.appendChild(coordsDiv);
    
    uiElements.demListUl.appendChild(li); // Add the new list item to the panel
}

/**
 * Clears all items from the DEM list panel.
 */
export function clearDemListPanel() {
    if (uiElements.demListUl) {
        uiElements.demListUl.innerHTML = '';
    }
}

/**
 * Enables or disables UI controls typically active when DEMs are loaded.
 * @param {boolean} enable - True to enable, false to disable.
 */
export function setDemControlsEnabled(enable) {
    if (uiElements.centerViewBtn) uiElements.centerViewBtn.disabled = !enable;
    if (uiElements.materialTypeSelect) uiElements.materialTypeSelect.disabled = !enable;
    if (uiElements.getAIDescriptionBtn) uiElements.getAIDescriptionBtn.disabled = !enable;
    if (uiElements.exportUnifiedBtn) uiElements.exportUnifiedBtn.disabled = !enable;
}

/**
 * Shows the AI description panel with the provided content.
 * @param {string} contentHTML - HTML content to display (can include loading message).
 */
export function showAIDescriptionPanel(contentHTML) {
    if (uiElements.aiDescriptionPanelContent) uiElements.aiDescriptionPanelContent.innerHTML = contentHTML;
    if (uiElements.aiDescriptionPanel) uiElements.aiDescriptionPanel.style.display = 'block';
}

/**
 * Hides the AI description panel.
 */
export function hideAIDescriptionPanel() {
    if (uiElements.aiDescriptionPanel) uiElements.aiDescriptionPanel.style.display = 'none';
}
