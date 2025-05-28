import { join } from 'node:path'; // For path manipulation

// --- Constants ---
export const UPLOADS_DIR = 'uploads';
export const IMAGES_DIR = join(UPLOADS_DIR, 'images');
export const SOUNDS_DIR = join(UPLOADS_DIR, 'sounds');
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // Increased to 10MB
// export const MAX_AUDIO_DURATION_SECONDS = 15; // Removed duration limit
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
// Add common WAV variations to allowed types
export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/aac', 'audio/flac'];
// !!! IMPORTANT: In a real application, store this hash securely in an environment variable, NOT hardcoded!
export const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$vHO4F6ZpPRqk4/Jp4vX.qOw.qD89QnEvG.KBfID/i/5wQKtS1vYHu'; // Correct hash for 
export const DB_VERSION = 9; // Increment version for case_items.show_percentage_in_opener
