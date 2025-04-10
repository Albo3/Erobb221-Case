import React, { useState } from 'react';
import { getApiUrl } from '../config';
import CaseOpener from './CaseOpener';
import WheelSpinner from './WheelSpinner'; // Import the new component
import CreateCaseForm from './CreateCaseForm';
import ItemTemplateManager from './ItemTemplateManager';
import Tabs, { Tab } from './Tabs'; // Re-add import
import '../styles/style.css';
import './CaseOpener.css';
// Assuming Tabs.css might be needed if it exists and has styles
// import './Tabs.css'; // Add if Tabs.css exists and is needed

// Define CaseItem interface (needed for history state)
// Align with CaseOpener/WheelSpinner after recent changes
interface CaseItem {
  name: string;
  display_color: string; // Use display_color
  percentage_chance: number; // Add percentage_chance (though not directly used in history display)
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
  item_template_id?: number; // Keep optional
}


function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [displayMode, setDisplayMode] = useState<'case' | 'wheel'>('case'); // State for display mode
  const [volume, setVolume] = useState(0.5);
  const [sequenceState, setSequenceState] = useState(0); // 0: initial, 1: volume correct
  const [currentItemRules, setCurrentItemRules] = useState<string | null>(null); // State for current item's rules
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
  const handleInteraction = async () => { // Make async for fetch
    console.log("Interaction triggered. Current sequence state:", sequenceState);
    if (sequenceState === 1) {
      const passwordAttempt = window.prompt("Enter admin password:");
      if (passwordAttempt !== null) { // Check if user clicked OK (null if Cancel)
        try {
          const response = await fetch(getApiUrl('/api/verify-admin'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password: passwordAttempt }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setIsAdminMode(!isAdminMode); // Toggle admin mode on success
              console.log("Admin mode toggled to:", !isAdminMode);
              alert("Admin mode " + (!isAdminMode ? "enabled." : "disabled."));
            } else {
              console.log("Password verification failed.");
              alert("Incorrect password.");
            }
          } else {
            console.error("Verification request failed:", response.status, response.statusText);
            alert("Verification failed. Status: " + response.status);
          }
        } catch (error) {
          console.error("Error during admin verification:", error);
          alert("An error occurred during verification.");
        }
      } else {
        console.log("Password prompt cancelled.");
      }
    }
    // Always reset sequence state after interaction attempt
    setSequenceState(0);
    console.log("Sequence state reset to 0 after interaction");
  };


  // Handler for receiving a new unboxed item from CaseOpener/WheelSpinner
  const handleNewUnbox = (newItem: CaseItem) => {
      // Update the rules display
      setCurrentItemRules(newItem.rules ?? null);

      // Update the history panel
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
            {/* Display Mode Radio Buttons */}
            {!isAdminMode && ( // Only show when not in admin mode
              <fieldset className="cs-fieldset" style={{ border: 'none', padding: 0, margin: 0 }}> {/* Remove default fieldset border/padding */}
                {/* Optional: Add a legend if desired, or remove if not needed */}
                {/* <legend>Select Mode</legend> */}
                <div className="radio-wrapper" style={{ marginBottom: '5px' }}> {/* Use div as wrapper, add spacing */}
                  <input
                    type="radio"
                    name="displayMode"
                    id="displayModeCase" // Add unique ID
                    value="case"
                    checked={displayMode === 'case'}
                    onChange={() => setDisplayMode('case')}
                  />
                  <label htmlFor="displayModeCase">Case Opening</label> {/* Use htmlFor */}
                </div>
                <div className="radio-wrapper"> {/* Use div as wrapper */}
                  <input
                    type="radio"
                    name="displayMode"
                    id="displayModeWheel" // Add unique ID
                    value="wheel"
                    checked={displayMode === 'wheel'}
                    onChange={() => setDisplayMode('wheel')}
                  />
                  <label htmlFor="displayModeWheel">Wheel Spin</label> {/* Use htmlFor */}
                </div>
              </fieldset>
            )}
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
      {/* Re-add className for styling */}
      <div className="main-content-area" style={{ maxWidth: '800px', margin: '0 auto' }}>
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
            // Non-admin mode: Render based on displayMode
            <main>
              {displayMode === 'case' ? (
                <CaseOpener volume={volume} onVolumeChange={handleVolumeChange} onNewUnbox={handleNewUnbox} />
              ) : (
                <WheelSpinner volume={volume} onVolumeChange={handleVolumeChange} onNewUnbox={handleNewUnbox} />
              )}
            </main>
          )}
        </div>

        {/* Footer */}
        <footer style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
          <p>&copy; {new Date().getFullYear()} Erobb221 Cases. Built with Bun, React, and TypeScript.</p>
        </footer>
      </div> {/* Close Centered Content Wrapper */}

      {/* Absolutely Positioned Rules Panel (Left) - Using CSS class */}
      <div className="rules-panel"> {/* Removed inline styles, added class */}
          <h4>Item Rules</h4>
          {currentItemRules ? (
              <p style={{ fontSize: '0.9em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {currentItemRules}
              </p>
          ) : (
              <p style={{ fontSize: '0.9em', color: 'var(--secondary-text)' }}>Unbox an item to see its rules.</p>
          )}
      </div>

      {/* Absolutely Positioned History Panel (Right) - Using CSS class */}
      <div className="history-panel-right"> {/* Removed inline styles, added class */}
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
                                  src={getApiUrl(item.image_url)}
                                  alt="" // Decorative
                                  style={{ width: '30px', height: '30px', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border-dark)' }}
                                  loading="lazy"
                              />
                          )}
                          {/* Use display_color for history item text */}
                          <span style={{ color: item.display_color, fontSize: '0.9em', wordBreak: 'break-word' }}>
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
