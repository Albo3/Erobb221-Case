import { Hono } from 'hono';
import type { HonoRequest } from 'hono'; // Use type-only import
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun'; // Import serveStatic for serving files
import { Database } from 'bun:sqlite';
import { unlink } from 'node:fs/promises'; // For deleting files on rollback
import { join, extname } from 'node:path'; // For path manipulation
import { randomUUID } from 'node:crypto'; // For unique filenames
import { existsSync, mkdirSync } from 'node:fs'; // For ensuring upload dirs exist
import { parseBlob } from 'music-metadata-browser'; // For reading audio duration
import bcrypt from 'bcrypt'; // For password hashing


// --- Constants ---
const UPLOADS_DIR = 'uploads';
const IMAGES_DIR = join(UPLOADS_DIR, 'images');
const SOUNDS_DIR = join(UPLOADS_DIR, 'sounds');
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // Increased to 10MB
// const MAX_AUDIO_DURATION_SECONDS = 15; // Removed duration limit
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
// Add common WAV variations to allowed types
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/aac', 'audio/flac'];
// !!! IMPORTANT: In a real application, store this hash securely in an environment variable, NOT hardcoded!
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$vHO4F6ZpPRqk4/Jp4vX.qOw.qD89QnEvG.KBfID/i/5wQKtS1vYHu'; // Correct hash for 'caseAdmin!'

// --- Database Setup ---
const db = new Database('database.sqlite', { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;'); // Ensure foreign key constraints are enforced

// Ensure upload directories exist on startup
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR);
if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR);
if (!existsSync(SOUNDS_DIR)) mkdirSync(SOUNDS_DIR);


// --- Database Migration ---
const DB_VERSION = 6; // Increment version for percentage chance and display color

const getDbVersion = (): number => {
    try {
        db.exec('CREATE TABLE IF NOT EXISTS db_meta (key TEXT PRIMARY KEY, value TEXT)');
        const stmt = db.prepare('SELECT value FROM db_meta WHERE key = ?');
        const result = stmt.get('version') as { value: string } | null;
        return result ? parseInt(result.value, 10) : 0;
    } catch { return 0; }
};

const setDbVersion = (version: number) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)');
    stmt.run('version', version.toString());
};

const currentVersion = getDbVersion();
console.log(`Current DB version: ${currentVersion}, Required version: ${DB_VERSION}`);

