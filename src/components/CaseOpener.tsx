import React, { useState, useEffect, useRef } from 'react';
import StyledButton from './StyledButton';
import './CaseOpener.css'; // We'll create this CSS file next

// Define item rarities and potential items
// (Simplified for now - using language names)
const items = [
  { name: 'JavaScript', rarity: 'common' },
  { name: 'HTML', rarity: 'common' },
  { name: 'CSS', rarity: 'common' },
  { name: 'Plain Text', rarity: 'common' },
  { name: 'TypeScript', rarity: 'uncommon' },
  { name: 'Python', rarity: 'uncommon' },
  { name: 'JSON', rarity: 'uncommon' },
  { name: 'Markdown', rarity: 'rare' },
  { name: 'Shell/Bash', rarity: 'rare' },
];

// Assign colors based on rarity (approximate CS colors)
const rarityColors: { [key: string]: string } = {
  common: '#b0c3d9', // Consumer Grade (Light Blue)
  uncommon: '#5e98d9', // Industrial Grade (Blue)
  rare: '#4b69ff', // Mil-Spec (Darker Blue - using purple for distinction)
  // Add more rarities like purple, pink, red, gold if needed
};

const REEL_ITEM_WIDTH = 100; // Width of each item in pixels + margin
const SPIN_DURATION = 3000; // Duration of spin animation in ms

function CaseOpener() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<typeof items>([]);
  const [wonItem, setWonItem] = useState<typeof items[0] | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  // Function to get a weighted random item based on rarity
  const getRandomItem = (): typeof items[0] => {
    // Simple weighted random logic (adjust weights for real probabilities)
    const weightedList: typeof items[0][] = [];
    items.forEach(item => {
      let weight = 1;
      if (item.rarity === 'uncommon') weight = 3;
      if (item.rarity === 'rare') weight = 6; // Make rare less likely
      for (let i = 0; i < weight; i++) {
        weightedList.push(item);
      }
    });
    const randomIndex = Math.floor(Math.random() * weightedList.length);
    // Assert non-null as weightedList is guaranteed to be populated from static items
    return weightedList[randomIndex]!;
  };

  const startSpin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setWonItem(null); // Clear previous win

    // 1. Generate a long list of items for the visual reel
    const totalReelItems = 50; // Number of items shown in the reel animation
    const generatedReel: typeof items[0][] = [];
    for (let i = 0; i < totalReelItems - 1; i++) {
      generatedReel.push(getRandomItem()); // Fill most with random items
    }

    // 2. Determine the winning item
    const finalItem = getRandomItem();
    // Insert the winning item near the end (e.g., 3rd to last visible item)
    generatedReel.splice(totalReelItems - 5, 0, finalItem);
    setReelItems(generatedReel);

    // 3. Calculate animation offset
    // We want the reel to stop visually centered on the winning item
    // Center position = middle of the container
    const containerWidth = reelRef.current?.offsetWidth ?? 0;
    const centerOffset = containerWidth / 2 - REEL_ITEM_WIDTH / 2;
    // Target position = (index of winning item * item width) - center offset
    const targetIndex = totalReelItems - 5;
    const targetScroll = targetIndex * REEL_ITEM_WIDTH - centerOffset;

    // 4. Apply animation using CSS transitions (or JS animation library)
    if (reelRef.current) {
        reelRef.current.style.transition = 'none'; // Reset transition
        reelRef.current.style.transform = 'translateX(0px)'; // Reset position

        // Force reflow to apply reset before animation
        void reelRef.current.offsetWidth;

        reelRef.current.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1)`; // Ease-out curve
        reelRef.current.style.transform = `translateX(-${targetScroll}px)`;
    }

    // 5. Set timeout to stop spinning state and show result
    setTimeout(() => {
      setIsSpinning(false);
      setWonItem(finalItem);
    }, SPIN_DURATION);
  };

  // Preload reel with some items on initial render
  useEffect(() => {
    setReelItems(items.slice(0, 10)); // Initial placeholder items
  }, []);


  return (
    <div style={{ padding: '20px' }}>
      <h2>Case Opener</h2>
      <hr className="cs-hr" style={{ margin: '15px 0' }} />

      {/* The visual container for the reel */}
      <div className="case-opener-viewport">
        <div className="case-opener-reel" ref={reelRef}>
          {reelItems.map((item, index) => (
            <div
              key={`${item.name}-${index}`} // Need a unique key for list items
              className="case-opener-item"
              style={{ color: rarityColors[item.rarity] || 'white' }}
            >
              {item.name}
            </div>
          ))}
        </div>
         {/* Center marker */}
        <div className="case-opener-marker"></div>
      </div>

      <StyledButton onClick={startSpin} disabled={isSpinning} style={{ marginTop: '20px' }}>
        {isSpinning ? 'Opening...' : 'Open Case'}
      </StyledButton>

      {/* Display the won item */}
      {wonItem && !isSpinning && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <h3>You unboxed:</h3>
          <p style={{
            color: rarityColors[wonItem.rarity] || 'white',
            fontSize: '1.5em',
            fontWeight: 'bold',
            border: `2px solid ${rarityColors[wonItem.rarity] || 'white'}`,
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
