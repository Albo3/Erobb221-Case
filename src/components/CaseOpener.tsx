import React, { useState, useEffect, useRef } from 'react';
// Removed matter import
import StyledButton from './StyledButton';
import './CaseOpener.css';
// Removed direct JSON import

// Define interfaces for case data structure (CaseItem remains the same)
interface CaseItem {
  name: string;
  // weight: number; // Weight is no longer directly used from DB
  color: string;
  image_url?: string | null; // Add image_url
  rules?: string | null; // Add rules
}

interface CaseData {
  name: string;
  description: string | null; // Allow null description
  sound_url?: string | null; // Add sound_url
  items: CaseItem[];
  id?: number;
}

// Interface for the list of cases fetched from /api/cases
interface CaseInfo {
    id: number;
    name: string;
}


const REEL_ITEM_WIDTH = 100; // Width of each item in pixels + margin
const SPIN_DURATION = 3000; // Duration of spin animation in ms

// Define standard CS:GO rarity colors and names (copied from CreateCaseForm)
const RARITY_COLORS = [
    { name: 'Consumer Grade', value: '#b0c3d9' },    // White/Grayish
    { name: 'Industrial Grade', value: '#5e98d9' },  // Light Blue
    { name: 'Mil-Spec', value: '#4b69ff' },          // Blue
    { name: 'Restricted', value: '#8847ff' },        // Purple
    { name: 'Classified', value: '#d32ce6' },        // Pink
    { name: 'Covert', value: '#eb4b4b' },            // Red
    { name: 'Exceedingly Rare', value: '#ffd700' },  // Gold (Knives/Gloves)
];

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
                      id: 0,
                      name: "Default Starter Case",
                      description: "A basic case loaded because the database is empty.",
                      sound_url: null, // No sound for default
                      items: [
                          // Default items don't have weight, image, or rules here
                          { name: "Default Gray", color: "#b0c3d9" },
                          { name: "Default Blue", color: "#5e98d9" },
                          { name: "Default Purple", color: "#4b69ff" },
                          { name: "Default Gold", color: "#ffd700" },
                      ]
                  });
                  // Initialize reel for fallback case
                  setReelItems([
                      { name: "Default Gray", color: "#b0c3d9" },
                      { name: "Default Blue", color: "#5e98d9" },
                      { name: "Default Purple", color: "#4b69ff" },
                      { name: "Default Gold", color: "#ffd700" },
                  ].slice(0, 10)); // Slice still works, just uses color
                  setSelectedCaseId('');
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

  // Function to get a random item based on rarity distribution (color)
  const getRandomItem = (): CaseItem | null => {
      if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0) return null;

      // --- Determine Odds Based on Rarity Distribution (using color value) ---
      // This is a simplified example. Real CS:GO odds are complex and not public.
      // We'll assign higher chances to lower rarities based on their color value matching RARITY_COLORS.
      const rarityWeights: { [colorValue: string]: number } = {
          [RARITY_COLORS[0]?.value ?? '#b0c3d9']: 100, // Consumer Grade
          [RARITY_COLORS[1]?.value ?? '#5e98d9']: 50,  // Industrial Grade
          [RARITY_COLORS[2]?.value ?? '#4b69ff']: 25,  // Mil-Spec
          [RARITY_COLORS[3]?.value ?? '#8847ff']: 10,  // Restricted
          [RARITY_COLORS[4]?.value ?? '#d32ce6']: 5,   // Classified
          [RARITY_COLORS[5]?.value ?? '#eb4b4b']: 2,   // Covert
          [RARITY_COLORS[6]?.value ?? '#ffd700']: 1,   // Exceedingly Rare
      };

      const weightedList: CaseItem[] = [];
      currentCaseData.items.forEach(item => {
          const weight = rarityWeights[item.color] || 1; // Default weight if color not found
          for (let i = 0; i < weight; i++) {
              weightedList.push(item);
          }
      });

      if (weightedList.length === 0) return currentCaseData.items[0] ?? null; // Fallback

      const randomIndex = Math.floor(Math.random() * weightedList.length);
      return weightedList[randomIndex] ?? null; // Return selected item or null
      // --- End Odds Logic ---


      // --- Original Weight-Based Logic (Removed) ---
      // const totalWeight = currentCaseData.items.reduce((sum, item) => sum + item.weight, 0);
      // if (totalWeight <= 0) {
      //      const firstItem = currentCaseData.items[0];
      //      return firstItem ?? null;
      // }
      // let randomNum = Math.random() * totalWeight;
      // for (const item of currentCaseData.items) {
      //     if (randomNum < item.weight) {
      //         return item;
      //     }
      //     randomNum -= item.weight;
      // }

      // Fallback should ideally not be reached
  };

  const startSpin = () => {
    // Check if spinning or if case data isn't loaded
    if (isSpinning || !currentCaseData || currentCaseData.items.length === 0) return;

     // --- Play Sound ---
     if (currentCaseData.sound_url) {
        try {
            const audio = new Audio(currentCaseData.sound_url);
            audio.play().catch(e => console.error("Error playing sound:", e)); // Catch potential play errors
        } catch (e) {
            console.error("Error creating audio object:", e);
        }
     }
     // --- End Play Sound ---

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
            color: wonItem.color || 'white',
            fontSize: '1.5em',
            fontWeight: 'bold',
            border: `2px solid ${wonItem.color || 'white'}`,
            padding: '10px',
            display: 'inline-block',
            marginTop: '5px',
            backgroundColor: 'var(--secondary-bg)'
           }}>
            {wonItem.name}
          </p>
          {/* Display Image if URL exists */}
          {wonItem.image_url && (
            <img
                src={wonItem.image_url}
                alt={wonItem.name}
                style={{ display: 'block', maxWidth: '200px', maxHeight: '200px', margin: '10px auto', border: '1px solid var(--border-color)' }}
                onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
            />
          )}
          {/* Display Rules if text exists */}
          {wonItem.rules && (
            <div style={{ marginTop: '10px', fontSize: '0.9em', whiteSpace: 'pre-wrap', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                <strong>Rules:</strong>
                <p>{wonItem.rules}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CaseOpener;