if (currentVersion < DB_VERSION) {
    console.log(`Applying DB migration version ${DB_VERSION}...`);

    // --- Migration Logic for v4 ---
    // Drop tables from previous versions in reverse order of dependency
    console.log('Dropping old case_items table (if exists)...');
    db.exec('DROP TABLE IF EXISTS case_items;');
    console.log('Dropping old assets table (if exists)...');
    db.exec('DROP TABLE IF EXISTS assets;'); // Remove the assets table from v3

    // Rebuild core tables if migrating from very early version
    if (currentVersion < 1) { // Assuming 'cases' table existed since v1
        console.log('Dropping cases and db_meta for full rebuild...');
        db.exec('DROP TABLE IF EXISTS cases;');
        db.exec('DROP TABLE IF EXISTS db_meta;');
        db.exec('CREATE TABLE db_meta (key TEXT PRIMARY KEY, value TEXT)');
        db.exec(`
          CREATE TABLE cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
    }

    // Create the new item_templates table
    console.log('Creating item_templates table...');
    db.exec(`
      CREATE TABLE item_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_name TEXT NOT NULL UNIQUE, -- Base name for the template (e.g., "AK-47 Redline")
        image_path TEXT,          -- Relative path to image file in uploads/images/
        sound_path TEXT,          -- Relative path to sound file in uploads/sounds/
        rules_text TEXT,          -- Rules text content
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create the new case_items linking table (v4 schema)
    console.log('Creating new case_items linking table (v4)...');
    db.exec(`
      CREATE TABLE case_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        item_template_id INTEGER NOT NULL,
        override_name TEXT, -- Optional name override for this specific instance (e.g., "StatTrak...")
        color TEXT NOT NULL, -- Rarity color specific to this instance in this case
        FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE,
        FOREIGN KEY (item_template_id) REFERENCES item_templates (id) ON DELETE CASCADE -- Cascade delete if template is removed
      );
    `);
    // --- End Migration Logic for v4 ---

    // console.log(`DB migration version ${DB_VERSION} applied.`); // Message moved below specific version blocks
    // --- Migration Logic for v5 ---
    if (currentVersion < 5) {
        console.log('Applying DB migration version 5: Add image_path to cases table...');
        try {
            db.exec('ALTER TABLE cases ADD COLUMN image_path TEXT');
            console.log('Successfully added image_path column to cases table.');
        } catch (alterError) {
            // Check if the column already exists (might happen if migration was partially run before)
            const checkColumnStmt = db.prepare("PRAGMA table_info(cases)");
            const columns = checkColumnStmt.all() as Array<{ name: string }>;
            if (columns.some(col => col.name === 'image_path')) {
                console.warn('Column image_path already exists in cases table. Skipping ALTER TABLE.');
            } else {
                console.error('Failed to add image_path column to cases table:', alterError);
                throw alterError; // Re-throw if it's not an "already exists" error
            }
        }
    }
    // --- End Migration Logic for v5 ---
    if (currentVersion < 5) {
        console.log(`DB migration version 5 applied.`);
    }

    // --- Migration Logic for v6 ---
    if (currentVersion < 6) {
        console.log('Applying DB migration version 6: Add percentage_chance and display_color to case_items, drop color...');
        try {
            // Add new columns with defaults first to handle existing rows if any
            db.exec('ALTER TABLE case_items ADD COLUMN percentage_chance REAL NOT NULL DEFAULT 0');
            db.exec('ALTER TABLE case_items ADD COLUMN display_color TEXT NOT NULL DEFAULT \'#808080\''); // Default grey
            console.log('Successfully added percentage_chance and display_color columns.');

            // Now attempt to drop the old 'color' column
            // Note: Older SQLite versions might not support DROP COLUMN directly.
            // If this fails, a more complex migration (create new table, copy data, drop old, rename new) would be needed.
            // However, Bun's SQLite is usually recent enough.
            db.exec('ALTER TABLE case_items DROP COLUMN color');
            console.log('Successfully dropped old color column.');

            console.log('DB migration version 6 applied.');
        } catch (migrationError) {
            console.error('Failed during DB migration version 6:', migrationError);
            // Check if columns already exist from a partial run
             const checkStmt = db.prepare("PRAGMA table_info(case_items)");
             const columns = checkStmt.all() as Array<{ name: string }>;
             const hasPercent = columns.some(c => c.name === 'percentage_chance');
             const hasDisplayColor = columns.some(c => c.name === 'display_color');
             const hasOldColor = columns.some(c => c.name === 'color');

             if (hasPercent && hasDisplayColor && !hasOldColor) {
                 console.warn('Migration v6 seems already applied or partially applied successfully. Skipping.');
             } else {
                console.error('Irrecoverable error during migration v6. Manual intervention might be needed.');
                throw migrationError; // Re-throw to stop server startup
             }
        }
    }
    // --- End Migration Logic for v6 ---

    setDbVersion(DB_VERSION); // Update version only if all migrations succeed
} else {
     console.log(`Database schema is up to date (v${DB_VERSION}).`);
}
// --- End Database Migration ---

// --- Hono App Setup ---
const app = new Hono();

// --- Middleware ---
// CORS for API routes
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://erobb221.live', 'https://www.erobb221.live'], // Explicitly allow dev and prod origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'], // Content-Type might be multipart/form-data now
}));

// Static file serving for uploads
// Serve files from './uploads' directory when URL path starts with '/uploads/'
// This should handle /uploads/images/* and /uploads/sounds/*
app.use('/uploads/*', serveStatic({ root: './' }));

// Remove the previous specific route for /sounds/case.mp3 as it's now incorrect
// app.use('/sounds/case.mp3', serveStatic({ path: './server/sounds/case.mp3' }));


// --- API Routes ---
app.get('/', (c) => c.text('Hono Server Running! Item Template management enabled.'));

// --- Item Template API Routes ---

// GET /api/item-templates - List all item templates
app.get('/api/item-templates', (c) => {
    console.log(`GET /api/item-templates requested`);
    try {
        const stmt = db.prepare('SELECT id, base_name, image_path, sound_path, rules_text, created_at FROM item_templates ORDER BY created_at DESC');
        const templates = stmt.all();
        return c.json(templates);
    } catch (dbError) {
        console.error('Database error fetching item templates:', dbError);
        return c.json({ error: 'Database error fetching item templates.' }, 500);
    }
});

