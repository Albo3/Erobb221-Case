import React, { useState, useEffect, useRef } from 'react';
// Remove fs and path imports as they are Node-specific
import matter from 'gray-matter'; // Import gray-matter
import StyledButton from './StyledButton';
import './CaseOpener.css';

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

// Helper function to parse the markdown item list more robustly
const parseMarkdownItems = (markdownContent: string): CaseItem[] => {
    const items: CaseItem[] = [];
    const lines = markdownContent.trim().split('\n');
    let currentItem: Partial<CaseItem> = {};

    const itemRegex = /-\s+Item:\s*"([^"]+)"/;
    const weightRegex = /Weight:\s*(\d+)/;
    const colorRegex = /Color:\s*"([^"]+)"/;

    for (const line of lines) {
        const trimmedLine = line.trim();

        const itemMatch = trimmedLine.match(itemRegex);
        if (itemMatch?.[1]) {
            // Finalize the previous item if it was complete
            if (currentItem.name && currentItem.weight !== undefined && currentItem.color) {
                items.push(currentItem as CaseItem);
            }
            // Start a new item
            currentItem = { name: itemMatch[1] };
            continue; // Move to next line after finding item name
        }

        // Only process weight/color if we have a current item name
        if (currentItem.name) {
            const weightMatch = trimmedLine.match(weightRegex);
            if (weightMatch?.[1]) {
                currentItem.weight = parseInt(weightMatch[1], 10);
                // Check if item is complete after adding weight
                if (currentItem.name && currentItem.weight !== undefined && currentItem.color) {
                    items.push(currentItem as CaseItem);
                    currentItem = {}; // Reset
                }
                continue; // Move to next line
            }

            const colorMatch = trimmedLine.match(colorRegex);
            if (colorMatch?.[1]) {
                currentItem.color = colorMatch[1];
                // Check if item is complete after adding color
                if (currentItem.name && currentItem.weight !== undefined && currentItem.color) {
                    items.push(currentItem as CaseItem);
                    currentItem = {}; // Reset
                }
                // continue; // Don't continue here, might be end of multi-line item definition
            }
        }
    }
    // Add the last item if it's complete and wasn't added yet
    if (currentItem.name && currentItem.weight !== undefined && currentItem.color) {
       // Check if it's already added to prevent duplicates if last line completed it
       if (!items.some(item => item.name === currentItem.name && item.weight === currentItem.weight && item.color === currentItem.color)) {
           items.push(currentItem as CaseItem);
       }
    }

    return items;
};


function CaseOpener() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  // Effect to load case data from markdown file on mount using fetch
  useEffect(() => {
    const loadCaseData = async () => {
      try {
        // Fetch the markdown file from the public directory
        const response = await fetch('/cases/example_case.md'); // Path relative to public folder
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fileContent = await response.text();
        const { data, content } = matter(fileContent); // Parse frontmatter and content

        if (!data.name || !data.description) {
            throw new Error("Markdown frontmatter must contain 'name' and 'description'.");
        }

        const items = parseMarkdownItems(content);
        if (items.length === 0) {
            throw new Error("Could not parse any items from the markdown content.");
        }

        setCaseData({
          name: data.name,
          description: data.description,
          items: items,
        });
        setReelItems(items.slice(0, 10)); // Initial placeholder items
        setError(null);
      } catch (err: any) {
        console.error("Error loading case data:", err);
        setError(`Failed to load case data: ${err.message}. Check file path and format.`);
        setCaseData(null);
      }
    };

    loadCaseData();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Function to get a weighted random item based on parsed weights
  const getRandomItem = (): CaseItem | null => {
      if (!caseData || caseData.items.length === 0) return null;

      const totalWeight = caseData.items.reduce((sum, item) => sum + item.weight, 0);
      // Fallback if weights are invalid or items array is empty (already checked above, but safe)
      if (totalWeight <= 0) {
           // Explicitly check if items[0] exists before returning it
           const firstItem = caseData.items[0];
           return firstItem ? firstItem : null; // Return null if items[0] is undefined
      }

      let randomNum = Math.random() * totalWeight;
      for (const item of caseData.items) {
          if (randomNum < item.weight) {
              return item;
          }
          randomNum -= item.weight;
      }

      // Fallback for potential floating point issues, ensure items[last] exists
      const lastItem = caseData.items[caseData.items.length - 1];
      return lastItem ? lastItem : null; // Return null if last item is undefined (shouldn't happen)
  };

  const startSpin = () => {
    if (isSpinning || !caseData) return;

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

  if (!caseData) {
      return <div style={{ padding: '20px' }}>Loading case data...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>{caseData.name}</h2>
      <p>{caseData.description}</p>
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

      <StyledButton onClick={startSpin} disabled={isSpinning || !caseData} style={{ marginTop: '20px' }}>
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
