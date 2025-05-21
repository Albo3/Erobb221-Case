import { Hono } from 'hono';
import type { HonoRequest } from 'hono'; // Use type-only import
import { db } from '../db'; // Import the shared db instance
import { IMAGES_DIR } from '../constants'; // Import constants
import { saveUploadedFile, validateCaseItems, validateUploadedFile, type CaseItemLinkData } from '../utils'; // Import helpers
import { unlink } from 'node:fs/promises'; // For deleting files
import { join } from 'node:path'; // For path manipulation

const casesApp = new Hono();

// --- Case API Routes ---

// GET /api/cases - Fetch list of all cases (ID, Name, image_path)
casesApp.get('/', (c) => {
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

// GET /api/cases/:id - Fetch details for a specific case and its items
casesApp.get('/:id', (c) => {
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
                COALESCE(ci.override_rules_text, it.rules_text) as rules_text -- Use COALESCE for rules
            FROM case_items ci
            JOIN item_templates it ON ci.item_template_id = it.id
            WHERE ci.case_id = ?
            ORDER BY ci.display_order ASC -- Order by display_order
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
            rules_text: string | null; // Changed from rules to rules_text to match COALESCE alias
        }>;

        // Process raw items to create the final structure for the frontend
        const items = itemsRaw.map(item => ({
            item_template_id: item.item_template_id,
            name: item.override_name ?? item.base_name,
            percentage_chance: item.percentage_chance, // Include percentage
            display_color: item.display_color,         // Include display color
            image_url: item.image_url,
            sound_url: item.sound_url,
            rules_text: item.rules_text, // Use rules_text
            // Include override_name separately if needed by frontend edit logic
            override_name: item.override_name
            // override_rules_text will be implicitly handled by rules_text from COALESCE
        }));


        const result = { ...caseDetails, items: items };
        return c.json(result);

    } catch (dbError) {
        console.error(`Database error fetching case ${id}:`, dbError);
        return c.json({ error: 'Database error fetching case details.' }, 500);
    }
});

// POST /api/cases - Create a new case (handles multipart/form-data, uses new item structure)
casesApp.post('/', async (c) => {
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
            const validationError = validateCaseItems(items, c.req);
            if (validationError) {
                return c.json({ error: validationError }, 400);
            }
        } catch (parseError) {
            return c.json({ error: 'Invalid items JSON format.' }, 400);
        }
        // --- End Basic Validation ---

        // --- File Validation ---
        const imageValidationError = await validateUploadedFile(imageFile, 'image');
        if (imageValidationError) return c.json({ error: imageValidationError }, 400);
        // --- End File Validation ---

        // --- Database Insertion (Transaction) ---
        const insertCaseStmt = db.prepare('INSERT INTO cases (name, description, image_path) VALUES (?, ?, ?) RETURNING id');
        // Update insert statement for case_items with new columns, including override_rules_text and display_order
        const insertItemLinkStmt = db.prepare(`
            INSERT INTO case_items
            (case_id, item_template_id, override_name, percentage_chance, display_color, override_rules_text, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
            for (const [index, item] of items.entries()) { // Use .entries() to get index for display_order
                insertItemLinkStmt.run(
                    caseId,
                    item.item_template_id,
                    item.override_name?.trim() ?? null,
                    item.percentage_chance, // Use new percentage
                    item.display_color,       // Use new display color
                    item.override_rules_text?.trim() ?? null, // Add override_rules_text
                    index // Use array index as display_order
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
casesApp.put('/:id', async (c) => {
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
        const imageValidationError = await validateUploadedFile(imageFile, 'image');
        if (imageValidationError) return c.json({ error: imageValidationError }, 400);
        // --- End File Validation ---

        // --- Database Update (Transaction) ---
        const updateCaseStmt = db.prepare('UPDATE cases SET name = ?, description = ?, image_path = ? WHERE id = ?');
        const deleteOldItemsStmt = db.prepare('DELETE FROM case_items WHERE case_id = ?');
        // Update insert statement for case_items with new columns, including override_rules_text and display_order
        const insertItemLinkStmt = db.prepare(`
            INSERT INTO case_items
            (case_id, item_template_id, override_name, percentage_chance, display_color, override_rules_text, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
            for (const [index, item] of items.entries()) { // Use .entries() to get index for display_order
                insertItemLinkStmt.run(
                    caseId,
                    item.item_template_id,
                    item.override_name?.trim() ?? null,
                    item.percentage_chance, // Use new percentage
                    item.display_color,       // Use new display color
                    item.override_rules_text?.trim() ?? null, // Add override_rules_text
                    index // Use array index as display_order
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
casesApp.delete('/:id', async (c) => {
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

export default casesApp;