// POST /api/item-templates - Create a new item template
app.post('/api/item-templates', async (c) => {
    console.log('POST /api/item-templates requested');
    const savedFilePaths: string[] = []; // Track saved files for rollback

    try {
        const formData = await c.req.formData();
        const baseName = formData.get('base_name') as string;
        const rulesText = formData.get('rules_text') as string | null;
        const imageFile = formData.get('image_file') as File | null;
        const soundFile = formData.get('sound_file') as File | null;
        // Get selected existing paths (if provided)
        const existingImagePath = formData.get('existing_image_path') as string | null;
        const existingSoundPath = formData.get('existing_sound_path') as string | null;


        // Validation
        if (!baseName || typeof baseName !== 'string' || baseName.trim() === '') {
            return c.json({ error: 'Item template base_name is required.' }, 400);
        }
        if (rulesText && typeof rulesText !== 'string') {
             return c.json({ error: 'Invalid rules_text format.' }, 400);
        }

        // --- File Validation ---
        if (imageFile) {
            if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                return c.json({ error: `Invalid image file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` }, 400);
            }
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
                return c.json({ error: `Image file size exceeds the limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.` }, 400);
            }
        }
        if (soundFile) {
            if (!ALLOWED_AUDIO_TYPES.includes(soundFile.type)) {
                return c.json({ error: `Invalid audio file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}` }, 400);
            }
            // Removed duration check, keep metadata parsing for potential future use or logging
            try {
                console.log(`Attempting to parse metadata for audio file: ${soundFile.name}, type: ${soundFile.type}`);
                const metadata = await parseBlob(soundFile);
                console.log(`Successfully parsed metadata. Duration: ${metadata.format.duration ?? 'N/A'}`);
                // Duration check removed
            } catch (metaError: any) {
                // Log error but don't reject the upload based on metadata parsing failure alone
                console.warn(`Could not read metadata from audio file ${soundFile.name}. Allowing upload anyway. Error: ${metaError.message || 'Unknown metadata error'}`);
            }
        }
        // --- End File Validation ---

        const insertTemplateStmt = db.prepare(`
            INSERT INTO item_templates (base_name, image_path, sound_path, rules_text)
            VALUES (?, ?, ?, ?) RETURNING id
        `);

        db.exec('BEGIN TRANSACTION');
        try {
            let imagePath: string | null = null;
            let soundPath: string | null = null;

            // Determine final image path: New file takes precedence over existing selection
            if (imageFile) {
                imagePath = await saveUploadedFile(imageFile, IMAGES_DIR);
                if (imagePath) savedFilePaths.push(join('.', imagePath)); // Track for rollback
                else throw new Error('Failed to save new image file.');
            } else if (existingImagePath) {
                imagePath = existingImagePath; // Use selected existing path
            } // else: imagePath remains null

            // Determine final sound path: New file takes precedence over existing selection
             if (soundFile) {
                soundPath = await saveUploadedFile(soundFile, SOUNDS_DIR);
                if (soundPath) savedFilePaths.push(join('.', soundPath)); // Track for rollback
                 else throw new Error('Failed to save new sound file.');
            } else if (existingSoundPath) {
                soundPath = existingSoundPath; // Use selected existing path
            } // else: soundPath remains null


            // Insert template into DB
            const templateResult = insertTemplateStmt.get(
                baseName.trim(),
                imagePath,
                soundPath,
                rulesText?.trim() ?? null
            ) as { id: number } | null;

            if (!templateResult || typeof templateResult.id !== 'number') {
                throw new Error('Failed to insert item template or retrieve ID.');
            }

            db.exec('COMMIT');
            console.log(`Item Template '${baseName}' (ID: ${templateResult.id}) created successfully.`);
            // Return the created template details
            return c.json({
                message: 'Item template created successfully',
                template: {
                    id: templateResult.id,
                    base_name: baseName.trim(),
                    image_path: imagePath,
                    sound_path: soundPath,
                    rules_text: rulesText?.trim() ?? null
                }
             }, 201);

        } catch (error) {
            console.error('Item template creation transaction failed, rolling back:', error);
            db.exec('ROLLBACK');
            // Attempt to delete any files saved during the failed transaction
            console.log('Attempting to delete saved template files due to rollback:', savedFilePaths);
            for (const filePath of savedFilePaths) {
                try { await unlink(filePath); console.log(`Deleted rolled back file: ${filePath}`); }
                catch (unlinkError) { console.error(`Error deleting rolled back file ${filePath}:`, unlinkError); }
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            return c.json({ error: `Item template creation failed: ${errorMessage}` }, 500);
        }

    } catch (error: any) {
        console.error('Error processing POST /api/item-templates:', error);
        return c.json({ error: 'An unexpected error occurred processing the request.' }, 500);
    }
});

