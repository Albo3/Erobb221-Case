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
db.exec('PRAGMA foreign_keys = ON;'); // Ensure foreign key constraints are enforced

// --- Database Migration ---
const DB_VERSION = 4; // Incremented for Item Template refactor

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

        // Validation
        if (!baseName || typeof baseName !== 'string' || baseName.trim() === '') {
            return c.json({ error: 'Item template base_name is required.' }, 400);
        }
        if (rulesText && typeof rulesText !== 'string') {
             return c.json({ error: 'Invalid rules_text format.' }, 400);
        }

        const insertTemplateStmt = db.prepare(`
            INSERT INTO item_templates (base_name, image_path, sound_path, rules_text)
            VALUES (?, ?, ?, ?) RETURNING id
        `);

        db.exec('BEGIN TRANSACTION');
        try {
            // Save files first (if they exist)
            const imagePath = imageFile ? await saveUploadedFile(imageFile, IMAGES_DIR) : null;
            if (imagePath) savedFilePaths.push(join('.', imagePath));

            const soundPath = soundFile ? await saveUploadedFile(soundFile, SOUNDS_DIR) : null;
            if (soundPath) savedFilePaths.push(join('.', soundPath));

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


// --- Case API Routes ---

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

// GET /api/cases/:id - Fetch details for a specific case and its items (MODIFIED TO JOIN ITEM TEMPLATES)
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

        // Fetch associated items by joining cases -> case_items -> item_templates
        const itemsStmt = db.prepare(`
            SELECT
                -- Use override_name if available, otherwise use template's base_name
                COALESCE(ci.override_name, it.base_name) as name,
                ci.color,
                it.image_path as image_url,  -- Alias path columns for consistency
                it.sound_path as sound_url,
                it.rules_text as rules
            FROM case_items ci
            JOIN item_templates it ON ci.item_template_id = it.id
            WHERE ci.case_id = ?
        `);
        // Type needs to match the SELECT statement aliases
        const items = itemsStmt.all(id) as Array<{
            name: string;             // Effective name (override or base)
            color: string;            // From case_items
            image_url: string | null; // Path from item_templates
            sound_url: string | null; // Path from item_templates
            rules: string | null;     // Text from item_templates
        }>;

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


// Define expected request body structure for creating a case (using item template IDs)
interface CreateCaseBodyV4 {
    name: string;
    description?: string;
    items: Array<{ // Items now reference item templates via ID
        item_template_id: number;
        override_name?: string | null; // Optional name override
        color: string; // Color specific to this item instance
    }>;
}

// POST /api/cases - Create a new case by linking to existing item templates (expects JSON body)
app.post('/api/cases', async (c) => {
    console.log('POST /api/cases (template linking) requested');
    let caseId: number | null = null;

    try {
        const body = await c.req.json<CreateCaseBodyV4>();

        // --- Basic Validation ---
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            return c.json({ error: 'Case name is required.' }, 400);
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            return c.json({ error: 'Case must contain at least one item.' }, 400);
        }
        for (const item of body.items) {
            // Validate required fields for linking
            if (item.item_template_id === undefined || item.item_template_id === null || typeof item.item_template_id !== 'number') {
                 return c.json({ error: `Invalid or missing item_template_id for item. Must be a number.` }, 400);
            }
            if (!item.color || typeof item.color !== 'string' || item.color.trim() === '') {
                return c.json({ error: `Each item must have a valid color. Failed item template ID: ${item.item_template_id}` }, 400);
            }
            if (item.override_name && typeof item.override_name !== 'string') {
                 return c.json({ error: `Invalid override_name format for item template ID: ${item.item_template_id}. Must be a string or null.` }, 400);
            }
            // TODO: Could add validation to check if item_template_id actually exists? Maybe not necessary if FK constraints are reliable.
        }
        // --- End Validation ---

        // --- Database Insertion (Transaction) ---
        const insertCaseStmt = db.prepare('INSERT INTO cases (name, description) VALUES (?, ?) RETURNING id');
        // Use new case_items schema (v4)
        const insertItemLinkStmt = db.prepare(`
            INSERT INTO case_items
            (case_id, item_template_id, override_name, color)
            VALUES (?, ?, ?, ?)
        `);

        db.exec('BEGIN TRANSACTION');

        try {
            // Insert Case
            const caseResult = insertCaseStmt.get(
                body.name.trim(),
                body.description?.trim() ?? null
            ) as { id: number } | null;

            if (!caseResult || typeof caseResult.id !== 'number') {
                 throw new Error('Failed to insert case or retrieve ID.');
            }
            caseId = caseResult.id;

            // Insert item links
            for (const item of body.items) {
                insertItemLinkStmt.run(
                    caseId,
                    item.item_template_id,
                    item.override_name?.trim() ?? null, // Use null if empty or null
                    item.color.trim()
                );
            }

            db.exec('COMMIT');
            console.log(`Case '${body.name}' (ID: ${caseId}) and ${body.items.length} item links inserted successfully.`);
            return c.json({ message: 'Case created successfully', caseId: caseId }, 201);

        } catch (dbError) {
            console.error('Case creation transaction failed, rolling back:', dbError);
            db.exec('ROLLBACK'); // Rollback DB changes
            const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
            return c.json({ error: `Database error during case creation: ${errorMessage}` }, 500);
        }
        // --- End Database Insertion ---

    } catch (error: any) {
        console.error('Error processing POST /api/cases (template linking):', error);
         if (error instanceof SyntaxError) {
             return c.json({ error: 'Invalid JSON request body.' }, 400);
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
