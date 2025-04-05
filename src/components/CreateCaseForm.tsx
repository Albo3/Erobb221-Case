import React, { useState, useMemo } from 'react'; // Import useMemo
import StyledButton from './StyledButton';

// Define the structure for an item within the case
interface CaseItemInput {
  id: number; // For React key prop
  name: string; // Name is still needed!
  color: string;
  image_url: string;
  rules: string;
}

// Define the structure for the case being created
interface CaseDefinition {
  name: string;
  description: string;
  items: CaseItemInput[];
}

// Define standard CS:GO rarity colors and names
const RARITY_COLORS = [
    { name: 'Consumer Grade', value: '#b0c3d9' },    // White/Grayish
    { name: 'Industrial Grade', value: '#5e98d9' },  // Light Blue
    { name: 'Mil-Spec', value: '#4b69ff' },          // Blue
    { name: 'Restricted', value: '#8847ff' },        // Purple
    { name: 'Classified', value: '#d32ce6' },        // Pink
    { name: 'Covert', value: '#eb4b4b' },            // Red
    { name: 'Exceedingly Rare', value: '#ffd700' },  // Gold (Knives/Gloves)
];

function CreateCaseForm() {
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [caseSoundUrl, setCaseSoundUrl] = useState(''); // Added state for sound URL
  const [items, setItems] = useState<CaseItemInput[]>([
    // Start with one empty item row, default color, empty image/rules
    { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', image_url: '', rules: '' },
  ]);

  // Calculate odds based on item counts per rarity
  const itemCounts = useMemo(() => {
      const counts: { [color: string]: number } = {};
      for (const item of items) {
          counts[item.color] = (counts[item.color] || 0) + 1;
      }
      return counts;
  }, [items]);

  const totalItems = useMemo(() => items.length, [items]);

  // Function to handle changes in item inputs
  const handleItemChange = (index: number, field: keyof Omit<CaseItemInput, 'id'>, value: string) => {
    const newItems = [...items];
    const itemToUpdate = newItems[index];
    if (itemToUpdate) {
        // Type assertion needed as field is a keyof the partial type
        (itemToUpdate as any)[field] = value;
        setItems(newItems);
    }
  };

  // Function to add a new empty item row
  const addItem = () => {
    // Default new item color to Consumer Grade, empty image/rules
    setItems([...items, { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', image_url: '', rules: '' }]);
  };

  // Function to remove an item row
  const removeItem = (index: number) => {
    // Prevent removing the last item row
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Function to handle saving the case (JSON download)
  const handleSaveCase = () => {
    // Basic validation
    if (!caseName.trim()) {
      alert('Please enter a case name.');
      return;
    }
    // Validate items based on name and color (image/rules are optional)
    const validItems = items.filter(item => item.name.trim() && item.color.trim());

    if (validItems.length === 0) {
        alert('Please add at least one valid item with name and color.');
        return;
    }

    // Format data for API request
    const outputData = {
      name: caseName.trim(),
      description: caseDescription.trim(),
      sound_url: caseSoundUrl.trim() || null, // Send null if empty
      items: validItems.map(({ name, color, image_url, rules }) => ({
        name: name.trim(),
        color: color.trim(),
        image_url: image_url.trim() || null, // Send null if empty
        rules: rules.trim() || null, // Send null if empty
      })),
    };

    // Convert data to JSON string for the request body
    const jsonString = JSON.stringify(outputData, null, 2);

    // --- Send data to backend API ---
    // Use the full URL for the backend server
    fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonString,
    })
    .then(response => {
      if (!response.ok) {
        // Attempt to read error message from backend if available
        return response.json().then(errData => {
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }).catch(() => {
            // Fallback if response is not JSON or reading fails
            throw new Error(`HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      alert(`Case "${outputData.name}" created successfully with ID: ${data.caseId}`);
      // Optionally reset the form here
      setCaseName('');
      setCaseDescription('');
      setCaseSoundUrl(''); // Reset sound URL
      // Reset form with default item
      setItems([{ id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9', image_url: '', rules: '' }]);
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

      {/* Case Name and Description */}
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="caseName" style={{ display: 'block', marginBottom: '5px' }}>Case Name:</label>
        <input
          type="text"
          id="caseName"
          value={caseName}
          onChange={(e) => setCaseName(e.target.value)}
          placeholder="e.g., My Awesome Case"
          className="cs-input" // Assuming a global input style
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
          className="cs-input" // Assuming a global textarea style
          style={{ width: '100%', minHeight: '60px' }}
        />
      </div>
       {/* Case Sound URL */}
       <div style={{ marginBottom: '20px' }}>
        <label htmlFor="caseSoundUrl" style={{ display: 'block', marginBottom: '5px' }}>Case Sound URL (Optional):</label>
        <input
          type="text"
          id="caseSoundUrl"
          value={caseSoundUrl}
          onChange={(e) => setCaseSoundUrl(e.target.value)}
          placeholder="e.g., /sounds/case_open.mp3 or https://example.com/sound.wav"
          className="cs-input"
          style={{ width: '100%' }}
        />
      </div>

      {/* Items Section */}
      <h3>Items</h3>
      {items.map((item, index) => (
        // Use React.Fragment or a div to wrap the two rows per item
        <React.Fragment key={item.id}>
          {/* Row 1: Name, Color, Odds, Remove Button */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '5px', alignItems: 'center' }}>
            <input
              type="text"
            value={item.name}
            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
            placeholder="Item Name"
            className="cs-input"
            style={{ flexGrow: 1 }}
          />
          {/* Removed Weight Input */}
          {/* Color Dropdown */}
          <select
            value={item.color}
            onChange={(e) => handleItemChange(index, 'color', e.target.value)}
            className="cs-input" // Reuse input style for select
            style={{ width: '170px' }} // Adjust width slightly
          >
            {RARITY_COLORS.map(colorOption => (
              <option key={colorOption.value} value={colorOption.value}>
                {colorOption.name}
              </option>
            ))}
          </select>
          {/* Odds Display based on counts */}
          <span style={{ width: '60px', textAlign: 'right', fontSize: '0.9em', color: 'var(--secondary-text)' }}>
            {totalItems > 0
              ? `${(((itemCounts[item.color] || 0) / totalItems) * 100).toFixed(2)}%` // Odds based on count of this color
              : '0.00%'}
          </span>
          <StyledButton
            onClick={() => removeItem(index)}
            disabled={items.length <= 1}
            variant="danger" // Assuming a danger variant for removal
            style={{ padding: '5px 10px', minWidth: 'auto' }}
          >
              Remove
            </StyledButton>
          </div>
          {/* Row 2: Image URL and Rules Inputs */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', marginLeft: '10px' }}>
             <input
                type="text"
                value={item.image_url}
                onChange={(e) => handleItemChange(index, 'image_url', e.target.value)}
                placeholder="Item Image URL (Optional)"
                className="cs-input"
                style={{ flexGrow: 1 }}
             />
             <input
                type="text"
                value={item.rules}
                onChange={(e) => handleItemChange(index, 'rules', e.target.value)}
                placeholder="Item Rules (Optional)"
                className="cs-input"
                style={{ flexGrow: 1 }}
             />
          </div>
        </React.Fragment>
      ))}
      {/* Removed Total Weight display */}
      {/* <div style={{marginTop: '5px', marginBottom: '15px', textAlign: 'right', paddingRight: '80px', fontSize: '0.9em', fontWeight: 'bold'}}>
          Total Weight: {totalWeight}
      </div> */}

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
