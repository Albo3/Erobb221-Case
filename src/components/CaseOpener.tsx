import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '../config';
// Removed matter import
import StyledButton from './StyledButton';
import './CaseOpener.css';
// Removed direct JSON import
// Removed import caseSoundUrl from '/public/sounds/case.mp3';

// Define interfaces for case data structure
interface CaseItem {
  name: string;
  // color: string; // Removed old color
  display_color: string; // Added display color
  percentage_chance: number; // Added percentage chance
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
  // Add item_template_id if needed for any logic here, though maybe not
  item_template_id?: number; // Optional, might not be needed directly in opener
}

interface CaseData {
  name: string;
  description: string | null;
  items: CaseItem[];
  id?: number;
}

// Interface for the list of cases fetched from /api/cases
interface CaseInfo {
    id: number;
    name: string;
    image_path: string | null; // Add image_path
}


const REEL_ITEM_WIDTH = 120; // Width of each item in pixels (now matches height, no margin)
const SPIN_DURATION = 6000; // Duration of spin animation in ms (Increased to 6s)

// Define props interface
interface CaseOpenerProps {
    volume: number;
    onVolumeChange: (newVolume: number) => void;
    onNewUnbox: (item: CaseItem) => void; // Add prop to report unboxed item
}

function CaseOpener({ volume, onVolumeChange, onNewUnbox }: CaseOpenerProps) { // Destructure props
  const [isSpinning, setIsSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<CaseItem[]>([]);
  const [wonItem, setWonItem] = useState<CaseItem | null>(null);
  // const [unboxedHistory, setUnboxedHistory] = useState<CaseItem[]>([]); // Remove history state
  // const [volume, setVolume] = useState(0.5); // Remove internal volume state
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(''); // Store ID as string from select value
  const [currentCaseData, setCurrentCaseData] = useState<CaseData | null>(null); // Holds data for the selected case
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Ref to store current ITEM sound instance
  const caseAudioRef = useRef<HTMLAudioElement | null>(null); // Ref to store current CASE OPENING sound instance

  // Effect to fetch the list of available cases on mount
  useEffect(() => {
      setIsLoading(true);
      fetch(getApiUrl('/api/cases'))
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
                  // Define a default fallback case with new structure
                  const defaultItems: CaseItem[] = [
                      { name: "Default Item 1", display_color: "#cccccc", percentage_chance: 50, image_url: null, rules: null, sound_url: null },
                      { name: "Default Item 2", display_color: "#aaaaaa", percentage_chance: 30, image_url: null, rules: null, sound_url: null },
                      { name: "Default Item 3", display_color: "#888888", percentage_chance: 15, image_url: null, rules: null, sound_url: null },
                      { name: "Default Item 4", display_color: "#666666", percentage_chance: 5, image_url: null, rules: null, sound_url: null },
                  ];
                  setCurrentCaseData({
                      id: 0,
                      name: "Default Starter Case",
                      description: "A basic case loaded because the database is empty.",
                      items: defaultItems
                  });
                  // Initialize reel for fallback case
                  setReelItems(defaultItems.slice(0, 10)); // Use default items for reel
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
      fetch(getApiUrl(`/api/cases/${selectedCaseId}`))
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

  // Effect to update volume of currently playing sounds when volume prop changes
  useEffect(() => {
    if (audioRef.current) { // Update item sound volume
      // console.log(`[CaseOpener Volume Effect] Updating ITEM volume to: ${volume}`);
      audioRef.current.volume = volume; // Use volume prop
    }
    if (caseAudioRef.current) { // Update case opening sound volume
      // console.log(`[CaseOpener Volume Effect] Updating CASE volume to: ${volume}`);
      caseAudioRef.current.volume = volume; // Use volume prop
    }
  }, [volume]); // Run this effect when volume prop changes

  // Function to get a random item based on custom percentage chance
  const getRandomItem = (): CaseItem | null => {
      if (!currentCaseData || !currentCaseData.items || currentCaseData.items.length === 0) {
          console.warn("getRandomItem called with no case data or items.");
          return null;
      }

      const items = currentCaseData.items;
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
      return items[items.length - 1] ?? null;
  };

  const startSpin = () => {
    // Check if spinning or if case data isn't loaded
    if (isSpinning || !currentCaseData || currentCaseData.items.length === 0) return;

    // Stop any currently playing sounds (both item and case opening) before starting a new spin
    if (audioRef.current) {
        console.log("[CaseOpener] Stopping previous item sound.");
        audioRef.current.pause();
        audioRef.current.src = ''; // Detach source
        audioRef.current = null;
    }
    if (caseAudioRef.current) {
        console.log("[CaseOpener] Stopping previous case opening sound.");
        caseAudioRef.current.pause();
        caseAudioRef.current.src = ''; // Detach source
        caseAudioRef.current = null;
    }

    // Play the case opening sound
    try {
        const caseSoundUrl = getApiUrl('/uploads/sounds/case.mp3');
        console.log(`[CaseOpener] Attempting to play case opening sound from uploads URL: ${caseSoundUrl}`);
        const newCaseAudio = new Audio(caseSoundUrl); // Use the correct URL
        newCaseAudio.volume = volume; // Use current volume state
        caseAudioRef.current = newCaseAudio; // Store the new audio instance
        newCaseAudio.play().catch(e => {
            console.error("Error playing case opening sound:", e);
            caseAudioRef.current = null; // Clear ref on playback error
        });
        // Optional: Clear ref when audio finishes playing naturally
        newCaseAudio.onended = () => {
            console.log("[CaseOpener] Case opening sound finished playing.");
            // Don't clear ref here, might be needed by volume slider or stopped later
        };
    } catch (e) {
        console.error("Error creating case opening audio object:", e);
        caseAudioRef.current = null; // Clear ref if object creation fails
    }


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
      setWonItem(currentWinningItem); // Set the winning item

      // Call the callback prop to report the unboxed item to App
      if (currentWinningItem) {
          onNewUnbox(currentWinningItem);
      }

      // --- Log details for debugging ---
      console.log(`[CaseOpener] Won item details:`, currentWinningItem);
      if (currentWinningItem?.image_url) {
          console.log(`[CaseOpener] Attempting to display image from: ${getApiUrl(currentWinningItem.image_url)}`);
      } else {
          console.log(`[CaseOpener] No image_url found for won item.`);
      }
      // --- End Log details ---

      // Stop the case opening sound first
      if (caseAudioRef.current) {
          console.log("[CaseOpener] Stopping case opening sound on reveal.");
          caseAudioRef.current.pause();
          caseAudioRef.current.src = '';
          caseAudioRef.current = null;
      }

      // --- Play Item Sound ---
      if (currentWinningItem?.sound_url) { // Play sound associated with the WON item
          try {
              // Construct the full URL by prepending the backend origin
              const fullSoundUrl = getApiUrl(currentWinningItem.sound_url);
              console.log(`[CaseOpener] Attempting to play sound from: ${fullSoundUrl}`);
              const newAudio = new Audio(fullSoundUrl);
              newAudio.volume = volume; // Use volume state
              audioRef.current = newAudio; // Store the new audio instance
              newAudio.play().catch(e => {
                  console.error("Error playing item sound:", e);
                  audioRef.current = null; // Clear ref on playback error
              });
              // Optional: Clear ref when audio finishes playing naturally
              newAudio.onended = () => {
                  console.log("[CaseOpener] Sound finished playing.");
                  audioRef.current = null;
              };
          } catch (e) {
              console.error("Error creating item audio object:", e);
              audioRef.current = null; // Clear ref if object creation fails
          }
      }
      // --- End Play Item Sound ---

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
    // Remove the outer flex container div, return the main content div directly
    // <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
      <div style={{ flexGrow: 1 }}> {/* This div becomes the root */}
          {/* Volume Slider Removed - Now handled in App.tsx */}

          {/* Display Loading / Error - Moved up */}
      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red', marginBottom: '20px' }}>Error: {error}</p>}

      {/* Won Item Display Area (Moved Above Reel) */}
      {/* Further reduced minHeight, marginBottom, paddingBottom */}
      <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          {wonItem && !isSpinning && (
              <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontSize: '1.1em', marginBottom: '3px' }}>You unboxed:</h3> {/* Reduced margin */}
                  <p style={{
                      color: wonItem.display_color || 'white', // Use display_color
                      fontSize: '1.4em', // Keep font size
                      fontWeight: 'bold',
                      border: `1px solid ${wonItem.display_color || 'white'}`, // Use display_color
                      padding: '7px 10px', // Increased padding
                      display: 'inline-block',
                      marginTop: '3px', // Keep margin
                      backgroundColor: 'var(--secondary-bg)', // Reverted to original background
                      textShadow: '1px 1px 2px rgba(0, 0, 0, 0.6)', // Made shadow weaker
                      letterSpacing: '1px' // Added letter spacing
                  }}>
                      {wonItem.name}
                  </p>
                  {/* Display Image if URL exists */}
                  {wonItem.image_url && (
                      <img
                          src={getApiUrl(wonItem.image_url)}
                          alt={wonItem.name}
                          style={{
                              display: 'block',
                              width: '150px', // Reduced size
                              height: '150px', // Reduced size
                              objectFit: 'contain',
                              margin: '8px auto', // Reduced margin
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--input-bg)'
                          }}
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                  )}
                  {/* Rules display removed from here - now handled in App.tsx left panel */}
              </div>
          )}
          {/* Placeholder text if nothing won yet */}
          {!wonItem && !isSpinning && <p style={{ color: 'var(--secondary-text)' }}>Click "Open Case" to begin</p>}
      </div>


      {/* Case Opener Reel and Button Section */}
      {selectedCaseId && currentCaseData && !isLoading && !error && (
          <div style={{ marginBottom: '20px' }}> {/* Reduced margin */}
              <h2>{currentCaseData.name}</h2>
              {/* Conditionally render description only if it exists */}
              {currentCaseData.description && <p>{currentCaseData.description}</p>}
              <hr className="cs-hr" style={{ margin: '10px 0' }} /> {/* Reduced margin */}

              {/* The visual container for the reel */}
              <div className="case-opener-viewport">
                  <div className="case-opener-reel" ref={reelRef}>
                      {reelItems.map((item, index) => (
                          <div
                              key={`${item.name}-${item.item_template_id || index}-${Math.random()}`} // Improve key uniqueness
                              // Conditionally add 'no-image' class if image_url is missing
                              className={`case-opener-item ${!item.image_url ? 'no-image' : ''}`}
                              style={{ color: item.display_color || 'white' }} // Use display_color
                          >
                              {/* Wrap name in a span for specific styling */}
                              <span className="case-opener-item-name">{item.name}</span>
                              {/* Add image if URL exists */}
                              {item.image_url && (
                                  <img
                                      src={getApiUrl(item.image_url)}
                                      alt={item.name}
                                      className="case-opener-item-image"
                                      // Basic error handling for image loading
                                      onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                              )}
                          </div>
                      ))}
                  </div>
                  {/* Center marker */}
                  <div className="case-opener-marker"></div>
              </div>

              {/* Open Case Button - Made larger */}
              <div style={{ textAlign: 'center', marginTop: '15px' }}> {/* Reduced margin */}
                  <StyledButton
                      onClick={startSpin}
                      disabled={isSpinning || !currentCaseData || currentCaseData.items.length === 0}
                      // Add styles for larger button
                      style={{
                          padding: '15px 30px', // Larger padding
                          fontSize: '1.5em', // Larger font size
                          minWidth: '200px' // Ensure minimum width
                      }}
                  >
                      {isSpinning ? 'Opening...' : 'Open Case'}
                  </StyledButton>
              </div>
          </div>
      )}

       {/* Won Item Display Removed from here */}

      {/* Case Selection Grid (Moved to Bottom) */}
      {/* Reduced marginTop, paddingTop, marginBottom */}
      <h3 style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginBottom: '8px' }}>Select a Case:</h3>
      <div className="case-selection-grid">
          {availableCases.length > 0 ? (
              availableCases.map(caseInfo => (
                  <div
                      key={caseInfo.id}
                      className={`case-grid-item ${selectedCaseId === caseInfo.id.toString() ? 'selected' : ''}`}
                      onClick={() => setSelectedCaseId(caseInfo.id.toString())}
                  >
                      {/* Display image if path exists */}
                      {caseInfo.image_path && (
                          <img
                              src={getApiUrl(caseInfo.image_path)}
                              alt={caseInfo.name}
                              className="case-grid-item-image" // Add class for styling
                              loading="lazy" // Lazy load images
                              onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if error
                          />
                      )}
                      {/* Overlay name */}
                      <span className="case-grid-item-name-overlay">{caseInfo.name}</span>
                  </div>
              ))
          ) : (
              // Handle loading or no cases state for the grid area
              !isLoading && <p style={{ color: 'orange', gridColumn: '1/-1' }}>No cases found. Create one in Admin Mode!</p>
          )}
          {/* Display loading indicator within the grid area if needed */}
          {isLoading && <p style={{ gridColumn: '1/-1' }}>Loading cases...</p>}
      </div>
      {/* </div> */} {/* Removed closing tag for outer flex container */}

      {/* History Panel Removed - Now handled in App.tsx */}
    </div>
  );
}

export default CaseOpener;
