import React from 'react';
import CaseOpener from './CaseOpener'; // Import CaseOpener component
import '../styles/style.css'; // Import global styles
import './CaseOpener.css'; // Import CaseOpener specific styles

function App() {
  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)', paddingBottom: '5px' }}>
          Erobb221 Case Opener
        </h1>
        <p style={{ color: 'var(--secondary-text)', marginTop: '5px' }}>Let's open some cases!</p>
      </header>

      <main>
        <CaseOpener />
      </main>

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
