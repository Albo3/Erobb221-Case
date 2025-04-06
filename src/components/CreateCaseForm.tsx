import React, { useState, useMemo } from 'react';
import type { ChangeEvent } from 'react'; // Use type-only import
import StyledButton from './StyledButton';

// Define the structure for an item's state in the form
interface CaseItemInputState {
  id: number; // For React key prop
  name: string;
  color: string;
  rules: string;
  imageFile: File | null; // Store the selected image file
  soundFile: File | null; // Store the selected sound file
}

// Define the structure for the JSON data sent to backend (without files)
interface CaseItemJsonData {
    name: string;
    color: string;
    rules?: string;
}

// Define standard CS:GO rarity colors and names (remains the same)
const RARITY_COLORS = [
    { name: 'Consumer Grade', value: '#b0c3d9' },
    { name: 'Industrial Grade', value: '#5e98d9' },
    { name: 'Mil-Spec', value: '#4b69ff' },
    { name: 'Restricted', value: '#8847ff' },
    { name: 'Classified', value: '#d32ce6' },
    { name: 'Covert', value: '#eb4b4b' },
    { name: 'Exceedingly Rare', value: '#ffd700' },
];

function CreateCaseForm() {
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [items, setItems] = useState<CaseItemInputState[]>([
    // Start with one empty item row, default color, null files
    { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', rules: '', imageFile: null, soundFile: null },
  ]);

  // Calculate odds based on item counts per rarity (remains the same)
  const itemCounts = useMemo(() => {
      const counts: { [color: string]: number } = {};
      for (const item of items) {
          counts[item.color] = (counts[item.color] || 0) + 1;
      }
      return counts;
  }, [items]);

  const totalItems = useMemo(() => items.length, [items]);

  // Function to handle changes in item text inputs (name, color, rules)
  const handleItemTextChange = (index: number, field: 'name' | 'color' | 'rules', value: string) => {
    const newItems = [...items];
    const itemToUpdate = newItems[index];
    if (itemToUpdate) {
        itemToUpdate[field] = value;
        setItems(newItems);
    }
  };

  // Function to handle changes in item file inputs (image, sound)
  const handleItemFileChange = (index: number, field: 'imageFile' | 'soundFile', event: ChangeEvent<HTMLInputElement>) => {
    const newItems = [...items];
    const itemToUpdate = newItems[index];
    if (itemToUpdate && event.target.files && event.target.files.length > 0) {
        const file = event.target.files[0]; // Get the file
        itemToUpdate[field] = file ?? null; // Assign file or null if undefined
        setItems(newItems);
    } else if (itemToUpdate) {
        // If no file is selected (e.g., user cancels), clear the file state
        itemToUpdate[field] = null;
        setItems(newItems);
    }
  };


  // Function to add a new empty item row
  const addItem = () => {
    // Add item with null files
    setItems([...items, { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', rules: '', imageFile: null, soundFile: null }]);
  };

  // Function to remove an item row (remains the same logic)
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Function to handle saving the case
  const handleSaveCase = () => {
    // Basic validation
    if (!caseName.trim()) {
      alert('Please enter a case name.');
      return;
    }
    // Validate items based on name and color
    const validItemsState = items.filter(item => item.name.trim() && item.color.trim());

    if (validItemsState.length === 0) {
        alert('Please add at least one valid item with name and color.');
        return;
    }

    // --- Prepare data for FormData ---
    const formData = new FormData();

    // 1. Prepare JSON data part (without files)
    const jsonData: { name: string; description: string; items: CaseItemJsonData[] } = {
      name: caseName.trim(),
      description: caseDescription.trim(),
      items: validItemsState.map(({ name, color, rules }) => ({
        name: name.trim(),
        color: color.trim(),
        rules: rules.trim() || undefined, // Send undefined if empty, backend handles null
      })),
    };
    formData.append('jsonData', JSON.stringify(jsonData));

    // 2. Append files
    validItemsState.forEach((item, index) => {
        if (item.imageFile) {
            formData.append(`image_${index}`, item.imageFile);
        }
        if (item.soundFile) {
            formData.append(`sound_${index}`, item.soundFile);
        }
    });

    // --- Send FormData to backend API ---
    fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      // DO NOT set Content-Type header, browser does it automatically for FormData
      body: formData,
    })
    .then(async response => {
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const text = await response.text();
            console.error("Raw error response text:", text);
            const errData = JSON.parse(text);
            errorMsg = errData.error || errorMsg;
        } catch (e) {
            console.warn("Could not parse error response as JSON.", e);
        }
        throw new Error(errorMsg);
      }
      return response.json();
    })
    .then(data => {
      alert(`Case "${jsonData.name}" created successfully with ID: ${data.caseId}`);
      // Reset form
      setCaseName('');
      setCaseDescription('');
      setItems([{ id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', rules: '', imageFile: null, soundFile: null }]);
    })
    .catch(error => {
      console.error('Error saving case:', error);
      alert(`Error saving case: ${error.message}`);
    });
  };

  return (
    <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '5px' }}>
      <h2>Create New Case</h2>
      <hr className="cs-hr" style={{ margin: '15px 0' }} />

      {/* Case Name and Description (remains the same) */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="caseName" style={{ display: 'block', marginBottom: '5px' }}>Case Name:</label>
        <input
          type="text"
          id="caseName"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="e.g., My Awesome Case"
          className="cs-input"
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="caseDescription" style={{ display: 'block', marginBottom: '5px' }}>Description:</label>
        <textarea
          id="caseDescription"
          value={caseDescription}
          onChange={(e) => setCaseDescription(e.target.value)}
          placeholder="A short description of the case contents"
          className="cs-input"
          style={{ width: '100%', minHeight: '60px' }}
        />
      </div>

      {/* Items Section */}
      <h3>Items</h3>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {/* Row 1: Name, Color, Odds, Remove Button */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '5px', alignItems: 'center' }}>
            {/* Name Input */}
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleItemTextChange(index, 'name', e.target.value)}
              placeholder="Item Name"
              className="cs-input"
              style={{ flexGrow: 1 }}
            />
            {/* Color Dropdown */}
            <select
              value={item.color}
              onChange={(e) => handleItemTextChange(index, 'color', e.target.value)}
              className="cs-input"
              style={{ width: '170px' }}
            >
              {RARITY_COLORS.map(colorOption => (
                <option key={colorOption.value} value={colorOption.value}>
                  {colorOption.name}
                </option>
              ))}
            </select>
            {/* Odds Display */}
            <span style={{ width: '60px', textAlign: 'right', fontSize: '0.9em', color: 'var(--secondary-text)' }}>
              {totalItems > 0
                ? `${(((itemCounts[item.color] || 0) / totalItems) * 100).toFixed(2)}%`
                : '0.00%'}
            </span>
            {/* Remove Button */}
            <StyledButton
              onClick={() => removeItem(index)}
              disabled={items.length <= 1}
              variant="danger"
              style={{ padding: '5px 10px', minWidth: 'auto' }}
            >
              Remove
            </StyledButton>
          </div>
          {/* Row 2: Image File, Rules Text, Sound File */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', marginLeft: '10px', alignItems: 'center' }}>
             {/* Image File Input */}
             <div style={{ flexGrow: 1 }}>
                 <label htmlFor={`image_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Image (Optional):</label>
                 <input
                    type="file"
                    id={`image_${index}`}
                    accept="image/png, image/jpeg, image/gif, image/webp" // Suggest image types
                    onChange={(e) => handleItemFileChange(index, 'imageFile', e)}
                    className="cs-input" // May need specific styling for file inputs
                 />
             </div>
             {/* Rules Text Input */}
             <div style={{ flexGrow: 1 }}>
                 <label htmlFor={`rules_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Rules (Optional):</label>
                 <input
                    type="text"
                    id={`rules_${index}`}
                    value={item.rules}
                    onChange={(e) => handleItemTextChange(index, 'rules', e.target.value)}
                    placeholder="Item Rules Text"
                    className="cs-input"
                 />
             </div>
             {/* Sound File Input */}
             <div style={{ flexGrow: 1 }}>
                 <label htmlFor={`sound_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Sound (Optional):</label>
                 <input
                    type="file"
                    id={`sound_${index}`}
                    accept="audio/mpeg, audio/wav, audio/ogg" // Suggest audio types
                    onChange={(e) => handleItemFileChange(index, 'soundFile', e)}
                    className="cs-input" // May need specific styling for file inputs
                 />
             </div>
          </div>
        </React.Fragment>
      ))}

      <StyledButton onClick={addItem} style={{ marginRight: '10px' }}>
        Add Item
      </StyledButton>

      <StyledButton onClick={handleSaveCase} style={{ marginTop: '20px' }}>
        Save Case to Database
      </StyledButton>
    </div>
  );
}

export default CreateCaseForm;
