import { unlink } from 'node:fs/promises'; // For deleting files on rollback
import { join, extname } from 'node:path'; // For path manipulation
import { randomUUID } from 'node:crypto'; // For unique filenames
import { parseBlob } from 'music-metadata-browser'; // For reading audio duration
import type { HonoRequest } from 'hono'; // Use type-only import
import {
    ALLOWED_IMAGE_TYPES,
    MAX_IMAGE_SIZE_BYTES,
    ALLOWED_AUDIO_TYPES
} from './constants'; // Import necessary constants

// Define expected structure for items within the form data (JSON string)
export interface CaseItemLinkData {
    item_template_id: number;
    override_name?: string | null;
    percentage_chance: number; // Changed from color
    display_color: string;     // Added display color
}

// Helper function to save uploaded file
export async function saveUploadedFile(file: File, targetDir: string): Promise<string | null> {
    console.log(`[saveUploadedFile] Received file: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
    if (!file || file.size === 0) {
        console.log(`[saveUploadedFile] Skipping empty file: ${file.name}`); // Use file.name safely
        return null;
    }
    try {
        const uniqueSuffix = randomUUID();
        const extension = extname(file.name) || ''; // Get file extension
        // Extract and sanitize original filename (remove extension, replace invalid chars)
        const originalNameWithoutExt = file.name.substring(0, file.name.length - extension.length);
        const sanitizedOriginalName = originalNameWithoutExt.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Replace non-alphanumeric/dot/dash/underscore with underscore
        // Construct new filename: UUID-SanitizedOriginalName.ext
        const filename = `${uniqueSuffix}-${sanitizedOriginalName}${extension}`;
        const savePath = join(targetDir, filename);
        console.log(`[saveUploadedFile] Attempting to save to: ${savePath} (Original: ${file.name})`);

        await Bun.write(savePath, file);

        console.log(`[saveUploadedFile] Successfully wrote file: ${savePath}`);
        // Return the relative path for DB storage and client access
        const relativePath = `/${targetDir.replace(/\\/g, '/')}/${filename}`; // Use forward slashes for URL
        console.log(`[saveUploadedFile] Returning relative path: ${relativePath}`);
        return relativePath;
    } catch (error) {
        console.error(`[saveUploadedFile] Error saving file ${file.name} to ${targetDir}:`, error);
        throw new Error(`Failed to save file: ${file.name}`); // Re-throw to trigger rollback
    }
}

// Helper function to validate CaseItemLinkData array
export const validateCaseItems = (items: any[], req: HonoRequest): string | null => {
    if (!Array.isArray(items) || items.length === 0) {
        return 'Items must be a non-empty array.';
    }

    // let totalPercentage = 0; // Removed sum validation as per user request

    for (const item of items) {
        if (item.item_template_id === undefined || item.item_template_id === null || typeof item.item_template_id !== 'number') {
            return `Invalid or missing item_template_id for item. Must be a number.`;
        }
        // Validate percentage_chance
        if (item.percentage_chance === undefined || item.percentage_chance === null || typeof item.percentage_chance !== 'number' || item.percentage_chance < 0) {
            return `Each item must have a valid, non-negative percentage_chance. Failed item template ID: ${item.item_template_id}`;
        }
        // Validate display_color
        if (!item.display_color || typeof item.display_color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(item.display_color)) {
             return `Each item must have a valid hex color code (e.g., #RRGGBB) for display_color. Failed item template ID: ${item.item_template_id}`;
        }
        if (item.override_name && typeof item.override_name !== 'string') {
            return `Invalid override_name format for item template ID: ${item.item_template_id}. Must be a string or null.`;
        }
        // totalPercentage += item.percentage_chance; // Removed sum validation
    }

    // Removed sum validation block
    // const tolerance = 0.01; // Allow for floating point inaccuracies
    // if (Math.abs(totalPercentage - 100) > tolerance) {
    //     return `The sum of percentage chances for all items must be exactly 100%. Current sum: ${totalPercentage.toFixed(2)}%`;
    // }

    return null; // Validation passed
};

// Helper function for file validation (extracted logic)
export async function validateUploadedFile(file: File | null, type: 'image' | 'audio'): Promise<string | null> {
    if (!file) return null; // No file, no error

    if (type === 'image') {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return `Invalid image file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`;
        }
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            return `Image file size exceeds the limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.`;
        }
    } else if (type === 'audio') {
        if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
            return `Invalid audio file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`;
        }
        // Removed duration check, keep metadata parsing for potential future use or logging
        try {
            console.log(`Attempting to parse metadata for audio file: ${file.name}, type: ${file.type}`);
            const metadata = await parseBlob(file);
            console.log(`Successfully parsed metadata. Duration: ${metadata.format.duration ?? 'N/A'}`);
            // Duration check removed
        } catch (metaError: any) {
            // Log error but don't reject the upload based on metadata parsing failure alone
            console.warn(`Could not read metadata from audio file ${file.name}. Allowing upload anyway. Error: ${metaError.message || 'Unknown metadata error'}`);
        }
    }
    return null; // Validation passed
}
