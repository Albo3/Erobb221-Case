# Erobb221-Case Project Context (Updated)

## Overview
<!-- UPDATED: Removed dev commands -->
This project is a web application simulating case openings, similar to CS:GO. The main view shows the case opening interface. An "Admin Mode" (toggled via a hidden puzzle: set volume to 99%, click 'o' in header title, then enter password `caseAdmin!`) reveals tabs for managing reusable "Item Templates" (base name, image, sound, rules) and creating/editing custom cases (selecting templates, assigning rarity/color, adding a case image). Users can open selected cases to receive a random item based on defined odds. Unboxing history is stored in the browser's local storage.

## Tech Stack

*   **Frontend:** React (v19) with TypeScript, built using Bun.
*   **Backend:** Hono (v4) running on Bun, serving a REST API.
*   **Database:** SQLite (`database.sqlite` file at project root), accessed via `bun:sqlite`.
*   **Styling:** Plain CSS (`style.css`, `cs16.css`, `CaseOpener.css`).
*   **Development:** `concurrently` is used to run frontend and backend dev servers simultaneously (`bun run dev`).
*   **File Storage:** User-uploaded images (for cases and item templates) and sounds (for item templates) are stored locally in the `uploads/` directory at the project root.
*   **State Management:** Primarily component state (`useState`), with unbox history persisted in `localStorage`.
*   **Process Management (Production):** `pm2` is used to keep the backend server running persistently. <!-- ADDED -->
*   **Deployment:** Served via Nginx, with Cloudflare handling HTTPS and CDN. <!-- ADDED -->
bun run dev:backend
bun run --hot public/index.html
caseAdmin!
 bun run server/index.ts


 NODE_ENV=production bun build ./src/index.tsx --outdir ./build

 cp ./public/index.html ./build/ && cp -r ./public/sounds ./build/
## Project Structure

.
├── .gitignore
├── bun.lock
├── database.sqlite       # SQLite database file (SHOULD BE IGNORED BY GIT)
├── package.json          # Project config, dependencies, scripts
├── README.md
├── tsconfig.json         # TypeScript config
├── CONTEXT.md            # This file
├── public/
│   └── index.html        # Base HTML template (copied to build)
│   └── sounds/           # Base sounds (copied to build)
├── server/
│   └── index.ts          # Hono backend server, API logic, DB setup, static file serving
├── src/
│   ├── index.tsx         # Frontend entry point, React root render
│   ├── config.ts         # Frontend configuration (API URL) <!-- UPDATED -->
│   ├── logger.ts         # Basic console logger
│   ├── components/       # React components
│   │   ├── App.tsx       # Main application component, includes Tabs
│   │   ├── CaseOpener.css # Styles for CaseOpener
│   │   ├── CaseOpener.tsx # Component for opening cases, fetching data, animation
│   │   ├── CreateCaseForm.tsx # Component for creating/editing cases using Item Templates
│   │   ├── ItemTemplateManager.tsx # Component for creating/editing Item Templates
│   │   ├── StyledButton.tsx # Reusable button component
│   │   ├── Tabs.tsx      # Basic Tabs component
│   │   └── WheelSpinner.tsx # Case opening wheel component <!-- ADDED -->
│   │   └── WheelSpinner.css # Styles for WheelSpinner <!-- ADDED -->
│   └── styles/           # CSS files
│       ├── cs16.css      # Specific styles
│       └── style.css     # Global styles
├── build/                # Production build output directory (served by Nginx) <!-- ADDED -->
│   ├── index.html        # Generated HTML entry point
│   ├── index.js          # Compiled JavaScript bundle
│   ├── index.css         # Compiled CSS bundle
│   └── sounds/           # Copied sounds
└── uploads/              # Directory for user-uploaded files (SHOULD BE IGNORED BY GIT)
    ├── images/           # Uploaded images for item templates/cases
    └── sounds/           # Uploaded sounds for item templates

## Database Schema (`database.sqlite` - v5)

Managed via `server/index.ts` using `CREATE TABLE` and `ALTER TABLE` statements and a simple versioning system (`db_meta` table).

*   **`db_meta`**
    *   `key` (TEXT PRIMARY KEY): e.g., 'version'
    *   `value` (TEXT): e.g., '5'
