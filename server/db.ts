import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs'; // For ensuring upload dirs exist
import { UPLOADS_DIR, IMAGES_DIR, SOUNDS_DIR, DB_VERSION } from './constants'; // Import constants

// --- Database Setup ---
const db = new Database('database.sqlite', { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;'); // Ensure foreign key constraints are enforced

// Ensure upload directories exist on startup
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR);
if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR);
if (!existsSync(SOUNDS_DIR)) mkdirSync(SOUNDS_DIR);


// --- Database Migration ---
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

export { db }; // Export the initialized database instance
