/**
 * JSON Repair Utility
 * 
 * Repairs common JSON errors from AI responses.
 * Follows Single Responsibility - only handles JSON parsing/repair.
 */

/**
 * Parse and repair common JSON errors from AI responses
 * 
 * @param text - Raw text from AI response
 * @returns Parsed JSON object
 * @throws Error if JSON cannot be repaired
 */
export const parseAndRepairJSON = (text: string): any => {
    // Step 1: Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    // Step 2: Find JSON object boundaries
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
        throw new Error("Không tìm thấy JSON hợp lệ trong response của AI.");
    }

    cleaned = cleaned.substring(startIdx, endIdx + 1);

    // Step 3: Try to parse directly first
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.warn("JSON parse failed, attempting repair...", e);
    }

    // Step 4: Attempt to repair common JSON issues
    let repaired = cleaned;

    // Fix trailing commas before ] or }
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    // Fix missing commas between objects/arrays
    repaired = repaired.replace(/}\s*{/g, '},{');
    repaired = repaired.replace(/]\s*\[/g, '],[');
    repaired = repaired.replace(/"\s*{/g, '",{');
    repaired = repaired.replace(/}\s*"/g, '},"');
    repaired = repaired.replace(/]\s*"/g, '],"');
    repaired = repaired.replace(/"\s*\[/g, '",[');

    // Fix unquoted property names (simple cases)
    repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    // Fix single quotes to double quotes (for strings)
    repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');

    // Remove any control characters
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, ' ');

    // Step 5: Try parsing repaired JSON
    try {
        return JSON.parse(repaired);
    } catch (e2) {
        console.error("JSON repair failed:", e2);
        console.error("Original text:", text.substring(0, 500));
        throw new Error("AI trả về JSON không hợp lệ. Vui lòng thử tạo đề lại.");
    }
};

/**
 * Format math symbols in text from AI response
 * - Replace * with x for multiplication
 * - Replace / with : for division (when surrounded by spaces)
 * 
 * @param text - Text to format
 * @returns Formatted text
 */
export const formatMathSymbols = (text: string): string => {
    return text
        // Replace * when surrounded by spaces: " * " -> " x "
        .replace(/\s\*\s/g, ' x ')
        // Replace * after parenthesis: ") * " -> ") x "
        .replace(/\)\s*\*\s*/g, ') x ')
        // Replace * before parenthesis: " * (" -> " x ("
        .replace(/\s*\*\s*\(/g, ' x (')
        // Replace * between alphanumeric: "a * b", "5 * 3" -> "a x b", "5 x 3"
        .replace(/([a-zA-Z0-9?])\s*\*\s*([a-zA-Z0-9?(])/g, '$1 x $2')
        // Division with spaces
        .replace(/([a-zA-Z0-9?]+)\s+\/\s+([a-zA-Z0-9?]+)/g, '$1 : $2');
};