*   **`item_templates`**
    *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
    *   `base_name` (TEXT NOT NULL UNIQUE): Base name for the template (e.g., "AK-47 Redline").
    *   `image_path` (TEXT): Relative path to image file in `uploads/images/` (nullable).
    *   `sound_path` (TEXT): Relative path to sound file in `uploads/sounds/` (nullable).
    *   `rules_text` (TEXT): Rules text content (nullable).
    *   `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
*   **`cases`**
    *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
    *   `name` (TEXT NOT NULL)
    *   `description` (TEXT)
    *   `image_path` (TEXT): Relative path to case image file in `uploads/images/` (nullable).
    *   `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
*   **`case_items`** (Linking Table)
    *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
    *   `case_id` (INTEGER NOT NULL, FOREIGN KEY -> cases.id ON DELETE CASCADE)
    *   `item_template_id` (INTEGER NOT NULL, FOREIGN KEY -> item_templates.id ON DELETE CASCADE)
    *   `override_name` (TEXT): Optional name override for this specific instance (nullable).
    *   `color` (TEXT NOT NULL): Rarity color specific to this instance in this case.

## Backend API (`server/index.ts` on port 3001)

*   Uses Hono framework.
*   Provides CORS for configured origins (including `https://erobb221.live`). <!-- UPDATED -->
*   Serves static files from `/uploads/*`.
*   **`GET /api/item-templates`**: Returns a list of all item templates.
*   **`POST /api/item-templates`**: Creates a new item template. Expects `multipart/form-data` with `base_name`, optional `rules_text`, optional `image_file`, optional `sound_file`, optional `existing_image_path`, optional `existing_sound_path`. Saves files, stores paths/text in DB.
*   **`PUT /api/item-templates/:id`**: Updates an existing item template. Expects `multipart/form-data` similar to POST, plus optional `clear_image` and `clear_sound` flags. Handles file replacement/clearing and updates DB.
*   **`GET /api/existing-assets`**: Returns distinct non-null `image_path` and `sound_path` values currently used in `item_templates`. Used for selection dropdowns in forms.
*   **`GET /api/cases`**: Returns a list of all cases (`{ id, name, image_path }`).
*   **`POST /api/cases`**: Creates a new case. Expects `multipart/form-data` with `name`, optional `description`, `items` (as a JSON string `[{ item_template_id, color, override_name? }]`), optional `image_file`, optional `existing_image_path`. Saves image file (if new), stores path in DB, creates case, and links items in `case_items`.
*   **`PUT /api/cases/:id`**: Updates an existing case. Expects `multipart/form-data` similar to POST, plus optional `clear_image` flag. Handles image replacement/clearing, updates case details, and replaces item links in `case_items`.
*   **`DELETE /api/cases/:id`**: Deletes a case and its linked items (via DB cascade). Also attempts to delete the associated case image file from storage.
*   **`GET /api/cases/:id`**: Returns details for a specific case (including `image_path`), joining with `item_templates` to get the effective item details (`name`, `color`, `image_url`, `sound_url`, `rules`).
*   **`POST /api/verify-admin`**: Expects JSON `{ "password": "attempt" }`. Compares the attempt against a stored bcrypt hash and returns `{ "success": true/false }`.

## Frontend Components

*   **`App.tsx`**: Main application component.
    *   Manages overall layout (centered main content area, history panel fixed to the right).
    *   Contains header with title and volume control.
    *   Implements the admin mode puzzle (volume 99% + click 'o' in title) and subsequent password prompt (`window.prompt`) which calls `/api/verify-admin`.
    *   Manages `unboxedHistory` state (up to 15 items) using `localStorage` for persistence.
    *   Conditionally renders either just `<CaseOpener />` or a `<Tabs />` component based on `isAdminMode`.
    *   Passes `volume`, `onVolumeChange`, and `onNewUnbox` props down to `CaseOpener`.
    *   Renders the history panel.
*   **`ItemTemplateManager.tsx`**: (Accessed via Admin Mode Tab)
    *   Displays existing item templates.
    *   Form to create/edit item templates:
        *   Input for `base_name`.
        *   Option to upload a *new* image OR select an *existing* image path.
        *   Option to upload a *new* sound OR select an *existing* sound path.
        *   Textarea for optional `rules_text`.
        *   Handles submitting `multipart/form-data` to `POST` or `PUT /api/item-templates`.
