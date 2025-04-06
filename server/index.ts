import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun'; // Import serveStatic for serving files
import { Database } from 'bun:sqlite';
import { unlink } from 'node:fs/promises'; // For deleting files on rollback
import { join, extname } from 'node:path'; // For path manipulation
import { randomUUID } from 'node:crypto'; // For unique filenames

// --- Constants ---
const UPLOADS_DIR = 'uploads';
const IMAGES_DIR = join(UPLOADS_DIR, 'images');
const SOUNDS_DIR = join(UPLOADS_DIR, 'sounds');

// --- Database Setup ---
const db = new Database('database.sqlite', { create: true });
db.exec('PRAGMA journal_mode = WAL;');

// --- Database Migration ---
const DB_VERSION = 2; // Keep version 2 as schema columns are the same (storing paths)

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

if (currentVersion < DB_VERSION) { // Simplified: If less than current target, rebuild
    console.log(`Applying DB migration version ${DB_VERSION}...`);
    console.log('Dropping existing tables (if they exist)...');
    db.exec('DROP TABLE IF EXISTS case_items;');
    db.exec('DROP TABLE IF EXISTS cases;');
    db.exec('DROP TABLE IF EXISTS db_meta;');

    console.log('Creating tables with latest schema...');
    db.exec('CREATE TABLE db_meta (key TEXT PRIMARY KEY, value TEXT)');
    db.exec(`
      CREATE TABLE cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
      CREATE TABLE case_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        image_url TEXT, -- Stores relative path like /uploads/images/uuid.png
        rules TEXT,     -- Stores original text rules
        sound_url TEXT, -- Stores relative path like /uploads/sounds/uuid.mp3
        FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
      );
    `);
    console.log(`DB migration version ${DB_VERSION} applied.`);
    setDbVersion(DB_VERSION);
} else {
     console.log(`Database schema is up to date (v${DB_VERSION}).`);
}
// --- End Database Migration ---

// --- Hono App Setup ---
const app = new Hono();

// --- Middleware ---
// CORS for API routes
app.use('/api/*', cors({
  origin: 'http://localhost:3000',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'], // Content-Type might be multipart/form-data now
}));

// Static file serving for uploads
// Serve files from './uploads' directory when URL path starts with '/uploads/'
app.use('/uploads/*', serveStatic({ root: './' }));


// --- API Routes ---
app.get('/', (c) => c.text('Hono Server Running! Uploads enabled.'));

// GET /api/cases - Fetch list of all cases (ID and Name) - Remains the same
app.get('/api/cases', (c) => {
    console.log('GET /api/cases requested');
    try {
        const stmt = db.prepare('SELECT id, name FROM cases ORDER BY created_at DESC');
        const cases = stmt.all();
        return c.json(cases);
    } catch (dbError) {
        console.error('Database error fetching cases:', dbError);
        return c.json({ error: 'Database error fetching cases.' }, 500);
    }
});

// GET /api/cases/:id - Fetch details for a specific case and its items - Remains the same
app.get('/api/cases/:id', (c) => {
    const idParam = c.req.param('id');
    const id = parseInt(idParam, 10);
    console.log(`GET /api/cases/${id} requested`);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid case ID provided.' }, 400);
    }

    try {
        const caseStmt = db.prepare('SELECT id, name, description FROM cases WHERE id = ?');
        const caseDetails = caseStmt.get(id) as { id: number; name: string; description: string | null } | null;

        if (!caseDetails) {
            return c.json({ error: 'Case not found.' }, 404);
        }

        const itemsStmt = db.prepare('SELECT name, color, image_url, rules, sound_url FROM case_items WHERE case_id = ?');
        const items = itemsStmt.all(id) as Array<{ name: string; color: string; image_url: string | null; rules: string | null; sound_url: string | null }>;

        const result = { ...caseDetails, items: items };
        return c.json(result);

    } catch (dbError) {
        console.error(`Database error fetching case ${id}:`, dbError);
        return c.json({ error: 'Database error fetching case details.' }, 500);
    }
});

// --- API Route Implementations ---

// Define expected structure for the JSON part of the multipart request
interface CreateCaseJsonData {
    name: string;
    description?: string;
    items: Array<{ // Items here won't have URLs initially
        name: string;
        color: string;
        rules?: string;
        // image_url and sound_url will be added after file processing
    }>;
}

