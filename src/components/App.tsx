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
  const [sequenceState, setSequenceState] = useState(0); // 0: initial, 1: volume correct
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
    // Update sequence state based on volume
    if (newVolume === 0.99) {
      setSequenceState(1);
      console.log("Sequence state set to 1 (volume correct)");
    } else if (sequenceState === 1) {
      // Reset if volume changes away from 0.99 *after* being set correctly
      setSequenceState(0);
      console.log("Sequence state reset to 0 (volume changed)");
    }
  };

  // Handler for the 'o' click interaction
  const handleInteraction = () => {
    console.log("Interaction triggered. Current sequence state:", sequenceState);
    if (sequenceState === 1) {
      setIsAdminMode(!isAdminMode); // Toggle admin mode
      console.log("Admin mode toggled to:", !isAdminMode);
    }
    // Always reset sequence state after interaction attempt
    setSequenceState(0);
    console.log("Sequence state reset to 0 after interaction");
  };


  // Handler for receiving a new unboxed item from CaseOpener
  const handleNewUnbox = (newItem: CaseItem) => {
      setUnboxedHistory(prevHistory => {
          const updatedHistory = [newItem, ...prevHistory].slice(0, 15); // Add to start, limit to 15
          // Save updated history to localStorage
          try {
              localStorage.setItem('unboxHistory', JSON.stringify(updatedHistory));
          } catch (e) {
              console.error("Failed to save history to localStorage", e);
          }
          return updatedHistory;
      });
  };

  return (
    // Add position relative for absolute child positioning
    <div style={{ padding: '20px', position: 'relative', minHeight: 'calc(100vh - 40px)' /* Ensure container takes height */ }}>
      {/* Header (content centered inside) */}
      <header style={{ marginBottom: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Left Side: Title/Subtitle */}
          <div style={{ textAlign: 'left' }}>
            <h1 style={{ color: 'var(--accent)', margin: 0, paddingBottom: '2px', fontSize: '1.8em' }}>
              Er<span onClick={handleInteraction} style={{ cursor: 'pointer' }}>o</span>bb221 Case Manager
            </h1>
            <p style={{ color: 'var(--secondary-text)', margin: 0, fontSize: '0.9em' }}></p>
          </div>
          {/* Right Side: Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Volume Slider */}
            <div className="cs-slider" style={{ maxWidth: '150px' }}>
              <div className="ruler"></div>
              <input
                id="volume-range-header"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              />
              <label htmlFor="volume-range-header" style={{ fontSize: '0.8em' }}>Volume: {Math.round(volume * 100)}%</label>
            </div>
            {/* Admin Mode Toggle Checkbox REMOVED */}
          </div>
        </div> {/* Close header centering wrapper div */}
      </header>

      {/* Wrapper for Centered Main Content + Footer */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Main Content Area */}
        <div>
          {isAdminMode ? (
            <Tabs>
              <Tab label="Open Case">
                <main>
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
              <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} onNewUnbox={handleNewUnbox} />
            </main>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
          <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
        </footer>
      </div> {/* Close Centered Content Wrapper */}

      {/* Absolutely Positioned History Panel */}
      {/* Adjust top value based on actual header height + desired spacing */}
      {/* Use vh units for max height relative to viewport */}
      <div className="history-panel" style={{ position: 'absolute', top: '80px', right: '20px', width: '200px', borderLeft: '1px solid var(--border-color)', paddingLeft: '15px', maxHeight: 'calc(100vh - 120px)', /* Adjusted calc */ overflowY: 'auto' }}>
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
    </div> // Close Outermost Container
  );
}

export default App;
