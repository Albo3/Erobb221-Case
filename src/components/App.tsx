import React, { useState } from 'react'; // Import useState
import CaseOpener from './CaseOpener';
import CreateCaseForm from './CreateCaseForm'; // Re-add import
import ItemTemplateManager from './ItemTemplateManager'; // Re-add import
import Tabs, { Tab } from './Tabs'; // Re-add import
import '../styles/style.css';
import './CaseOpener.css';
// Assuming Tabs.css might be needed if it exists and has styles
// import './Tabs.css'; // Add if Tabs.css exists and is needed

// Define CaseItem interface (needed for history state)
// Copied from CaseOpener.tsx - ensure consistency if CaseItem changes
interface CaseItem {
  name: string;
  color: string;
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
}


function App() {
  const [isAdminMode, setIsAdminMode] = useState(false); // State for admin mode
  const [volume, setVolume] = useState(0.5);
  const [unboxedHistory, setUnboxedHistory] = useState<CaseItem[]>(() => {
      // Load initial history from localStorage
      try {
          const storedHistory = localStorage.getItem('unboxHistory');
          return storedHistory ? JSON.parse(storedHistory) : [];
      } catch (e) {
          console.error("Failed to parse history from localStorage", e);
          return [];
      }
  });

  const handleAdminToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsAdminMode(event.target.checked);
  };

  // Handler for volume change (passed down)
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  // Handler for receiving a new unboxed item from CaseOpener
  const handleNewUnbox = (newItem: CaseItem) => {
      setUnboxedHistory(prevHistory => {
          const updatedHistory = [newItem, ...prevHistory].slice(0, 10); // Add to start, limit to 10
          // Save updated history to localStorage
          try {
              localStorage.setItem('unboxHistory', JSON.stringify(updatedHistory));
          } catch (e) {
              console.error("Failed to save history to localStorage", e);
          }
          return updatedHistory;
      });
  };

  // Effect to load history on initial mount (already handled in useState initializer)
  // useEffect(() => { ... }, []); // No longer strictly needed here

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

      {/* Main Content Area with History Panel */}
      <div style={{ display: 'flex', gap: '20px' }}> {/* Flex container for main content + history */}

        {/* Left Column (Tabs or CaseOpener) */}
        <div style={{ flexGrow: 1 }}>
          {isAdminMode ? (
            <Tabs>
              <Tab label="Open Case">
                <main>
                  {/* Pass volume state and handler down */}
                  <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} onNewUnbox={handleNewUnbox} />
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
              <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} onNewUnbox={handleNewUnbox} />
            </main>
          )}
        </div>

        {/* Right Column (History Panel) */}
        <div className="history-panel" style={{ width: '200px', flexShrink: 0, borderLeft: '1px solid var(--border-color)', paddingLeft: '15px', maxHeight: 'calc(100vh - 100px)', /* Adjust based on header/footer height */ overflowY: 'auto' }}>
            <h4>Unbox History</h4>
            {unboxedHistory.length === 0 ? (
                <p style={{ fontSize: '0.9em', color: 'var(--secondary-text)' }}>No items unboxed yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {unboxedHistory.map((item, index) => (
                        <li key={`${item.name}-${index}-${Math.random()}`} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Optional: Small image preview */}
                            {item.image_url && (
                                <img
                                    src={`http://localhost:3001${item.image_url}`}
                                    alt="" // Decorative
                                    style={{ width: '30px', height: '30px', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border-dark)' }}
                                    loading="lazy"
                                />
                            )}
                            <span style={{ color: item.color, fontSize: '0.9em', wordBreak: 'break-word' }}>
                                {item.name}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>

      {/* Reduced marginTop */}
      <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
