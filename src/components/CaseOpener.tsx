import React, { useState, useEffect, useRef } from 'react';
// Removed matter import
import StyledButton from './StyledButton';
import './CaseOpener.css';
// Removed direct JSON import

// Define interfaces for case data structure (CaseItem remains the same)
interface CaseItem {
  name: string;
  weight: number;
  color: string;
}

interface CaseData {
  name: string;
  description: string;
  items: CaseItem[];
  // Add id if needed, based on API response
  id?: number;
}

// Interface for the list of cases fetched from /api/cases
interface CaseInfo {
    id: number;
    name: string;
}


const REEL_ITEM_WIDTH = 100; // Width of each item in pixels + margin
const SPIN_DURATION = 3000; // Duration of spin animation in ms


function CaseOpener() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(''); // Store ID as string from select value
  const [currentCaseData, setCurrentCaseData] = useState<CaseData | null>(null); // Holds data for the selected case
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  // Effect to fetch the list of available cases on mount
  useEffect(() => {
      setIsLoading(true);
      fetch('http://localhost:3001/api/cases') // Use full URL
          .then(response => {
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
          })
          .then((data: CaseInfo[]) => {
              setAvailableCases(data);
              if (data.length > 0 && data[0]) {
                  // Select the first case if available
                  setSelectedCaseId(data[0].id.toString());
              } else {
                  // No cases in DB, load a default fallback case
                  console.log("No cases found in DB, loading default fallback case.");
                  setCurrentCaseData({
                      id: 0, // Use 0 or a special ID for fallback
                      name: "Default Starter Case",
                      description: "A basic case loaded because the database is empty.",
                      items: [
                          { name: "Default Gray", weight: 50, color: "gray" },
                          { name: "Default Blue", weight: 30, color: "blue" },
                          { name: "Default Purple", weight: 15, color: "purple" },
                          { name: "Default Gold", weight: 5, color: "gold" },
                      ]
                  });
                  // Initialize reel for fallback case
                  setReelItems([
                      { name: "Default Gray", weight: 50, color: "gray" },
                      { name: "Default Blue", weight: 30, color: "blue" },
                      { name: "Default Purple", weight: 15, color: "purple" },
                      { name: "Default Gold", weight: 5, color: "gold" },
                  ].slice(0, 10));
                  setSelectedCaseId(''); // Ensure no ID is selected
              }
              setError(null);
          })
          .catch(err => {
              console.error("Error fetching available cases:", err);
              setError(`Failed to load available cases: ${err.message}`);
              setAvailableCases([]);
          })
          .finally(() => setIsLoading(false));
  }, []);

  // Effect to fetch details when selectedCaseId changes
  useEffect(() => {
      if (!selectedCaseId) {
          setCurrentCaseData(null); // Clear data if no case is selected
          return;
      }

      setIsLoading(true);
      setError(null); // Clear previous errors
      fetch(`http://localhost:3001/api/cases/${selectedCaseId}`) // Use full URL
          .then(response => {
              if (!response.ok) {
                  return response.json().then(errData => {
                      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                  }).catch(() => {
                      throw new Error(`HTTP error! status: ${response.status}`);
                  });
              }
              return response.json();
          })
          .then((data: CaseData) => {
              if (!data || !Array.isArray(data.items)) {
                   throw new Error("Invalid case data received from server.");
              }
              setCurrentCaseData(data);
              setReelItems(data.items.slice(0, 10)); // Initialize reel
          })
          .catch(err => {
              console.error(`Error fetching case ${selectedCaseId}:`, err);
              setError(`Failed to load case details: ${err.message}`);
              setCurrentCaseData(null); // Clear data on error
          })
          .finally(() => setIsLoading(false));

  }, [selectedCaseId]); // Dependency array includes selectedCaseId

  // Function to get a weighted random item based on CURRENTLY loaded case data
  const getRandomItem = (): CaseItem | null => {
      if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0) return null;

      const totalWeight = currentCaseData.items.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
           const firstItem = currentCaseData.items[0];
           return firstItem ?? null;
      }

      let randomNum = Math.random() * totalWeight;
      for (const item of currentCaseData.items) {
          if (randomNum < item.weight) {
              return item;
          }
          randomNum -= item.weight;
      }

      // Fallback for potential floating point issues
      const lastItem = currentCaseData.items[currentCaseData.items.length - 1];
      return lastItem ?? null;
  };

  const startSpin = () => {
    // Check if spinning or if case data isn't loaded
    if (isSpinning || !currentCaseData || currentCaseData.items.length === 0) return;

    const currentWinningItem = getRandomItem();
    if (!currentWinningItem) {
        setError("Could not determine a winning item.");
        return;
    }

    setIsSpinning(true);
    setWonItem(null); // Clear previous win

    // 1. Generate a long list of items for the visual reel
    const totalReelItems = 50; // Number of items shown in the reel animation
    const generatedReel: CaseItem[] = [];
    for (let i = 0; i < totalReelItems; i++) {
        const randomItem = getRandomItem();
        if (randomItem) {
            generatedReel.push(randomItem);
        } else {
            // Fallback: push the first item from currentCaseData if getRandomItem fails unexpectedly
            const fallbackItem = currentCaseData.items[0]; // Explicitly get the item
            if (fallbackItem) { // Check if it exists before pushing
                generatedReel.push(fallbackItem);
            } else {
                // This case should be impossible if currentCaseData is loaded and items exist
                setError("Cannot generate reel: No items available.");
                setIsSpinning(false);
                return; // Exit if no items can be added
            }
        }
    }

    // 2. Determine the winning item (already done above)
    // Insert the winning item near the end (e.g., 5th to last visible item)
    const winningIndex = totalReelItems - 5;
    // Ensure currentWinningItem is not null before assigning
    generatedReel[winningIndex] = currentWinningItem; // Already checked currentWinningItem is not null
    setReelItems(generatedReel);

    // 3. Calculate animation offset
    const containerWidth = reelRef.current?.offsetWidth ?? 0;
    const centerOffset = containerWidth / 2 - REEL_ITEM_WIDTH / 2;
    const targetScroll = winningIndex * REEL_ITEM_WIDTH - centerOffset;

    // 4. Apply animation
    if (reelRef.current) {
        reelRef.current.style.transition = 'none';
        reelRef.current.style.transform = 'translateX(0px)';
        void reelRef.current.offsetWidth; // Force reflow
        reelRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        reelRef.current.style.transform = `translateX(-${targetScroll}px)`;
    }

    // 5. Set timeout to stop spinning state and show result
    setTimeout(() => {
      setIsSpinning(false);
      setWonItem(currentWinningItem);
    }, SPIN_DURATION);
  };

  if (error) {
      return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  // No longer need the loading state as data is imported directly
  // if (!caseData) {
  //     return <div style={{ padding: '20px' }}>Loading case data...</div>;
  // }

  return (
    <div style={{ padding: '20px' }}>
      {/* Case Selection Dropdown */}
      <div style={{ marginBottom: '20px' }}>
          <label htmlFor="case-select" style={{ marginRight: '10px' }}>Select Case:</label>
          <select
              id="case-select"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={isLoading || (availableCases.length === 0 && !currentCaseData)} // Disable if loading or no cases and no fallback
              className="cs-input" // Use existing style if suitable
              style={{ minWidth: '200px' }}
          >
              {/* Add placeholder only if there are actual cases */}
              {availableCases.length > 0 && <option value="" disabled>-- Select a Case --</option>}
              {availableCases.map(caseInfo => (
                  <option key={caseInfo.id} value={caseInfo.id}>
                      {caseInfo.name} (ID: {caseInfo.id})
                  </option>
              ))}
          </select>
          {/* Adjust message based on whether fallback is loaded */}
          {availableCases.length === 0 && !isLoading && !currentCaseData && <span style={{ marginLeft: '10px', color: 'orange' }}>No cases found. Create one!</span>}
          {availableCases.length === 0 && !isLoading && currentCaseData?.id === 0 && <span style={{ marginLeft: '10px', color: 'lightblue' }}>Showing Default Case</span>}
      </div>

      {/* Display Loading / Error / Case Info */}
      {isLoading && <p>Loading case data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {currentCaseData && !isLoading && !error && (
          <>
              <h2>{currentCaseData.name}</h2>
              <p>{currentCaseData.description ?? 'No description.'}</p>
              <hr className="cs-hr" style={{ margin: '15px 0' }} />

              {/* The visual container for the reel */}
      <div className="case-opener-viewport">
        <div className="case-opener-reel" ref={reelRef}>
          {reelItems.map((item, index) => (
            <div
              key={`${item.name}-${index}-${Math.random()}`} // Improve key uniqueness for dynamic reel
              className="case-opener-item"
              style={{ color: item.color || 'white' }} // Use color from item data
            >
              {item.name}
            </div>
          ))}
        </div>
                 {/* Center marker */}
                <div className="case-opener-marker"></div>
              </div>

              <StyledButton onClick={startSpin} disabled={isSpinning || !currentCaseData || currentCaseData.items.length === 0} style={{ marginTop: '20px' }}>
                {isSpinning ? 'Opening...' : 'Open Case'}
              </StyledButton>
          </>
      )}


      {/* Display the won item (remains largely the same) */}
      {wonItem && !isSpinning && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <h3>You unboxed:</h3>
          <p style={{
            color: wonItem.color || 'white', // Use color from won item
            fontSize: '1.5em',
            fontWeight: 'bold',
            border: `2px solid ${wonItem.color || 'white'}`, // Use color from won item
            padding: '10px',
            display: 'inline-block',
            marginTop: '5px',
            backgroundColor: 'var(--secondary-bg)'
           }}>
            {wonItem.name}
          </p>
        </div>
      )}
    </div>
  );
}

export default CaseOpener;
