import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger'; // Re-import the default logger
import { serveStatic } from 'hono/bun'; // Import serveStatic for serving files
import { db } from './db'; // Import the initialized db instance

// Import route handlers
import itemTemplatesApp from './routes/itemTemplates';
import casesApp from './routes/cases';
import adminApp from './routes/admin';

// --- Hono App Setup ---
const app = new Hono();

// --- Middleware ---
// Logger - Apply to all routes using the default logger
app.use('*', logger());

// CORS for API routes - Apply to all /api/* paths
app.use('/api/*', cors({
  origin: ['http://localhost:3000', 'https://erobb221.live', 'https://www.erobb221.live'], // Explicitly allow dev and prod origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'], // Content-Type might be multipart/form-data now
}));

// Static file serving for uploads
// Serve files from './uploads' directory when URL path starts with '/uploads/'
app.use('/uploads/*', serveStatic({ root: './' }));

// --- API Routes ---
// Mount the routers under their respective base paths
app.route('/api/item-templates', itemTemplatesApp);
app.route('/api/cases', casesApp);
app.route('/api', adminApp); // Mount admin routes directly under /api (e.g., /api/verify-admin)

// Root route
app.get('/', (c) => c.text('Hono Server Running! Refactored Structure.'));

// GET /api/existing-assets - Fetch distinct existing image/sound paths from templates
// (Moved here from itemTemplates.ts to keep the original /api/existing-assets path)
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

// --- Server Start ---
const port = 3001;
console.log(`Hono server listening on port ${port}`);

export default {
  port: port,
  fetch: app.fetch,
};

// Export db if it needs to be accessed directly elsewhere (though ideally not needed outside routes/db)
export { db };
