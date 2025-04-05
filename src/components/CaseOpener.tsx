import React, { useState, useEffect, useRef } from 'react';
// Removed matter import
import StyledButton from './StyledButton';
import './CaseOpener.css';
// Import the JSON file directly - TypeScript/Bun handle parsing
import caseDataJson from '../cases/example_case.json';

// Define interfaces for case data structure
interface CaseItem {
  name: string;
  weight: number;
  color: string;
}

interface CaseData {
  name: string;
  description: string;
  items: CaseItem[];
}

const REEL_ITEM_WIDTH = 100; // Width of each item in pixels + margin
const SPIN_DURATION = 3000; // Duration of spin animation in ms

// Removed parseMarkdownItems helper function

function CaseOpener() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  // State now directly holds the imported JSON data structure
  const [caseData, setCaseData] = useState<CaseData>(caseDataJson); // Initialize directly
  const [error, setError] = useState<string | null>(null); // Keep error state for potential future use
  const reelRef = useRef<HTMLDivElement>(null);

  // Effect to initialize reel items from the loaded case data
  useEffect(() => {
      // Validate the imported data (optional but good practice)
      if (!caseData || !caseData.name || !caseData.description || !Array.isArray(caseData.items) || caseData.items.length === 0) {
          setError("Imported case data is invalid or missing required fields.");
          console.error("Invalid case data:", caseData);
          setCaseData({ name: "Error", description: "Invalid case data", items: [] }); // Set a default error state
          return;
      }
      // Set initial reel items
      setReelItems(caseData.items.slice(0, 10));
      setError(null); // Clear any previous error
  }, [caseData]); // Rerun if caseData changes (though it won't with direct import)

  // Function to get a weighted random item based on JSON data
  const getRandomItem = (): CaseItem | null => {
      // caseData is now initialized directly, but check items array just in case
      if (!caseData || !caseData.items || caseData.items.length === 0) return null;

      const totalWeight = caseData.items.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight <= 0) {
           const firstItem = caseData.items[0];
           return firstItem ?? null; // Use nullish coalescing for cleaner check
      }

      let randomNum = Math.random() * totalWeight;
      for (const item of caseData.items) {
          if (randomNum < item.weight) {
              return item;
          }
          randomNum -= item.weight;
      }

      // Fallback for potential floating point issues
      const lastItem = caseData.items[caseData.items.length - 1];
      return lastItem ?? null; // Use nullish coalescing
  };

  const startSpin = () => {
    // caseData is initialized, just check if spinning
    if (isSpinning) return;

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
            // Fallback: push the first item from caseData if getRandomItem fails unexpectedly
            const fallbackItem = caseData.items[0]; // Explicitly get the item
            if (fallbackItem) { // Check if it exists before pushing
                generatedReel.push(fallbackItem);
            } else {
                // This case should be impossible if caseData is loaded and items exist, but good practice
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
      {/* Use caseData directly, checking for its existence */}
      <h2>{caseData?.name ?? 'Loading...'}</h2>
      <p>{caseData?.description ?? ''}</p>
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

      <StyledButton onClick={startSpin} disabled={isSpinning || !caseData || caseData.items.length === 0} style={{ marginTop: '20px' }}>
        {isSpinning ? 'Opening...' : 'Open Case'}
      </StyledButton>

      {/* Display the won item */}
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
