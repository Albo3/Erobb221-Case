import React, { useState } from 'react'; // Import useState
import CaseOpener from './CaseOpener';
import CreateCaseForm from './CreateCaseForm'; // Re-add import
import ItemTemplateManager from './ItemTemplateManager'; // Re-add import
import Tabs, { Tab } from './Tabs'; // Re-add import
import '../styles/style.css';
import './CaseOpener.css';
// Assuming Tabs.css might be needed if it exists and has styles
// import './Tabs.css'; // Add if Tabs.css exists and is needed

function App() {
  const [isAdminMode, setIsAdminMode] = useState(false); // State for admin mode

  const handleAdminToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsAdminMode(event.target.checked);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '15px' }}> {/* Reduced bottom margin */}
        <h1 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)', paddingBottom: '5px' }}>
          Erobb221 Case Manager
        </h1>
        <p style={{ color: 'var(--secondary-text)', marginTop: '5px' }}>Open and Create Cases</p>
      </header>

      {/* Admin Mode Toggle Checkbox */}
      <div style={{ textAlign: 'right', marginBottom: '15px' }}>
        <label>
          <input
            type="checkbox"
            checked={isAdminMode}
            onChange={handleAdminToggle}
          />
          Admin Mode
        </label>
      </div>

      {/* Conditional Rendering based on isAdminMode */}
      {isAdminMode ? (
        <Tabs>
          <Tab label="Open Case">
            <main>
              <CaseOpener />
            </main>
          </Tab>
          <Tab label="Create Case">
            <main>
              <CreateCaseForm />
            </main>
          </Tab>
          <Tab label="Item Templates">
            <main>
              <ItemTemplateManager />
            </main>
          </Tab>
        </Tabs>
      ) : (
        <main>
          <CaseOpener />
        </main>
      )}

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
