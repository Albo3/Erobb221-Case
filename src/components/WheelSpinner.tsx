import React, { useState, useEffect, useRef } from 'react';
import StyledButton from './StyledButton';
import { getApiUrl } from '../config'; // Import the helper
import './WheelSpinner.css';
import '../styles/style.css';
import './CaseOpener.css'; // For grid styles

// Define CaseItem interface (matching CaseOpener)
interface CaseItem {
  name: string;
  display_color: string; // Use display_color
  percentage_chance: number; // Use percentage_chance
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
  item_template_id?: number; // Keep optional if needed elsewhere
}

// Interface for the list of cases
interface CaseInfo {
    id: number;
    name: string;
    image_path: string | null;
}

// Interface for detailed case data
interface CaseData {
  id: number;
  name: string;
  description: string | null;
  items: CaseItem[];
}


// Helper function to generate conic gradient string based on percentage_chance
const generateConicGradient = (items: CaseItem[] | null): string => {
    if (!items || items.length === 0) {
        return 'conic-gradient(var(--secondary-bg) 0deg 360deg)'; // Fallback
    }

    // Use percentage_chance for segment size calculation
    const totalPercentage = items.reduce((sum, item) => sum + (item.percentage_chance || 0), 0);

    // If total percentage is 0 or invalid, create an equal distribution fallback
    if (totalPercentage <= 0) {
        console.warn("Total percentage is zero or less, generating fallback gradient.");
        const anglePerItem = 360 / items.length;
        let fallbackGradient = 'conic-gradient(';
        const borderThickness = 0.2;
        const borderColor = 'var(--border-dark)';
        const color1 = 'var(--bg)';
        const color2 = 'var(--secondary-bg)';
        let currentAngle = 0;
        items.forEach((_, index) => {
            const segmentColor = index % 2 === 0 ? color1 : color2;
            if (currentAngle > 0) {
                fallbackGradient += `${borderColor} ${currentAngle}deg ${currentAngle + borderThickness}deg, `;
                currentAngle += borderThickness;
            }
            const segmentEndAngle = currentAngle + Math.max(anglePerItem - borderThickness, 0.1);
            fallbackGradient += `${segmentColor} ${currentAngle}deg ${segmentEndAngle}deg`;
            currentAngle = segmentEndAngle;
            if (index < items.length - 1) fallbackGradient += ', ';
        });
         if (currentAngle < 359.9) fallbackGradient += `, ${borderColor} ${currentAngle}deg 360deg`;
        fallbackGradient += ')';
        return fallbackGradient;
    }

    // Generate gradient based on actual percentages
    let gradientString = 'conic-gradient(';
    let currentAngle = 0;
    const borderThickness = 0.2; // Degrees for the border line
    const borderColor = 'var(--border-dark)';
    const color1 = 'var(--bg)';
    const color2 = 'var(--secondary-bg)';

    items.forEach((item, index) => {
        const percentage = item.percentage_chance || 0;
        // Calculate angle span based on percentage relative to the *actual* total sum
        // This handles cases where the sum isn't exactly 100
        const angleSpan = (percentage / totalPercentage) * 360;
        const segmentColor = index % 2 === 0 ? color1 : color2; // Alternate colors

        // Start border (unless it's the very first segment at 0deg)
        if (currentAngle > 0.1) { // Use small tolerance for floating point
            gradientString += `${borderColor} ${currentAngle}deg ${currentAngle + borderThickness}deg, `;
            currentAngle += borderThickness;
        }

        // Segment color
        const segmentEndAngle = currentAngle + Math.max(angleSpan - borderThickness, 0.1); // Ensure positive span, account for border
        gradientString += `${segmentColor} ${currentAngle}deg ${segmentEndAngle}deg`;

        currentAngle = segmentEndAngle; // Update angle for the next border/segment

        if (index < items.length - 1) {
             gradientString += ', ';
        }
    });

     // Fill any remaining tiny gap (less than border thickness) with border color
     if (currentAngle < 359.9) {
         gradientString += `, ${borderColor} ${currentAngle}deg 360deg`;
     }

    gradientString += ')';
    return gradientString;
};

