/**
 * File Utilities
 * 
 * Helper functions for file handling in AI providers.
 */

/**
 * Convert a URL to base64 data
 * 
 * @param url - Image URL to convert
 * @returns Base64 data and mime type
 */
export const urlToBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const blob = await response.blob();
        const mimeType = blob.type || 'image/jpeg'; // Default fallback

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                const base64Data = base64String.split(',')[1];
                resolve({ data: base64Data, mimeType });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("urlToBase64 error:", error);
        throw error;
    }
};

/**
 * Convert a File to base64 data
 * 
 * @param file - File to convert
 * @returns Base64 data string (without data URL prefix)
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data url prefix
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};