// Helper function to save uploaded file
async function saveUploadedFile(file: File, targetDir: string): Promise<string | null> {
    console.log(`[saveUploadedFile] Received file: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
    if (!file || file.size === 0) {
        console.log(`[saveUploadedFile] Skipping empty file: ${file?.name}`);
        return null;
    }
    try {
        const uniqueSuffix = randomUUID();
        const extension = extname(file.name) || ''; // Get file extension
        const filename = uniqueSuffix + extension;
        const savePath = join(targetDir, filename);
        console.log(`[saveUploadedFile] Attempting to save to: ${savePath}`);

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

// POST /api/cases - Create a new case with file uploads
app.post('/api/cases', async (c) => {
    console.log('POST /api/cases (multipart) requested');
    let caseId: number | null = null;
    const savedFilePaths: string[] = []; // Keep track of saved files for potential rollback

    try {
        const formData = await c.req.formData();
        const jsonDataString = formData.get('jsonData');

        if (!jsonDataString || typeof jsonDataString !== 'string') {
            return c.json({ error: 'Missing or invalid jsonData field in form data.' }, 400);
        }

        let caseData: CreateCaseJsonData;
        try {
            caseData = JSON.parse(jsonDataString);
        } catch (e) {
            return c.json({ error: 'Invalid JSON format in jsonData field.' }, 400);
        }

        // --- Basic Validation on JSON Data ---
        if (!caseData.name || typeof caseData.name !== 'string' || caseData.name.trim() === '') {
            return c.json({ error: 'Case name is required.' }, 400);
        }
        if (!Array.isArray(caseData.items) || caseData.items.length === 0) {
            return c.json({ error: 'Case must contain at least one item.' }, 400);
        }
        for (const item of caseData.items) {
            if (!item.name || typeof item.name !== 'string' || item.name.trim() === '' ||
                !item.color || typeof item.color !== 'string' || item.color.trim() === '') {
                return c.json({ error: `Each item must have a valid name and color. Failed item: ${JSON.stringify(item)}` }, 400);
            }
             if (item.rules && typeof item.rules !== 'string') {
                 return c.json({ error: `Invalid rules format for item '${item.name}'.` }, 400);
            }
        }
        // --- End JSON Validation ---

        // --- Database Insertion (Transaction) ---
        const insertCaseStmt = db.prepare('INSERT INTO cases (name, description) VALUES (?, ?) RETURNING id');
        const insertItemStmt = db.prepare('INSERT INTO case_items (case_id, name, color, image_url, rules, sound_url) VALUES (?, ?, ?, ?, ?, ?)');

        db.exec('BEGIN TRANSACTION');

        try {
            // Insert Case
            const caseResult = insertCaseStmt.get(
                caseData.name.trim(),
                caseData.description?.trim() ?? null
            ) as { id: number } | null;

            if (!caseResult || typeof caseResult.id !== 'number') {
                 throw new Error('Failed to insert case or retrieve ID.');
            }
            caseId = caseResult.id;

            // Process and Insert Items
            for (let i = 0; i < caseData.items.length; i++) {
                const item = caseData.items[i];
                // Add a check to satisfy TypeScript, although logically item should exist
                if (!item) {
                    throw new Error(`Item at index ${i} is unexpectedly undefined.`);
                }
                const imageFile = formData.get(`image_${i}`) as File | null;
                const soundFile = formData.get(`sound_${i}`) as File | null;

                // Save files and get relative paths
                const imageUrl = imageFile ? await saveUploadedFile(imageFile, IMAGES_DIR) : null;
                const soundUrl = soundFile ? await saveUploadedFile(soundFile, SOUNDS_DIR) : null;

                // Add saved paths to track for potential rollback
                if (imageUrl) savedFilePaths.push(join('.', imageUrl)); // Use join('.') for local path
                if (soundUrl) savedFilePaths.push(join('.', soundUrl));

                // Insert item with potentially updated URLs
                insertItemStmt.run(
                    caseId,
                    item.name.trim(),
                    item.color.trim(),
                    imageUrl, // Store relative path or null
                    item.rules?.trim() ?? null,
                    soundUrl  // Store relative path or null
                );
            }

            db.exec('COMMIT');
            console.log(`Case '${caseData.name}' (ID: ${caseId}) and ${caseData.items.length} items inserted successfully.`);
            return c.json({ message: 'Case created successfully', caseId: caseId }, 201);

        } catch (dbOrFileError) {
            console.error('Transaction failed, rolling back:', dbOrFileError);
            db.exec('ROLLBACK'); // Rollback DB changes

            // Attempt to delete any files that were successfully saved during the failed transaction
            console.log('Attempting to delete saved files due to rollback:', savedFilePaths);
            for (const filePath of savedFilePaths) {
                try {
                    await unlink(filePath);
                    console.log(`Deleted rolled back file: ${filePath}`);
                } catch (unlinkError) {
                    console.error(`Error deleting rolled back file ${filePath}:`, unlinkError);
                    // Log error but continue trying to delete others
                }
            }
            // Return error response - Check if it's an Error object
            const errorMessage = dbOrFileError instanceof Error ? dbOrFileError.message : String(dbOrFileError);
            return c.json({ error: `Database or file saving error during case creation: ${errorMessage}` }, 500);
        }
        // --- End Database Insertion ---

    } catch (error: any) {
        console.error('Error processing POST /api/cases (multipart):', error);
         if (error instanceof SyntaxError) { // Should not happen with formData, but keep just in case
             return c.json({ error: 'Invalid request data.' }, 400);
        }
        return c.json({ error: 'An unexpected error occurred processing the request.' }, 500);
    }
});


// --- Server Start ---
const port = 3001;
console.log(`Hono server listening on port ${port}`);

export default {
  port: port,
  fetch: app.fetch,
};

export { db };