*   **`CreateCaseForm.tsx`**: (Accessed via Admin Mode Tab)
    *   Dropdown to select an existing case for editing, or create a new one.
    *   Inputs for case name and description.
    *   Case Image section: Allows uploading a *new* image OR selecting an *existing* image path (shared pool with item templates). Includes preview and clear option when editing.
    *   Dynamically add/remove item rows. Each row allows:
        *   Selecting an existing `ItemTemplate` via dropdown.
        *   Entering an optional `override_name`.
        *   Selecting a `color` (rarity) via dropdown.
        *   Displays calculated weighted odds based on rarity distribution.
    *   Handles submitting `multipart/form-data` (including image choice and items as JSON string) to `POST` or `PUT /api/cases`.
    *   Includes a "Delete Case" button (active when editing) with confirmation dialog, triggering `DELETE /api/cases/:id`.
*   **`CaseOpener.tsx`**: (Main view or via Admin Mode Tab)
    *   Receives `volume`, `onVolumeChange`, `onNewUnbox` props from `App`.
    *   Fetches and displays available cases (`GET /api/cases`) in a responsive grid layout at the bottom.
        *   Grid items show case image (if available) filling the background, with name overlaid.
        *   Clicking a grid item selects the case.
    *   Displays selected case name and description (if description exists) above the reel.
    *   Displays the case opening reel animation (items show image and larger, outlined text).
    *   Includes a larger "Open Case" button below the reel.
    *   Displays the winning item details (name, image, rules) in a dedicated area *above* the reel after opening.
    *   Calls `onNewUnbox` prop with the won item details.
    *   Plays item sound (if available) on win.
*   **`WheelSpinner.tsx`**: Handles the visual spinning wheel logic and display. <!-- ADDED -->
*   **`Tabs.tsx`**: Basic component to render tabs and content (used only in Admin Mode).
*   **`StyledButton.tsx`**: Reusable button component.

## Deployment & Build Process <!-- ADDED -->

*   **Nginx:** Configured to serve static files from the `./build` directory on HTTP port 80. It proxies requests starting with `/api/` to the backend Hono server running on port 3001. It also serves files directly from the `./uploads/` directory.
*   **Cloudflare:** Used as a proxy in front of Nginx. It handles HTTPS termination (SSL) and provides CDN caching for static assets. DNS records for the domain should be set to "Proxied" in Cloudflare.
*   **Backend Process:** The Hono backend (`server/index.ts`) is run persistently using `pm2`. It's started via `pm2 start bun --name "erobb-backend" -- run server/index.ts` and configured to restart automatically on server boot.
*   **Frontend Build:** A production build is created using `NODE_ENV=production bun build ./src/index.tsx --outdir ./build`. The static files from `./public` (`index.html`, `sounds/`) must then be manually copied into `./build`. The `build/index.html` file needs its `<script>` and `<link>` tags updated to point to `./index.js` and `./index.css` respectively.
*   **Frontend Config:** `src/config.ts` is configured to always use relative paths (`API_BASE_URL = ''`) for API calls, ensuring requests go to `/api/...` which Nginx can proxy.

## Current Status

*   Core functionality for creating/editing Item Templates (with images/sounds/rules) and Cases (with images/items) is implemented.
*   Case opening simulation with weighted odds, item display (image/text), and media playback is functional.
*   Case selection uses a grid layout with case images.
*   Layout rearranged with won item display above reel, selection below.
*   Admin mode toggle controls visibility of management tabs.
*   Unbox history (last 15 items) is displayed in a side panel and persists in `localStorage`.
*   Case deletion functionality added with confirmation.
*   Admin mode toggle replaced with a puzzle/password mechanism (volume 99% -> click 'o' -> enter password).
*   Database schema (v5) supports case images.
*   File uploads (case images, item template images/sounds) are stored locally in the `uploads/` directory.
*   Backend validation added for uploads:
    *   Images: Max size 2MB, specific MIME types allowed.
    *   Audio: Max duration 15s, specific MIME types allowed.
*   Backend server runs persistently using `pm2`. <!-- ADDED -->
*   Deployment uses Nginx behind Cloudflare. <!-- ADDED -->
*   Frontend build process requires manual steps for copying/fixing `index.html`. <!-- ADDED -->
