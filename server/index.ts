import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger'; // Re-import the default logger
import { serveStatic } from 'hono/bun'; // Import serveStatic for serving files
import { db } from './db'; // Import the initialized db instance

// Import route handlers
import itemTemplatesApp from './routes/itemTemplates';
import casesApp from './routes/cases';
import adminApp from './routes/admin';
import faqApp from './routes/faq';

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
app.route('/api/faq', faqApp);

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

// --- Static & Root File Serving ---

// Explicitly serve robots.txt and sitemap.xml using Bun.file() to ensure they are not caught by the SPA fallback.
// This is the most reliable method as it uses Bun's native, high-performance file serving.
app.get('/robots.txt', (c) => {
    try {
        // Bun.file() automatically handles Content-Type for common extensions like .txt
        return new Response(Bun.file('./public/robots.txt'));
    } catch (error) {
        console.error('Could not serve robots.txt:', error);
        return c.notFound();
    }
});

app.get('/sitemap.xml', (c) => {
    try {
        const sitemapFile = Bun.file('./public/sitemap.xml');
        // We create a new Response to manually set the correct XML content-type, as it may not be inferred.
        return new Response(sitemapFile, {
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        });
    } catch (error) {
        console.error('Could not serve sitemap.xml:', error);
        return c.notFound();
    }
});

// Serve CSS from src/styles for the FAQ page
app.use('/styles/*', serveStatic({ root: './src' }));

// SPA Fallback: Serve static files from './public', and for any path that doesn't
// match a file, it will serve the SPA entry point (e.g., index.html).
// This MUST come after all other specific routes.
app.use('/*', serveStatic({ root: './public' }));

// --- Server Start ---
const port = 3001;
console.log(`Hono server listening on port ${port}`);

export default {
  port: port,
  fetch: app.fetch,
};

// Export db if it needs to be accessed directly elsewhere (though ideally not needed outside routes/db)
export { db };
