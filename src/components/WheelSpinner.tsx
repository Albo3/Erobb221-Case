import React, { useState, useEffect, useRef } from 'react';
import StyledButton from './StyledButton';
import './WheelSpinner.css';
import '../styles/style.css';
import './CaseOpener.css'; // For grid styles

// Define CaseItem interface
interface CaseItem {
  name: string;
  color: string; // Still needed for text color and weighting
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
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

// Define standard CS:GO rarity colors (used for weighting)
const RARITY_COLORS = [
    { name: 'Consumer Grade', value: '#b0c3d9' },
    { name: 'Industrial Grade', value: '#5e98d9' },
    { name: 'Mil-Spec', value: '#4b69ff' },
    { name: 'Restricted', value: '#8847ff' },
    { name: 'Classified', value: '#d32ce6' },
    { name: 'Covert', value: '#eb4b4b' },
    { name: 'Exceedingly Rare', value: '#ffd700' },
];

// Helper function to generate conic gradient string with alternating theme colors
const generateConicGradient = (numItems: number): string => {
    if (numItems <= 0) {
        return 'conic-gradient(var(--secondary-bg) 0deg 360deg)'; // Fallback
    }
    const anglePerSegment = 360 / numItems;
    let gradientString = 'conic-gradient(';
    const color1 = 'var(--bg)';
    const color2 = 'var(--secondary-bg)';

    for (let i = 0; i < numItems; i++) {
        const startAngle = i * anglePerSegment;
        const endAngle = (i + 1) * anglePerSegment;
        const color = i % 2 === 0 ? color1 : color2; // Alternate colors
        gradientString += `${color} ${startAngle}deg ${endAngle}deg`;
        if (i < numItems - 1) {
            gradientString += ', ';
        }
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
const WHEEL_SIZE = 450; // Increased wheel size in pixels

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
      fetch('http://localhost:3001/api/cases')
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

  // Fetch case details
  useEffect(() => {
      if (!selectedCaseId) {
          setCurrentCaseData(null);
          return;
      }
      setIsLoading(true);
      setError(null);
      fetch(`http://localhost:3001/api/cases/${selectedCaseId}`)
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
              setCurrentCaseData(data);
              setWonItem(null);
              // Reset wheel rotation visually when case changes
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

  // Get random item based on weight
  const getRandomItem = (): CaseItem | null => {
      if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0) return null;
      const rarityWeights: { [colorValue: string]: number } = {
          [RARITY_COLORS[0]?.value ?? '#b0c3d9']: 100, [RARITY_COLORS[1]?.value ?? '#5e98d9']: 50,
          [RARITY_COLORS[2]?.value ?? '#4b69ff']: 25,  [RARITY_COLORS[3]?.value ?? '#8847ff']: 10,
          [RARITY_COLORS[4]?.value ?? '#d32ce6']: 5,   [RARITY_COLORS[5]?.value ?? '#eb4b4b']: 2,
          [RARITY_COLORS[6]?.value ?? '#ffd700']: 1,
      };
      const weightedList: CaseItem[] = [];
      currentCaseData.items.forEach(item => {
          const weight = rarityWeights[item.color] || 1;
          for (let i = 0; i < weight; i++) weightedList.push(item);
      });
      if (weightedList.length === 0) return currentCaseData.items[0] ?? null;
      const randomIndex = Math.floor(Math.random() * weightedList.length);
      return weightedList[randomIndex] ?? null;
  };

  // Handle Spin Action
  const handleSpin = () => {
    if (!currentCaseData || currentCaseData.items.length === 0 || isSpinning) return;

    // Stop previous sounds
    if (itemAudioRef.current) { itemAudioRef.current.pause(); itemAudioRef.current = null; }
    if (caseAudioRef.current) { caseAudioRef.current.pause(); caseAudioRef.current = null; }

    console.log("Spinning the wheel...");
    setIsSpinning(true);
    setWonItem(null);

    // Play case opening sound
    try {
        const caseSoundUrl = 'http://localhost:3001/uploads/sounds/case.mp3';
        const newCaseAudio = new Audio(caseSoundUrl);
        newCaseAudio.volume = volume;
        caseAudioRef.current = newCaseAudio;
        newCaseAudio.play().catch(e => { console.error("Error playing case sound:", e); caseAudioRef.current = null; });
        newCaseAudio.onended = () => { caseAudioRef.current = null; }; // Clear ref on end
    } catch (e) { console.error("Error creating case audio:", e); caseAudioRef.current = null; }

    // Reset rotation visually before animation
    if (wheelRef.current) {
        wheelRef.current.style.transition = 'none';
        wheelRef.current.style.transform = `rotate(${targetRotation}deg)`; // Start from current visual rotation
        void wheelRef.current.offsetWidth; // Force reflow
    }

    const winningItem = getRandomItem();
    if (!winningItem || !currentCaseData?.items) {
        setError("Could not determine winning item."); setIsSpinning(false); return;
    }

    // Calculate rotation
    const numItems = currentCaseData.items.length;
    const anglePerSegment = 360 / numItems;
    const winningItemIndex = currentCaseData.items.findIndex(item => item.name === winningItem.name && item.color === winningItem.color);

    let finalRotation = targetRotation; // Initialize with current rotation

    if (winningItemIndex === -1) {
        console.warn("Could not precisely find winning item index, using first match.");
        const fallbackIndex = currentCaseData.items.findIndex(item => item.name === winningItem.name);
        if (fallbackIndex === -1) {
             setError("Could not find winning item index."); setIsSpinning(false); return;
        }
         const targetAngle = -(fallbackIndex * anglePerSegment + anglePerSegment / 2);
         const fullSpins = 5;
         const currentRotation = targetRotation;
         const rotationDifference = (360 * fullSpins + targetAngle) - (currentRotation % 360);
         finalRotation = currentRotation + rotationDifference;
    } else {
        const targetAngle = -(winningItemIndex * anglePerSegment + anglePerSegment / 2);
        const fullSpins = 5;
        const currentRotation = targetRotation;
        const rotationDifference = (360 * fullSpins + targetAngle) - (currentRotation % 360);
        finalRotation = currentRotation + rotationDifference;
    }

    setTargetRotation(finalRotation); // Store the final absolute rotation

    // Apply transition and rotation
    if (wheelRef.current) {
        wheelRef.current.style.transition = `transform ${SPIN_DURATION_WHEEL}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        wheelRef.current.style.transform = `rotate(${finalRotation}deg)`; // Apply the calculated final rotation
    }

    // Set timeout for results
    setTimeout(() => {
        setWonItem(winningItem);
        onNewUnbox(winningItem);
        setIsSpinning(false);
        console.log("Wheel stopped. Won:", winningItem);

        // Stop case sound if still playing
        if (caseAudioRef.current) { caseAudioRef.current.pause(); caseAudioRef.current = null; }

        // Play item sound
        if (winningItem.sound_url) {
            try {
                const backendOrigin = 'http://localhost:3001';
                const fullSoundUrl = backendOrigin + winningItem.sound_url;
                const newItemAudio = new Audio(fullSoundUrl);
                newItemAudio.volume = volume;
                itemAudioRef.current = newItemAudio;
                newItemAudio.play().catch(e => { console.error("Error playing item sound:", e); itemAudioRef.current = null; });
                newItemAudio.onended = () => { itemAudioRef.current = null; };
            } catch (e) { console.error("Error creating item audio:", e); itemAudioRef.current = null; }
        }
    }, SPIN_DURATION_WHEEL);
  };

  // Helper to calculate position and rotation for item text
  const getItemStyle = (index: number, numItems: number): React.CSSProperties => {
    const anglePerSegment = 360 / numItems;
    const itemAngle = index * anglePerSegment + anglePerSegment / 2; // Angle to the center of the segment
    const radius = WHEEL_SIZE * 0.38; // Distance from center (adjust as needed)

    // Calculate position using trigonometry (0 degrees is top)
    const angleRad = itemAngle * Math.PI / 180;
    // Position is relative to the center (50%, 50%) of the parent (.wheel-graphic)
    const x = 50 + (radius / (WHEEL_SIZE / 100)) * Math.sin(angleRad);
    const y = 50 - (radius / (WHEEL_SIZE / 100)) * Math.cos(angleRad);

    // Rotate text to be perpendicular to the radius line (tangential)
    const textRotation = itemAngle + 90; // Add 90 degrees

    return {
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${textRotation}deg)`, // Center element and rotate
        width: 'auto', // Adjust width if needed
        textAlign: 'center',
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
                  <p style={{ color: wonItem.color || 'white', fontSize: '1.3em', fontWeight: 'bold', border: `2px solid ${wonItem.color || 'white'}`, padding: '6px 10px', display: 'inline-block', marginTop: '3px', backgroundColor: 'var(--secondary-bg)' }}>
                      {wonItem.name}
                  </p>
                  {wonItem.image_url && (
                      <img src={`http://localhost:3001${wonItem.image_url}`} alt={wonItem.name} style={{ display: 'block', width: '150px', height: '150px', objectFit: 'contain', margin: '8px auto', border: '1px solid var(--border-color)', backgroundColor: 'var(--input-bg)' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
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
                      // Apply conic gradient background here
                      style={{
                          background: generateConicGradient(currentCaseData.items.length),
                          // Rotation transform is applied dynamically in handleSpin
                      }}
                  >
                      {/* Background Segment Layer REMOVED */}

                      {/* Item Text Layer */}
                      <div className="wheel-item-texts">
                          {currentCaseData.items.map((item, index) => (
                              <div key={`item-${index}`} className="wheel-item-text" style={getItemStyle(index, currentCaseData.items.length)}>
                                  {/* Display only the name */}
                                  <span className="segment-name" style={{ color: item.color }}>
                                      {item.name}
                                  </span>
                              </div>
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
                          <img src={`http://localhost:3001${caseInfo.image_path}`} alt={caseInfo.name} className="case-grid-item-image" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
