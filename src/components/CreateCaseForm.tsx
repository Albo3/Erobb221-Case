import React, { useState, useMemo } from 'react'; // Import useMemo
import StyledButton from './StyledButton';

// Define the structure for an item within the case
interface CaseItemInput {
  id: number; // For React key prop
  name: string;
  // weight: string; // Removed weight input
  color: string; // Store the color value (e.g., 'Mil-Spec Blue')
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
  const [items, setItems] = useState<CaseItemInput[]>([
    // Start with one empty item row, default color to Consumer Grade
    { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' },
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
    // Default new item color to Consumer Grade
    setItems([...items, { id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
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
    // Validate items based on name and color only now
    const validItems = items.filter(item => item.name.trim() && item.color.trim());

    if (validItems.length === 0) {
        alert('Please add at least one valid item with name and color.');
        return;
    }

    // Format data for JSON output - NO WEIGHT SENT
    // NOTE: Backend /api/cases POST endpoint will need adjustment
    // as it currently expects 'weight'. For now, this save will likely fail.
    const outputData = {
      name: caseName.trim(),
      description: caseDescription.trim(),
      items: validItems.map(({ name, color }) => ({
        name: name.trim(),
        // weight: ??? // Decide how/if to handle weight/odds on backend
        color: color.trim(),
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
      // Reset form with default item
      setItems([{ id: Date.now(), name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
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

      {/* Items Section */}
      <h3>Items</h3>
      {items.map((item, index) => (
        <div key={item.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
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
