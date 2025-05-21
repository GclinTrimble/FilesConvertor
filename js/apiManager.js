// js/apiManager.js
// No direct UI imports needed here, it will return data or throw errors.

/**
 * @file Manages calls to external APIs, specifically the Gemini API for terrain descriptions.
 */

/**
 * Fetches an AI-generated geographical description for a given DEM's characteristics.
 * @param {string} demName - The name of the DEM/chunk.
 * @param {object} header - The header object of the DEM ({ncols, nrows, cellsize, ...}).
 * @param {number} minElev - The minimum elevation of the DEM.
 * @param {number} maxElev - The maximum elevation of the DEM.
 * @returns {Promise<string>} A promise that resolves with the AI-generated text description.
 * @throws {Error} If the API call fails or returns an invalid response.
 */
export async function fetchAIDescription(demName, header, minElev, maxElev) {
    console.log(`[APIManager] Fetching AI description for: ${demName}`);

    // Construct the prompt for the Gemini API
    const prompt = `Describe this terrain: ${demName}, Columns: ${header.ncols}, Rows: ${header.nrows}, Cell Size: ${header.cellsize}, Min Elev: ${minElev.toFixed(2)}, Max Elev: ${maxElev.toFixed(2)}. Provide a brief, engaging geographical description (1-3 sentences). Focus on the general landscape type and elevation changes. Be descriptive.`;

    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }]; 
        const payload = { contents: chatHistory }; 
        const apiKey = ""; // API key is automatically provided by the Canvas environment for gemini-2.0-flash
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        console.log(`[APIManager] Sending prompt to Gemini: "${prompt}"`);

        // Make the API call
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) { // Handle HTTP errors
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })); // Try to parse error, fallback to statusText
            console.error(`[APIManager] Gemini API Error (${response.status}):`, errorData);
            throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown API error'}`); 
        }

        const result = await response.json();
        console.log("[APIManager] Gemini API Response:", result);

        // Extract and return the generated text
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0 && result.candidates[0].content.parts[0].text) {
            const textDescription = result.candidates[0].content.parts[0].text;
            console.log(`[APIManager] Received description: "${textDescription}"`);
            return textDescription;
        } else {
            console.error("[APIManager] No valid content received from Gemini API:", result);
            throw new Error("No valid content (text description) received from AI API.");
        }
    } catch (error) { // Catch network errors or errors from the try block
        console.error("[APIManager] Error fetching terrain description:", error);
        // Re-throw the error so the caller can handle it (e.g., update UI)
        throw error; // This will be caught by the calling function in main.js
    }
}
