## Brief overview
These guidelines outline the observed coding style, patterns, and conventions specific to the Erobb221-Case project, based on the existing codebase.

## Technology Stack & Environment
- **Frontend:** React v19 with TypeScript.
- **Backend:** Hono v4 with TypeScript.
- **Runtime/Build:** Bun is used for both frontend and backend.
- **Database:** SQLite, accessed via `bun:sqlite`.
- **Styling:** Plain CSS, organized into global (`src/styles/style.css`) and component-specific files (e.g., `src/components/CaseOpener.css`). CSS variables are used.

## Component Development (React)
- **Style:** Use functional components with React Hooks (`useState`, `useEffect`, `useMemo`, `useRef`, `useLayoutEffect`).
- **Typing:** Define TypeScript interfaces for props and complex state objects directly within component files. Use `PascalCase` for interfaces (e.g., `CaseItem`, `CaseOpenerProps`).
- **Props:** Pass state and event handlers down as props. Name event handler props clearly (e.g., `onNewUnbox`, `onCaseSelected`).
- **Structure:** Decompose complex UI into smaller, focused components (e.g., `ReelItem` within `CaseOpener`).

## State Management
- **Local State:** Use `useState` for component-level UI state.
- **Persistence:** Utilize `localStorage` for simple client-side persistence (like volume, display mode, history). Wrap access in `try...catch` blocks for robustness.
- **Shared State:** State shared between components (e.g., `selectedCaseId`, `unboxedHistory`) is currently managed in the nearest common ancestor (`App.tsx`) and passed down via props.

## Styling (CSS)
- **Organization:** Prefer external CSS files over inline styles. Use global styles (`style.css`) for base elements and layout, and component-specific CSS files for component styling.
- **Variables:** Use CSS variables (e.g., `var(--border-color)`) for theme consistency.
- **Selectors:** Use descriptive class names, often following `kebab-case` (e.g., `case-opener-viewport`, `case-grid-item`).

## TypeScript Usage
- **Interfaces:** Define interfaces for props, API data structures, and complex state objects.
- **Nullability:** Use union types (`| null`, `| undefined`) explicitly where values can be absent.
- **Type Safety:** Avoid using the `any` type; prefer specific types or `unknown` with type checking.

## API Interaction
- **Method:** Use the standard `fetch` API.
- **URL Management:** Centralize API base URL construction (e.g., `getApiUrl` from `src/config.ts`).
- **Async Handling:** Use `async/await` for asynchronous operations.
- **State Indicators:** Implement loading states (e.g., `isLoading`, `isLoadingCaseDetails`) to provide user feedback during API calls.
- **Error Handling:** Check `response.ok`. Parse JSON error bodies if available. Set error states in the component to display feedback to the user.

## Code Style & Formatting
- **Indentation:** Use 4 spaces.
- **Quotes:** Prefer single quotes (`'`) for strings and import paths.
- **Semicolons:** Use semicolons (`;`) at the end of statements.
- **Comments:** Use `//` for single-line comments and `/* */` for multi-line comments to explain complex logic.

## Naming Conventions
- **Components/Interfaces:** `PascalCase` (e.g., `CaseOpener`, `CaseData`).
- **Variables/Functions:** `camelCase` (e.g., `isSpinning`, `handleVolumeChange`).
- **CSS Classes:** `kebab-case` (e.g., `main-content-area`).
- **Constants:** `UPPER_SNAKE_CASE` (implied, e.g., for `API_BASE_URL`).

## File Structure
- Adhere to the established project structure:
  - `src/components/` for React components.
  - `src/styles/` for global CSS.
  - `server/routes/` for backend API route handlers.
  - Component-specific CSS files should reside near their corresponding component TSX file.