// PUT /api/item-templates/:id - Update an existing item template
app.put('/api/item-templates/:id', async (c) => {
    const idParam = c.req.param('id');
    const id = parseInt(idParam, 10);
    console.log(`PUT /api/item-templates/${id} requested`);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid item template ID provided.' }, 400);
    }

    const savedFilePaths: string[] = []; // Track NEW files saved for potential rollback
    let oldImagePath: string | null = null;
    let oldSoundPath: string | null = null;

    try {
        // Fetch existing template to get old file paths for deletion
        const selectStmt = db.prepare('SELECT image_path, sound_path FROM item_templates WHERE id = ?');
        const existingTemplate = selectStmt.get(id) as { image_path: string | null, sound_path: string | null } | null;

        if (!existingTemplate) {
            return c.json({ error: 'Item template not found.' }, 404);
        }
        oldImagePath = existingTemplate.image_path;
        oldSoundPath = existingTemplate.sound_path;

        const formData = await c.req.formData();
        const baseName = formData.get('base_name') as string;
        const rulesText = formData.get('rules_text') as string | null; // Can be null to clear rules
        const imageFile = formData.get('image_file') as File | null;
        const soundFile = formData.get('sound_file') as File | null;
        // Get selected existing paths (if provided)
        const existingImagePath = formData.get('existing_image_path') as string | null;
        const existingSoundPath = formData.get('existing_sound_path') as string | null;
        // Flags to indicate if existing files should be cleared
        const clearImage = formData.get('clear_image') === 'true';
        const clearSound = formData.get('clear_sound') === 'true';

        // Validation
        if (!baseName || typeof baseName !== 'string' || baseName.trim() === '') {
            return c.json({ error: 'Item template base_name is required.' }, 400);
        }
        // rulesText can be explicitly null/empty to clear it

        // --- File Validation ---
        if (imageFile) {
            if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                return c.json({ error: `Invalid image file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` }, 400);
            }
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
                return c.json({ error: `Image file size exceeds the limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.` }, 400);
            }
        }
        if (soundFile) {
            if (!ALLOWED_AUDIO_TYPES.includes(soundFile.type)) {
                return c.json({ error: `Invalid audio file type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}` }, 400);
            }
            // Removed duration check, keep metadata parsing for potential future use or logging
             try {
                console.log(`Attempting to parse metadata for audio file: ${soundFile.name}, type: ${soundFile.type}`);
                const metadata = await parseBlob(soundFile);
                 console.log(`Successfully parsed metadata. Duration: ${metadata.format.duration ?? 'N/A'}`);
                 // Duration check removed
            } catch (metaError: any) {
                 // Log error but don't reject the upload based on metadata parsing failure alone
                console.warn(`Could not read metadata from audio file ${soundFile.name}. Allowing upload anyway. Error: ${metaError.message || 'Unknown metadata error'}`);
            }
        }
        // --- End File Validation ---


        const updateTemplateStmt = db.prepare(`
            UPDATE item_templates
            SET base_name = ?, image_path = ?, sound_path = ?, rules_text = ?
            WHERE id = ?
        `);

        db.exec('BEGIN TRANSACTION');
        let finalImagePath = oldImagePath;
        let finalSoundPath = oldSoundPath;
        let finalRulesText = rulesText?.trim() ?? null; // Use provided text or null

        try {
            // Determine final image path based on priority: Clear > New File > Existing Path > Keep Old
            if (clearImage) {
                finalImagePath = null;
            } else if (imageFile) {
                const newImagePath = await saveUploadedFile(imageFile, IMAGES_DIR);
                if (newImagePath) { savedFilePaths.push(join('.', newImagePath)); finalImagePath = newImagePath; }
                else { throw new Error('Failed to save new image file.'); }
            } else if (existingImagePath) {
                 finalImagePath = existingImagePath; // Use selected existing path
            } // else: finalImagePath remains oldImagePath (default)

             // Determine final sound path based on priority: Clear > New File > Existing Path > Keep Old
            if (clearSound) {
                finalSoundPath = null;
            } else if (soundFile) {
                const newSoundPath = await saveUploadedFile(soundFile, SOUNDS_DIR);
                 if (newSoundPath) { savedFilePaths.push(join('.', newSoundPath)); finalSoundPath = newSoundPath; }
                 else { throw new Error('Failed to save new sound file.'); }
            } else if (existingSoundPath) {
                finalSoundPath = existingSoundPath; // Use selected existing path
            } // else: finalSoundPath remains oldSoundPath (default)


            // Update DB
            updateTemplateStmt.run(
                baseName.trim(),
                finalImagePath,
                finalSoundPath,
                finalRulesText,
                id
            );

            db.exec('COMMIT');

            // Delete old files AFTER commit succeeds, only if cleared or replaced by a NEW file upload
            // Don't delete if just selecting a different existing path
            if (oldImagePath && (clearImage || (imageFile && oldImagePath !== finalImagePath))) {
                 try { await unlink(join('.', oldImagePath)); console.log(`Deleted old/replaced image: ${oldImagePath}`); }
                 catch(e) { console.error(`Error deleting old/replaced image ${oldImagePath}:`, e); }
            }
             if (oldSoundPath && (clearSound || (soundFile && oldSoundPath !== finalSoundPath))) {
                 try { await unlink(join('.', oldSoundPath)); console.log(`Deleted old/replaced sound: ${oldSoundPath}`); }
                 catch(e) { console.error(`Error deleting old/replaced sound ${oldSoundPath}:`, e); }
            }


            console.log(`Item Template '${baseName}' (ID: ${id}) updated successfully.`);
            return c.json({
                message: 'Item template updated successfully',
                template: { id, base_name: baseName.trim(), image_path: finalImagePath, sound_path: finalSoundPath, rules_text: finalRulesText }
            });

        } catch (error) {
            console.error('Item template update transaction failed, rolling back:', error);
            db.exec('ROLLBACK');
            // Attempt to delete any NEW files saved during the failed transaction
            console.log('Attempting to delete newly saved template files due to rollback:', savedFilePaths);
            for (const filePath of savedFilePaths) {
                try { await unlink(filePath); console.log(`Deleted rolled back file: ${filePath}`); }
                catch (unlinkError) { console.error(`Error deleting rolled back file ${filePath}:`, unlinkError); }
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            return c.json({ error: `Item template update failed: ${errorMessage}` }, 500);
        }

    } catch (error: any) {
        console.error(`Error processing PUT /api/item-templates/${id}:`, error);
        return c.json({ error: 'An unexpected error occurred processing the request.' }, 500);
    }
});