// Define the props interface
interface WheelSpinnerProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  onNewUnbox: (item: CaseItem) => void;
}

// Constants
const SPIN_DURATION_WHEEL = 6000; // Match CaseOpener duration (6 seconds)
const WHEEL_SIZE = 600; // Make wheel even larger

const WheelSpinner: React.FC<WheelSpinnerProps> = ({ volume, onVolumeChange, onNewUnbox }) => {
  // State
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [currentCaseData, setCurrentCaseData] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemAudioRef = useRef<HTMLAudioElement | null>(null); // Ref for item sound
  const caseAudioRef = useRef<HTMLAudioElement | null>(null); // Ref for case opening sound
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  const [targetRotation, setTargetRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  // Fetch available cases
  useEffect(() => {
      setIsLoading(true);
      fetch(getApiUrl('/api/cases')) // Use helper
          .then(response => {
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
          })
          .then((data: CaseInfo[]) => {
              setAvailableCases(data);
              if (data.length > 0 && data[0]) {
                  setSelectedCaseId(data[0].id.toString());
              } else {
                  setError("No cases found. Please create one in Admin Mode.");
                  setCurrentCaseData(null);
                  setSelectedCaseId('');
              }
          })
          .catch(err => {
              console.error("Error fetching available cases:", err);
              setError(`Failed to load available cases: ${err.message}`);
              setAvailableCases([]);
          })
          .finally(() => setIsLoading(false));
  }, []);

  // Fetch case details and add weights
  useEffect(() => {
      if (!selectedCaseId) {
          setCurrentCaseData(null);
          return;
      }
      setIsLoading(true);
      setError(null);
      fetch(getApiUrl(`/api/cases/${selectedCaseId}`)) // Use helper
          .then(response => {
              if (!response.ok) {
                  return response.json().then(errData => { throw new Error(errData.error || `HTTP error! status: ${response.status}`); })
                         .catch(() => { throw new Error(`HTTP error! status: ${response.status}`); });
              }
              return response.json();
          })
          .then((data: CaseData) => {
              if (!data || !Array.isArray(data.items)) {
                   throw new Error("Invalid case data received.");
              }
              // No need to add weight, data already has percentage_chance
              // Shuffle the items array (Fisher-Yates algorithm) - Keep shuffling for visual variety
              const shuffledItems = [...data.items]; // Create a copy to shuffle
              for (let i = shuffledItems.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
              }

              setCurrentCaseData({ ...data, items: shuffledItems }); // Set shuffled items
              setWonItem(null);
              if (wheelRef.current) {
                  wheelRef.current.style.transition = 'none';
                  wheelRef.current.style.transform = 'rotate(0deg)';
              }
              setTargetRotation(0);
          })
          .catch(err => {
              console.error(`Error fetching case ${selectedCaseId}:`, err);
              setError(`Failed to load case details: ${err.message}`);
              setCurrentCaseData(null);
          })
          .finally(() => setIsLoading(false));
  }, [selectedCaseId]);

  // Update audio volume
  useEffect(() => {
    if (itemAudioRef.current) itemAudioRef.current.volume = volume;
    if (caseAudioRef.current) caseAudioRef.current.volume = volume;
  }, [volume]);

  // Get random item based on percentage_chance
  const getRandomItem = (): CaseItem | null => {
      if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0) {
          console.warn("getRandomItem called with no case data or items.");
          return null;
      }

      const items = currentCaseData.items;
      // Use the actual sum of percentages provided, even if not 100
      const totalPercentageSum = items.reduce((sum, item) => sum + (item.percentage_chance || 0), 0);

      if (totalPercentageSum <= 0) {
          console.warn("Total percentage sum is zero or less, returning first item as fallback.");
          return items[0] ?? null; // Fallback to first item if percentages are invalid
      }

      let randomNum = Math.random() * totalPercentageSum; // Random number between 0 and total sum

      for (const item of items) {
          const chance = item.percentage_chance || 0;
          if (randomNum <= chance) {
              return item; // This item is selected
          }
          randomNum -= chance;
      }

      // Fallback in case of floating point issues or unexpected scenarios
      console.warn("Random selection fallback triggered, returning last item.");
      // Explicitly check length and return null if empty (should be unreachable)
      if (items.length > 0) {
          const lastItem: CaseItem | undefined = items[items.length - 1];
          // Ensure lastItem is not undefined before returning, although logic dictates it shouldn't be
          return lastItem ?? null;
      }
      // This path should be logically impossible if the function reached here
      console.error("getRandomItem reached fallback with empty items array, this should not happen.");
      return null;
  };

  // Handle Spin Action
  const handleSpin = () => {
    if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0 || isSpinning) return;

    // Stop previous sounds
    if (itemAudioRef.current) { itemAudioRef.current.pause(); itemAudioRef.current = null; }
    if (caseAudioRef.current) { caseAudioRef.current.pause(); caseAudioRef.current = null; }

    console.log("Spinning the wheel...");
    setIsSpinning(true);
    setWonItem(null);

    // Play case opening sound
    try {
        const caseSoundUrl = getApiUrl('/uploads/sounds/case.mp3'); // Use helper
        const newCaseAudio = new Audio(caseSoundUrl);
        newCaseAudio.volume = volume;
        caseAudioRef.current = newCaseAudio;
        newCaseAudio.play().catch(e => { console.error("Error playing case sound:", e); caseAudioRef.current = null; });
        newCaseAudio.onended = () => { caseAudioRef.current = null; };
    } catch (e) { console.error("Error creating case audio:", e); caseAudioRef.current = null; }

    // Reset rotation visually before animation
    if (wheelRef.current) {
        wheelRef.current.style.transition = 'none';
        wheelRef.current.style.transform = `rotate(${targetRotation}deg)`;
        void wheelRef.current.offsetWidth;
    }

    const winningItem = getRandomItem();
    if (!winningItem || !currentCaseData?.items) {
        setError("Could not determine winning item."); setIsSpinning(false); return;
    }

    // Calculate Rotation based on Percentage Segments
    const totalPercentage = currentCaseData.items.reduce((sum, item) => sum + (item.percentage_chance || 0), 0);
    if (totalPercentage <= 0) {
        setError("Cannot calculate rotation: total percentage is zero or less.");
        setIsSpinning(false);
        return;
    }

    let cumulativeAngle = 0;
    let winningSegmentStartAngle = 0;
    let winningSegmentAngleSpan = 0;
    let foundWinningSegment = false;

    // Find the angle range for the winning item
    for (let i = 0; i < currentCaseData.items.length; i++) {
        const item = currentCaseData.items[i];
        if (!item) continue; // Skip if item is somehow undefined
        const percentage = item.percentage_chance || 0;
        const angleSpan = (percentage / totalPercentage) * 360;

        // Check if this is the winning item (match name and color for uniqueness if needed, or just name if sufficient)
        // Using name and display_color for better matching potential
        if (item.name === winningItem.name && item.display_color === winningItem.display_color) {
            // Check if this specific instance is the winner (if multiple items have same name/color)
            // This requires comparing the actual object reference if possible, or relying on the first match
            // For simplicity, we'll assume the first match found in the loop is the target
            // (This works because getRandomItem returns a specific item instance from the array)
            // A more robust way might involve unique IDs if items weren't shuffled, but shuffling makes this tricky.
            // Let's rely on the first match by name and color.
            if (!foundWinningSegment) { // Take the first match
                 winningSegmentStartAngle = cumulativeAngle;
                 winningSegmentAngleSpan = angleSpan;
                 foundWinningSegment = true;
                 // Don't break here if multiple identical items exist, let loop finish to calculate full cumulativeAngle correctly
                 // break; // Removed break
            }
        }
        cumulativeAngle += angleSpan;
    }

     // If segment wasn't found by name+color (shouldn't happen if getRandomItem worked), fallback to name only
     if (!foundWinningSegment) {
         console.warn("Could not find exact winning segment by name+color, using first match by name.");
         cumulativeAngle = 0; // Reset cumulative angle for fallback search
         for (let i = 0; i < currentCaseData.items.length; i++) {
             const item = currentCaseData.items[i];
             if (!item) continue;
             const percentage = item.percentage_chance || 0;
             const angleSpan = (percentage / totalPercentage) * 360;
             if (item.name === winningItem.name) {
                 winningSegmentStartAngle = cumulativeAngle;
                 winningSegmentAngleSpan = angleSpan;
                 foundWinningSegment = true;
                 // break; // Removed break
             }
             cumulativeAngle += angleSpan;
         }
     }

     // Final check if we still couldn't find it
     if (!foundWinningSegment) {
         setError("Could not calculate winning angle even with fallback."); setIsSpinning(false); return;
     }

    const targetAngle = -(winningSegmentStartAngle + winningSegmentAngleSpan / 2);
    const fullSpins = 5;
    const currentRotation = targetRotation;
    const randomOffset = (Math.random() - 0.5) * (winningSegmentAngleSpan * 0.8);
    const finalTargetAngle = targetAngle + randomOffset;
    const rotationDifference = (360 * fullSpins + finalTargetAngle) - (currentRotation % 360);
    const finalRotation = currentRotation + rotationDifference;

    setTargetRotation(finalRotation);

    // Apply transition and rotation
    if (wheelRef.current) {
        wheelRef.current.style.transition = `transform ${SPIN_DURATION_WHEEL}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        wheelRef.current.style.transform = `rotate(${finalRotation}deg)`;
    }

    // Set timeout for results
    setTimeout(() => {
        setWonItem(winningItem);
        onNewUnbox(winningItem);
        setIsSpinning(false);
        console.log("Wheel stopped. Won:", winningItem);

        if (caseAudioRef.current) { caseAudioRef.current.pause(); caseAudioRef.current = null; }

        if (winningItem.sound_url) {
            try {
                // sound_url from API already includes the path, just need base
                const fullSoundUrl = getApiUrl(winningItem.sound_url); // Use helper
                const newItemAudio = new Audio(fullSoundUrl);
                newItemAudio.volume = volume;
                itemAudioRef.current = newItemAudio;
                newItemAudio.play().catch(e => { console.error("Error playing item sound:", e); itemAudioRef.current = null; });
                newItemAudio.onended = () => { itemAudioRef.current = null; };
            } catch (e) { console.error("Error creating item audio:", e); itemAudioRef.current = null; }
        }
    }, SPIN_DURATION_WHEEL);
  };

  // Helper to calculate position and rotation for item text based on percentage
  const getItemStyle = (index: number, items: CaseItem[]): React.CSSProperties => {
    if (!items || index < 0 || index >= items.length || !items[index]) {
        return {};
    }
    // Use percentage_chance for angle calculation
    const totalPercentage = items.reduce((sum, item) => sum + (item?.percentage_chance || 0), 0);
    if (totalPercentage <= 0) return {}; // Avoid division by zero

    let cumulativeAngle = 0;
    for (let i = 0; i < index; i++) {
        const item = items[i];
        if (item) {
            cumulativeAngle += ((item.percentage_chance || 0) / totalPercentage) * 360;
        }
    }

    const currentItem = items[index];
    const currentItemPercentage = currentItem.percentage_chance || 0;
    const angleSpan = (currentItemPercentage / totalPercentage) * 360;
    const itemAngle = cumulativeAngle + angleSpan / 2; // Angle to the center of the segment

    const radius = WHEEL_SIZE * 0.38; // Adjust distance from center
    const angleRad = itemAngle * Math.PI / 180;
    const x = 50 + (radius / (WHEEL_SIZE / 100)) * Math.sin(angleRad);
    const y = 50 - (radius / (WHEEL_SIZE / 100)) * Math.cos(angleRad);

    // Rotate text container to align tangentially
    const textRotation = itemAngle + 90;

    return {
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${textRotation}deg)`, // Center element and rotate container
        width: 'auto',
        textAlign: 'center',
        // Apply background via CSS class '.segment-name'
        whiteSpace: 'nowrap',
        pointerEvents: 'none', // Prevent text from interfering with clicks
    };
  };


  return (
    <div className="wheel-spinner-container">
      {/* Loading / Error Display */}
      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red', marginBottom: '20px' }}>Error: {error}</p>}

      {/* Won Item Display Area */}
      <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          {wonItem && !isSpinning && (
              <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '1.1em', marginBottom: '3px' }}>You spun:</h3>
                  <p style={{ color: wonItem.display_color || 'white', fontSize: '1.3em', fontWeight: 'bold', border: `2px solid ${wonItem.display_color || 'white'}`, padding: '6px 10px', display: 'inline-block', marginTop: '3px', backgroundColor: 'var(--secondary-bg)' }}>
                      {wonItem.name}
                  </p>
                  {wonItem.image_url && (
                      // image_url from API already includes the path, just need base
                      <img src={getApiUrl(wonItem.image_url)} alt={wonItem.name} style={{ display: 'block', width: '150px', height: '150px', objectFit: 'contain', margin: '8px auto', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                  )}
                  {wonItem.rules && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', whiteSpace: 'pre-wrap', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                          <strong>Rules:</strong><p>{wonItem.rules}</p>
                      </div>
                  )}
              </div>
          )}
          {!wonItem && !isSpinning && <p style={{ color: 'var(--secondary-text)' }}>Select a case and click "Spin Wheel"</p>}
      </div>

      {/* Wheel Display Area & Spin Button */}
      {currentCaseData && !isLoading && !error && (
          <div style={{ marginBottom: '20px' }}>
              <h2>{currentCaseData.name}</h2>
              {currentCaseData.description && <p>{currentCaseData.description}</p>}
              <hr className="cs-hr" style={{ margin: '10px 0' }} />

              {/* Wheel Visual Container */}
              <div className="wheel-visual-container" style={{ width: `${WHEEL_SIZE}px`, height: `${WHEEL_SIZE}px` }}>
                  <div className="wheel-marker"></div>
                  <div
                      ref={wheelRef}
                      className="wheel-graphic"
                      style={{
                          background: generateConicGradient(currentCaseData.items), // Use weighted gradient
                      }}
                  >
                      {/* Item Text Layer */}
                      <div className="wheel-item-texts">
                          {currentCaseData.items.map((item, index) => (
                              item ? (
                                  // Apply style directly to the container div
                                  <div key={`item-${item.item_template_id || index}-${Math.random()}`} className="wheel-item-text" style={getItemStyle(index, currentCaseData.items)}>
                                      {/* Text itself doesn't need extra span or style now */}
                                      {/* Use display_color for the text color */}
                                      <span className="segment-name" style={{ color: item.display_color }}>
                                          {item.name}
                                      </span>
                                  </div>
                              ) : null
                          ))}
                      </div>
                  </div>
              </div>

              {/* Spin Button */}
              <div style={{ textAlign: 'center', marginTop: '25px' }}>
                  <StyledButton
                      onClick={handleSpin}
                      disabled={isSpinning || !currentCaseData || currentCaseData.items.length === 0}
                      style={{ padding: '15px 30px', fontSize: '1.5em', minWidth: '200px' }}
                  >
                      {isSpinning ? 'Spinning...' : 'Spin Wheel'}
                  </StyledButton>
              </div>
          </div>
      )}

      {/* Case Selection Grid */}
      <h3 style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginBottom: '8px' }}>Select a Case:</h3>
      <div className="case-selection-grid">
          {availableCases.length > 0 ? (
              availableCases.map(caseInfo => (
                  <div
                      key={caseInfo.id}
                      className={`case-grid-item ${selectedCaseId === caseInfo.id.toString() ? 'selected' : ''}`}
                      onClick={() => setSelectedCaseId(caseInfo.id.toString())}
                  >
                      {caseInfo.image_path && (
                          // image_path from API already includes the path, just need base
                          <img src={getApiUrl(caseInfo.image_path)} alt={caseInfo.name} className="case-grid-item-image" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      )}
                      <span className="case-grid-item-name-overlay">{caseInfo.name}</span>
                  </div>
              ))
          ) : (
              !isLoading && <p style={{ color: 'orange', gridColumn: '1/-1' }}>No cases found. Create one in Admin Mode!</p>
          )}
          {isLoading && <p style={{ gridColumn: '1/-1' }}>Loading cases...</p>}
      </div>
    </div>
  );
};

export default WheelSpinner;
