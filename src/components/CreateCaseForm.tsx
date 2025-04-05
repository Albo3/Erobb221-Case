import React, { useState, useMemo } from 'react'; // Import useMemo
import StyledButton from './StyledButton';

// Define the structure for an item within the case
interface CaseItemInput {
  id: number; // For React key prop
  name: string;
  weight: string; // Use string for input, parse later
  color: string; // Store the color value (e.g., 'gray', 'blue')
}

// Define the structure for the case being created
interface CaseDefinition {
  name: string;
  description: string;
  items: CaseItemInput[];
}

// Define standard rarity colors
const RARITY_COLORS = [
  { name: 'Gray (Common)', value: 'gray' },
  { name: 'Blue (Uncommon)', value: 'blue' },
  { name: 'Purple (Rare)', value: 'purple' },
  { name: 'Pink (Mythical)', value: 'pink' },
  { name: 'Red (Legendary)', value: 'red' },
  { name: 'Gold (Ancient)', value: 'gold' },
];

function CreateCaseForm() {
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [items, setItems] = useState<CaseItemInput[]>([
    // Start with one empty item row, default color to gray
    { id: Date.now(), name: '', weight: '', color: RARITY_COLORS[0]?.value ?? 'gray' },
  ]);

  // Calculate total weight using useMemo for efficiency
  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => {
      const weight = parseInt(item.weight, 10);
      return sum + (isNaN(weight) || weight <= 0 ? 0 : weight);
    }, 0);
  }, [items]); // Recalculate only when items change

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
    // Default new item color to gray
    setItems([...items, { id: Date.now(), name: '', weight: '', color: RARITY_COLORS[0]?.value ?? 'gray' }]);
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
    const validItems = items.filter(item => item.name.trim() && item.weight.trim() && !isNaN(parseInt(item.weight)) && parseInt(item.weight) > 0 && item.color.trim());

    if (validItems.length === 0) {
        alert('Please add at least one valid item with name, positive weight, and color.');
        return;
    }

    // Format data for JSON output
    const outputData = {
      name: caseName.trim(),
      description: caseDescription.trim(),
      items: validItems.map(({ name, weight, color }) => ({
        name: name.trim(),
        weight: parseInt(weight, 10), // Parse weight to number
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
      setItems([{ id: Date.now(), name: '', weight: '', color: '' }]);
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
          <input
            type="number"
            value={item.weight}
            onChange={(e) => handleItemChange(index, 'weight', e.target.value)}
            placeholder="Weight (Odds)"
            className="cs-input"
            style={{ width: '100px' }}
            min="1"
          />
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
          {/* Odds Display */}
          <span style={{ width: '60px', textAlign: 'right', fontSize: '0.9em', color: 'var(--secondary-text)' }}>
            {totalWeight > 0 && !isNaN(parseInt(item.weight)) && parseInt(item.weight) > 0
              ? `${((parseInt(item.weight) / totalWeight) * 100).toFixed(2)}%`
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
      <div style={{marginTop: '5px', marginBottom: '15px', textAlign: 'right', paddingRight: '80px', fontSize: '0.9em', fontWeight: 'bold'}}>
          Total Weight: {totalWeight}
      </div>

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