// GET /api/existing-assets - Fetch distinct existing image/sound paths from templates
app.get('/api/existing-assets', (c) => {
    console.log(`GET /api/existing-assets requested`);
    try {
        const imageStmt = db.prepare('SELECT DISTINCT image_path FROM item_templates WHERE image_path IS NOT NULL');
        const soundStmt = db.prepare('SELECT DISTINCT sound_path FROM item_templates WHERE sound_path IS NOT NULL');
        const images = imageStmt.all().map((row: any) => row.image_path);
        const sounds = soundStmt.all().map((row: any) => row.sound_path);
        return c.json({ images, sounds });
    } catch (dbError) {
        console.error('Database error fetching existing assets:', dbError);
        return c.json({ error: 'Database error fetching existing assets.' }, 500);
    }
});


// --- Case API Routes ---

// GET /api/cases - Fetch list of all cases (ID and Name) - Remains the same
app.get('/api/cases', (c) => {
    console.log('GET /api/cases requested');
    try {
        // Include image_path in the query
        const stmt = db.prepare('SELECT id, name, image_path FROM cases ORDER BY created_at DESC');
        const cases = stmt.all();
        return c.json(cases);
    } catch (dbError) {
        console.error('Database error fetching cases:', dbError);
        return c.json({ error: 'Database error fetching cases.' }, 500);
    }
});

// GET /api/cases/:id - Fetch details for a specific case and its items (MODIFIED TO JOIN ITEM TEMPLATES)
app.get('/api/cases/:id', (c) => {
    const idParam = c.req.param('id');
    const id = parseInt(idParam, 10);
    console.log(`GET /api/cases/${id} requested`);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid case ID provided.' }, 400);
    }

    try {
        // Include image_path in the select statement
        const caseStmt = db.prepare('SELECT id, name, description, image_path FROM cases WHERE id = ?');
        const caseDetails = caseStmt.get(id) as { id: number; name: string; description: string | null; image_path: string | null } | null;

        if (!caseDetails) {
            return c.json({ error: 'Case not found.' }, 404);
        }

        // Fetch associated items by joining cases -> case_items -> item_templates
        const itemsStmt = db.prepare(`
            SELECT
                ci.item_template_id,
                ci.override_name,
                ci.percentage_chance, -- Fetch new percentage column
                ci.display_color,     -- Fetch new display color column
                it.base_name,
                it.image_path as image_url,
                it.sound_path as sound_url,
                it.rules_text as rules
            FROM case_items ci
            JOIN item_templates it ON ci.item_template_id = it.id
            WHERE ci.case_id = ?
        `);
        // Type needs to match the SELECT statement columns/aliases
        const itemsRaw = itemsStmt.all(id) as Array<{
            item_template_id: number;
            override_name: string | null;
            percentage_chance: number; // Add percentage
            display_color: string;     // Add display color
            base_name: string;
            image_url: string | null;
            sound_url: string | null;
            rules: string | null;
        }>;

        // Process raw items to create the final structure for the frontend
        const items = itemsRaw.map(item => ({
            item_template_id: item.item_template_id,
            name: item.override_name ?? item.base_name,
            percentage_chance: item.percentage_chance, // Include percentage
            display_color: item.display_color,         // Include display color
            image_url: item.image_url,
            sound_url: item.sound_url,
            rules: item.rules,
            // Include override_name separately if needed by frontend edit logic
            override_name: item.override_name
        }));


        const result = { ...caseDetails, items: items };
        return c.json(result);

    } catch (dbError) {
        console.error(`Database error fetching case ${id}:`, dbError);
        return c.json({ error: 'Database error fetching case details.' }, 500);
    }
});

