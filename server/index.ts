import { Hono } from 'hono';
import { cors } from 'hono/cors'; // Import CORS middleware
import { Database } from 'bun:sqlite';

// --- Database Setup ---
const db = new Database('database.sqlite', { create: true });

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL;');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS case_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    weight INTEGER NOT NULL,
    color TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases (id) ON DELETE CASCADE
  );
`);

console.log('Database initialized and tables ensured.');

// --- Hono App Setup ---
const app = new Hono();

// --- Middleware ---
// Apply CORS middleware to allow requests from the frontend origin
app.use('/api/*', cors({
  origin: 'http://localhost:3000', // Allow frontend origin
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed methods
  allowHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
}));


// --- API Routes ---
app.get('/', (c) => c.text('Hono Server Running!'));

// GET /api/cases - Fetch list of all cases (ID and Name)
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

// GET /api/cases/:id - Fetch details for a specific case and its items
app.get('/api/cases/:id', (c) => {
    const idParam = c.req.param('id');
    const id = parseInt(idParam, 10); // Ensure ID is a number
    console.log(`GET /api/cases/${id} requested`);

    if (isNaN(id)) {
        return c.json({ error: 'Invalid case ID provided.' }, 400);
    }

    try {
        // Fetch case details
        const caseStmt = db.prepare('SELECT id, name, description FROM cases WHERE id = ?');
        const caseDetails = caseStmt.get(id) as { id: number; name: string; description: string | null } | null;

        if (!caseDetails) {
            return c.json({ error: 'Case not found.' }, 404);
        }

        // Fetch associated items
        const itemsStmt = db.prepare('SELECT name, weight, color FROM case_items WHERE case_id = ?');
        const items = itemsStmt.all(id) as Array<{ name: string; weight: number; color: string }>;

        // Combine and return
        const result = {
            ...caseDetails,
            items: items,
        };
        return c.json(result);

    } catch (dbError) {
        console.error(`Database error fetching case ${id}:`, dbError);
        return c.json({ error: 'Database error fetching case details.' }, 500);
    }
});

// --- API Route Implementations ---

// Define expected request body structure for creating a case
interface CreateCaseRequestBody {
    name: string;
    description?: string; // Optional description
    items: Array<{
        name: string;
        weight: number;
        color: string;
    }>;
}

// POST /api/cases - Create a new case
app.post('/api/cases', async (c) => {
    console.log('POST /api/cases requested');
    try {
        const body = await c.req.json<CreateCaseRequestBody>();

        // --- Basic Validation ---
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            return c.json({ error: 'Case name is required.' }, 400);
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
            return c.json({ error: 'Case must contain at least one item.' }, 400);
        }
        for (const item of body.items) {
            if (!item.name || typeof item.name !== 'string' || item.name.trim() === '' ||
                !item.weight || typeof item.weight !== 'number' || item.weight <= 0 ||
                !item.color || typeof item.color !== 'string' || item.color.trim() === '') {
                return c.json({ error: 'Each item must have a valid name, positive weight, and color.' }, 400);
            }
        }
        // --- End Validation ---


        // --- Database Insertion (Transaction) ---
        const insertCaseStmt = db.prepare('INSERT INTO cases (name, description) VALUES (?, ?) RETURNING id');
        const insertItemStmt = db.prepare('INSERT INTO case_items (case_id, name, weight, color) VALUES (?, ?, ?, ?)');

        let caseId: number | null = null;
        try {
            db.exec('BEGIN TRANSACTION');

            // Explicitly type the expected result from the RETURNING clause
            const caseResult = insertCaseStmt.get(
                body.name.trim(),
                body.description?.trim() ?? null
            ) as { id: number } | null; // Type assertion

            if (!caseResult || typeof caseResult.id !== 'number') {
                 console.error("Insert case statement did not return a valid ID:", caseResult);
                 throw new Error('Failed to insert case or retrieve ID.');
            }
            caseId = caseResult.id; // Now TS knows caseResult.id is a number

            for (const item of body.items) {
                insertItemStmt.run(caseId, item.name.trim(), item.weight, item.color.trim());
            }

            db.exec('COMMIT');
            console.log(`Case '${body.name}' (ID: ${caseId}) and ${body.items.length} items inserted successfully.`);

            return c.json({ message: 'Case created successfully', caseId: caseId }, 201); // 201 Created

        } catch (dbError) {
            console.error('Database transaction failed:', dbError);
            db.exec('ROLLBACK'); // Rollback on error
            return c.json({ error: 'Database error during case creation.' }, 500);
        }
        // --- End Database Insertion ---

    } catch (error: any) {
        // Handle JSON parsing errors or other unexpected errors
        console.error('Error processing POST /api/cases:', error);
        if (error instanceof SyntaxError) {
             return c.json({ error: 'Invalid JSON request body.' }, 400);
        }
        return c.json({ error: 'An unexpected error occurred.' }, 500);
    }
});


// --- Server Start ---
const port = 3001; // Use a different port than the frontend dev server
console.log(`Hono server listening on port ${port}`);

// Use Bun's built-in serve
export default {
  port: port,
  fetch: app.fetch,
};

// Export db for potential use in other modules if needed (remains the same)
export { db };
