import React from 'react';
import CaseOpener from './CaseOpener';
import CreateCaseForm from './CreateCaseForm';
import ItemTemplateManager from './ItemTemplateManager'; // Import the renamed component
import Tabs, { Tab } from './Tabs';
import '../styles/style.css';
import './CaseOpener.css';
// Assuming Tabs.css might be needed if it exists and has styles
// import './Tabs.css'; // Add if Tabs.css exists and is needed

function App() {
  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)', paddingBottom: '5px' }}>
          Erobb221 Case Manager
        </h1>
        <p style={{ color: 'var(--secondary-text)', marginTop: '5px' }}>Open and Create Cases</p>
      </header>

      {/* Use Tabs component */}
      <Tabs>
        <Tab label="Open Case">
          <main> {/* Keep main semantic tag inside the tab content */}
            <CaseOpener />
          </main>
        </Tab>
        <Tab label="Create Case">
           <main>
            <CreateCaseForm />
           </main>
        </Tab>
        <Tab label="Item Templates"> {/* Update tab label */}
           <main>
             <ItemTemplateManager /> {/* Use the renamed component */}
           </main>
        </Tab>
      </Tabs>

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