// --- API Route Implementations --- (Keep saveUploadedFile helper)

// Helper function to save uploaded file (REMAINS THE SAME as it's used by POST /api/item-templates)
async function saveUploadedFile(file: File, targetDir: string): Promise<string | null> {
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


// Define expected structure for items within the form data (JSON string)
interface CaseItemLinkData {
    item_template_id: number;
    override_name?: string | null;
    percentage_chance: number; // Changed from color
    display_color: string;     // Added display color
}

// Helper function to validate CaseItemLinkData array
const validateCaseItems = (items: any[], req: HonoRequest): string | null => {
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


// POST /api/cases - Create a new case (handles multipart/form-data, uses new item structure)
app.post('/api/cases', async (c) => {
    console.log('POST /api/cases requested (multipart/form-data)');
    let caseId: number | null = null;
    const savedFilePaths: string[] = []; // Track saved image for rollback

    try {
        const formData = await c.req.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string | null;
        const itemsJson = formData.get('items') as string; // Items array as JSON string
        const imageFile = formData.get('image_file') as File | null;
        const existingImagePath = formData.get('existing_image_path') as string | null;

        // --- Basic Validation ---
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return c.json({ error: 'Case name is required.' }, 400);
        }
        if (!itemsJson || typeof itemsJson !== 'string') {
            return c.json({ error: 'Items data (JSON string) is required.' }, 400);
        }

        let items: CaseItemLinkData[];
        try {
            items = JSON.parse(itemsJson);
            // Removed duplicated block here
            const validationError = validateCaseItems(items, c.req);
            if (validationError) {
                return c.json({ error: validationError }, 400);
            }
        } catch (parseError) {
            return c.json({ error: 'Invalid items JSON format.' }, 400);
        }
        // --- End Basic Validation ---

        // --- File Validation ---
        if (imageFile) {
            if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                return c.json({ error: `Invalid image file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` }, 400);
            }
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
                return c.json({ error: `Image file size exceeds the limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.` }, 400);
            }
        }
        // --- End File Validation ---

        // --- Database Insertion (Transaction) ---
        const insertCaseStmt = db.prepare('INSERT INTO cases (name, description, image_path) VALUES (?, ?, ?) RETURNING id');
        // Update insert statement for case_items with new columns
        const insertItemLinkStmt = db.prepare(`
            INSERT INTO case_items
            (case_id, item_template_id, override_name, percentage_chance, display_color)
            VALUES (?, ?, ?, ?, ?)
        `);

        db.exec('BEGIN TRANSACTION');

        try {
            // Determine final image path
            let finalImagePath: string | null = null;
            if (imageFile) {
                finalImagePath = await saveUploadedFile(imageFile, IMAGES_DIR);
                if (finalImagePath) savedFilePaths.push(join('.', finalImagePath)); // Track for rollback
                else throw new Error('Failed to save new case image file.');
            } else if (existingImagePath) {
                finalImagePath = existingImagePath; // Use selected existing path
            }

            // Insert Case with image path
            const caseResult = insertCaseStmt.get(
                name.trim(),
                description?.trim() ?? null,
                finalImagePath // Add image path here
            ) as { id: number } | null;

            if (!caseResult || typeof caseResult.id !== 'number') {
                 throw new Error('Failed to insert case or retrieve ID.');
            }
            caseId = caseResult.id;

            // Insert item links using new structure
            for (const item of items) {
                insertItemLinkStmt.run(
                    caseId,
                    item.item_template_id,
                    item.override_name?.trim() ?? null,
                    item.percentage_chance, // Use new percentage
                    item.display_color       // Use new display color
                );
            }

            db.exec('COMMIT');
            console.log(`Case '${name}' (ID: ${caseId}) with image '${finalImagePath}' and ${items.length} item links inserted successfully.`);
            return c.json({ message: 'Case created successfully', caseId: caseId }, 201);

        } catch (dbError) {
            console.error('Case creation transaction failed, rolling back:', dbError);
            db.exec('ROLLBACK'); // Rollback DB changes
            // Attempt to delete saved image file on rollback
            console.log('Attempting to delete saved case image due to rollback:', savedFilePaths);
            for (const filePath of savedFilePaths) {
                try { await unlink(filePath); console.log(`Deleted rolled back file: ${filePath}`); }
                catch (unlinkError) { console.error(`Error deleting rolled back file ${filePath}:`, unlinkError); }
            }
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            return c.json({ error: `Database error during case creation: ${errorMessage}` }, 500);
        }
        // --- End Database Insertion ---

    } catch (error: any) {
        console.error('Error processing POST /api/cases:', error);
        // Handle potential formData parsing errors specifically if needed
        return c.json({ error: 'An unexpected error occurred processing the request.' }, 500);
    }
});

