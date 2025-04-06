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
  const [volume, setVolume] = useState(0.5); // Add volume state here

  const handleAdminToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsAdminMode(event.target.checked);
  };

  // Handler for volume change (passed down)
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  return (
    // Removed top margin (changed '20px auto' to '0 auto 20px auto')
    // Reduced bottom margin for main container
    <div style={{ maxWidth: '800px', margin: '0 auto 10px auto', padding: '20px' }}>
      {/* Updated Header with Controls */}
      {/* Reduced marginBottom and paddingBottom */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
        {/* Left Side: Title/Subtitle */}
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ color: 'var(--accent)', margin: 0, paddingBottom: '2px', fontSize: '1.8em' }}>
            Erobb221 Case Manager
          </h1>
          <p style={{ color: 'var(--secondary-text)', margin: 0, fontSize: '0.9em' }}>Open and Create Cases</p>
        </div>

        {/* Right Side: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Volume Slider Placeholder (Actual JSX will be moved from CaseOpener) */}
          <div className="cs-slider" style={{ maxWidth: '150px' }}> {/* Adjusted width */}
            <div className="ruler"></div>
            <input
              id="volume-range-header" // Unique ID
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))} // Use handler
            />
            <label htmlFor="volume-range-header" style={{ fontSize: '0.8em' }}>Volume: {Math.round(volume * 100)}%</label>
          </div>
          {/* Admin Mode Toggle Checkbox */}
          <div style={{ fontSize: '0.9em' }}>
            <label>
              <input
                type="checkbox"
                checked={isAdminMode}
                onChange={handleAdminToggle}
                style={{ marginRight: '4px', verticalAlign: 'middle' }}
              />
              Admin Mode
            </label>
          </div>
        </div>
      </header>

      {/* Conditional Rendering based on isAdminMode */}
      {isAdminMode ? (
        <Tabs>
          <Tab label="Open Case">
            <main>
              {/* Pass volume state and handler down */}
              <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} />
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
           {/* Pass volume state and handler down */}
           <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} />
        </main>
      )}

      {/* Reduced marginTop */}
      <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