// PUT /api/cases/:id - Update an existing case and its item links
app.put('/api/cases/:id', async (c) => {
    const idParam = c.req.param('id');
    const caseId = parseInt(idParam, 10);
    console.log(`PUT /api/cases/${caseId} requested (multipart/form-data)`);

    if (isNaN(caseId)) {
        return c.json({ error: 'Invalid case ID provided.' }, 400);
    }

    const savedFilePaths: string[] = []; // Track NEW image saved for potential rollback
    let oldImagePath: string | null = null;

    try {
        // Fetch existing case to get old image path for deletion logic
        const selectCaseStmt = db.prepare('SELECT image_path FROM cases WHERE id = ?');
        const existingCaseData = selectCaseStmt.get(caseId) as { image_path: string | null } | null;

        if (!existingCaseData) {
            return c.json({ error: 'Case not found.' }, 404);
        }
        oldImagePath = existingCaseData.image_path;

        // Parse formData
        const formData = await c.req.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string | null;
        const itemsJson = formData.get('items') as string; // Items array as JSON string
        const imageFile = formData.get('image_file') as File | null;
        const existingImagePath = formData.get('existing_image_path') as string | null;
        const clearImage = formData.get('clear_image') === 'true';

        // --- Basic Validation ---
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return c.json({ error: 'Case name is required.' }, 400);
        }
        if (!itemsJson || typeof itemsJson !== 'string') {
            return c.json({ error: 'Items data (JSON string) is required.' }, 400);
        }

        let items: CaseItemLinkData[];
         try {
            items = JSON.parse(itemsJson);
            const validationError = validateCaseItems(items, c.req); // Use helper
            if (validationError) {
                return c.json({ error: validationError }, 400);
            }
        } catch (parseError) {
            return c.json({ error: 'Invalid items JSON format.' }, 400);
        }
        // --- End Basic Validation ---

        // --- File Validation ---
        if (imageFile) {
            if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
                return c.json({ error: `Invalid image file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` }, 400);
            }
            if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
                return c.json({ error: `Image file size exceeds the limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.` }, 400);
            }
        }
        // --- End File Validation ---

        // --- Database Update (Transaction) ---
        const updateCaseStmt = db.prepare('UPDATE cases SET name = ?, description = ?, image_path = ? WHERE id = ?');
        const deleteOldItemsStmt = db.prepare('DELETE FROM case_items WHERE case_id = ?');
        // Update insert statement for case_items with new columns
        const insertItemLinkStmt = db.prepare(`
            INSERT INTO case_items
            (case_id, item_template_id, override_name, percentage_chance, display_color)
            VALUES (?, ?, ?, ?, ?)
        `);

        db.exec('BEGIN TRANSACTION');
        let finalImagePath = oldImagePath; // Start with the existing path

        try {
            // Determine final image path based on priority: Clear > New File > Existing Path > Keep Old
            if (clearImage) {
                finalImagePath = null;
            } else if (imageFile) {
                const newImagePath = await saveUploadedFile(imageFile, IMAGES_DIR);
                if (newImagePath) { savedFilePaths.push(join('.', newImagePath)); finalImagePath = newImagePath; } // Track new file
                else { throw new Error('Failed to save new case image file.'); }
            } else if (existingImagePath) {
                 finalImagePath = existingImagePath; // Use selected existing path
            } // else: finalImagePath remains oldImagePath (default)

            // 1. Update case details (including image path)
            updateCaseStmt.run(
                name.trim(), // Use name from formData
                description?.trim() ?? null, // Use description from formData
                finalImagePath, // Use determined final image path
                caseId
            );

            // 2. Delete old item links for this case
            deleteOldItemsStmt.run(caseId);

            // 3. Insert new item links using new structure
            for (const item of items) {
                insertItemLinkStmt.run(
                    caseId,
                    item.item_template_id,
                    item.override_name?.trim() ?? null,
                    item.percentage_chance, // Use new percentage
                    item.display_color       // Use new display color
                );
            }

            db.exec('COMMIT');

            // Delete old image file AFTER commit succeeds, if cleared or replaced by a NEW file upload
            if (oldImagePath && (clearImage || (imageFile && oldImagePath !== finalImagePath))) {
                 try { await unlink(join('.', oldImagePath)); console.log(`Deleted old/replaced case image: ${oldImagePath}`); }
                 catch(e) { console.error(`Error deleting old/replaced case image ${oldImagePath}:`, e); }
            }

            console.log(`Case '${name}' (ID: ${caseId}) updated successfully with image '${finalImagePath}' and ${items.length} item links.`);
            return c.json({ message: 'Case updated successfully', caseId: caseId }); // Return 200 OK

        } catch (dbError) {
            console.error(`Case update transaction failed for ID ${caseId}, rolling back:`, dbError);
            db.exec('ROLLBACK');
            // Attempt to delete any NEW files saved during the failed transaction
            console.log('Attempting to delete newly saved case image due to rollback:', savedFilePaths);
            for (const filePath of savedFilePaths) {
                try { await unlink(filePath); console.log(`Deleted rolled back file: ${filePath}`); }
                catch (unlinkError) { console.error(`Error deleting rolled back file ${filePath}:`, unlinkError); }
            }
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            return c.json({ error: `Database error during case update: ${errorMessage}` }, 500);
        }
        // --- End Database Update ---

    } catch (error: any) {
        console.error(`Error processing PUT /api/cases/${caseId}:`, error);
        // Handle potential formData parsing errors specifically if needed
        return c.json({ error: 'An unexpected error occurred processing the request.' }, 500);
    }
});

// DELETE /api/cases/:id - Delete a case and its associated image
app.delete('/api/cases/:id', async (c) => {
    const idParam = c.req.param('id');
    const caseId = parseInt(idParam, 10);
    console.log(`DELETE /api/cases/${caseId} requested`);

    if (isNaN(caseId)) {
        return c.json({ error: 'Invalid case ID provided.' }, 400);
    }

    let imagePathToDelete: string | null = null;

    try {
        // 1. Find the image path before deleting the case record
        const selectStmt = db.prepare('SELECT image_path FROM cases WHERE id = ?');
        const caseData = selectStmt.get(caseId) as { image_path: string | null } | null;

        if (!caseData) {
            return c.json({ error: 'Case not found.' }, 404);
        }
        imagePathToDelete = caseData.image_path;

        // 2. Delete the case record (FK constraint handles case_items)
        const deleteStmt = db.prepare('DELETE FROM cases WHERE id = ?');
        const result = deleteStmt.run(caseId);

        if (result.changes === 0) {
            // Should not happen if select worked, but good practice to check
            console.warn(`Case ID ${caseId} found but delete operation affected 0 rows.`);
            return c.json({ error: 'Case found but failed to delete.' }, 500);
        }

        console.log(`Case ID ${caseId} deleted successfully from database.`);

        // 3. If an image path existed, try to delete the file
        if (imagePathToDelete) {
            try {
                const fullPath = join('.', imagePathToDelete); // Assumes image_path starts with /uploads/...
                await unlink(fullPath);
                console.log(`Deleted associated case image: ${fullPath}`);
            } catch (unlinkError: any) {
                // Log error but don't fail the request, DB deletion was successful
                if (unlinkError.code === 'ENOENT') {
                     console.warn(`Associated image file not found, skipping deletion: ${imagePathToDelete}`);
                } else {
                    console.error(`Error deleting associated case image ${imagePathToDelete}:`, unlinkError);
                }
            }
        }

        return c.json({ message: 'Case deleted successfully.' });

    } catch (dbError) {
        console.error(`Error processing DELETE /api/cases/${caseId}:`, dbError);
        const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
        return c.json({ error: `Database error during case deletion: ${errorMessage}` }, 500);
    }
});

// --- Admin Verification Route ---
app.post('/api/verify-admin', async (c) => {
    console.log('POST /api/verify-admin requested');
    try {
        const body = await c.req.json();
        const { password } = body;

        if (!password || typeof password !== 'string') {
            return c.json({ error: 'Password is required.' }, 400);
        }

        if (!ADMIN_PASSWORD_HASH) {
             console.error("CRITICAL: ADMIN_PASSWORD_HASH is not set!");
             return c.json({ error: 'Server configuration error.' }, 500);
        }

        const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

        if (match) {
            console.log('Admin password verification successful.');
            return c.json({ success: true });
        } else {
            console.log('Admin password verification failed.');
            return c.json({ success: false }, 401); // Unauthorized
        }

    } catch (error: any) {
         console.error('Error processing POST /api/verify-admin:', error);
         // Distinguish between JSON parsing error and bcrypt error if needed
         if (error instanceof SyntaxError) {
             return c.json({ error: 'Invalid request body.' }, 400);
         }
         return c.json({ error: 'An unexpected error occurred during verification.' }, 500);
    }
});


// --- History API Routes (REMOVED) ---


// --- Server Start ---
const port = 3001;
console.log(`Hono server listening on port ${port}`);

export default {
  port: port,
  fetch: app.fetch,
};

export { db };
