import React, { useState, useMemo, useEffect } from 'react';
import type { ChangeEvent } from 'react'; // Use type-only import
import StyledButton from './StyledButton';

// Define structure for Item Template data received from backend
interface ItemTemplate {
    id: number;
    base_name: string;
    // We don't strictly need the paths/text here, just ID and name for selection
}

// Define the structure for an item's state in the form (linking template)
interface CaseItemState {
  id: number; // For React key prop
  item_template_id: number | null; // ID of the selected template
  override_name: string; // Optional name override for this instance
  color: string; // Color specific to this item in this case
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
  const [items, setItems] = useState<CaseItemState[]>([
    // Start with one empty item row, default color, null template ID
    { id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' },
  ]);

  // State to hold available item templates fetched from backend
  const [availableTemplates, setAvailableTemplates] = useState<ItemTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Fetch available item templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        try {
            const response = await fetch(`http://localhost:3001/api/item-templates`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data: ItemTemplate[] = await response.json();
            setAvailableTemplates(data);
        } catch (err) {
            console.error(`Error fetching item templates:`, err);
            setTemplateError(`Failed to load item templates. Please check the Item Template Manager.`);
            setAvailableTemplates([]); // Clear on error
        } finally {
            setIsLoadingTemplates(false);
        }
    };
    fetchTemplates();
  }, []); // Empty dependency array means run once on mount


  // Calculate odds based on item counts per rarity (remains the same)
  const itemCounts = useMemo(() => {
      const counts: { [color: string]: number } = {};
      for (const item of items) {
          counts[item.color] = (counts[item.color] || 0) + 1;
      }
      return counts;
  }, [items]);

  const totalItems = useMemo(() => items.length, [items]);

  // Function to handle changes in item inputs (template selection, override name, color)
  const handleItemChange = (
      index: number,
      field: keyof Omit<CaseItemState, 'id'>,
      value: string | number | null
    ) => {
    const newItems = [...items];
    const itemToUpdate = newItems[index];
    if (itemToUpdate) {
        if (field === 'item_template_id') {
            const numValue = (value === '' || value === null) ? null : Number(value);
            itemToUpdate[field] = (numValue !== null && isNaN(numValue)) ? null : numValue;
        } else { // override_name or color
             (itemToUpdate as any)[field] = value as string;
        }
        setItems(newItems);
    }
  };

  // Function to add a new empty item row
  const addItem = () => {
    setItems([...items, { id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
  };

  // Function to remove an item row (remains the same logic)
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Function to handle saving the case (sending JSON with template IDs)
  const handleSaveCase = () => {
    // Basic validation
    if (!caseName.trim()) {
      alert('Please enter a case name.');
      return;
    }
    // Validate items: must have a template selected and a color
    const validItems = items.filter(item => item.item_template_id !== null && item.color.trim());

    if (validItems.length === 0) {
        alert('Please add at least one item with an Item Template selected and a color.');
        return;
    }
     if (validItems.length !== items.length) {
        alert('One or more items are missing an Item Template selection. Please select a template for all items.');
        return;
    }


    // --- Prepare JSON data for the request body ---
    const caseDataPayload = {
      name: caseName.trim(),
      description: caseDescription.trim(),
      items: validItems.map(({ item_template_id, override_name, color }) => ({
        item_template_id: item_template_id, // Should not be null here due to filter
        override_name: override_name.trim() || null, // Send null if override is empty
        color: color.trim(),
      })),
    };

    // --- Send JSON data to backend API ---
    fetch('http://localhost:3001/api/cases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(caseDataPayload),
    })
    .then(async response => {
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
            const text = await response.text(); console.error("Raw error response text:", text);
            const errData = JSON.parse(text); errorMsg = errData.error || errorMsg;
        } catch (e) { console.warn("Could not parse error response as JSON.", e); }
        throw new Error(errorMsg);
      }
      return response.json();
    })
    .then(data => {
      alert(`Case "${caseDataPayload.name}" created successfully with ID: ${data.caseId}`);
      // Reset form
      setCaseName('');
      setCaseDescription('');
      setItems([{ id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
    })
    .catch(error => {
      console.error('Error saving case:', error);
      alert(`Error saving case: ${error.message}`);
    });
  };

  // Helper to render template options
  const renderTemplateOptions = (templates: ItemTemplate[]) => {
      return templates.map(template => (
          <option key={template.id} value={template.id}>
              {template.base_name} (ID: {template.id})
          </option>
      ));
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
          required
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
      {templateError && <p style={{ color: 'red' }}>{templateError}</p>}
      {isLoadingTemplates && <p>Loading item templates...</p>}

      {!isLoadingTemplates && items.map((item, index) => (
        <React.Fragment key={item.id}>
          {/* Item Row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '15px' }}>
            {/* Template Selector */}
            <div style={{ flexBasis: '35%' }}>
                 <label htmlFor={`template_select_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Item Template:</label>
                 <select
                    id={`template_select_${index}`}
                    value={item.item_template_id ?? ''}
                    onChange={(e) => handleItemChange(index, 'item_template_id', e.target.value)}
                    className="cs-input"
                    required
                 >
                     <option value="" disabled>-- Select Template --</option>
                     {renderTemplateOptions(availableTemplates)}
                 </select>
            </div>
             {/* Override Name Input */}
             <div style={{ flexBasis: '30%' }}>
                 <label htmlFor={`override_name_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Name Override (Optional):</label>
                 <input
                    type="text"
                    id={`override_name_${index}`}
                    value={item.override_name}
                    onChange={(e) => handleItemChange(index, 'override_name', e.target.value)}
                    placeholder="e.g., StatTrak™"
                    className="cs-input"
                 />
             </div>
            {/* Color Dropdown */}
             <div style={{ flexBasis: '25%' }}>
                 <label htmlFor={`color_select_${index}`} style={{ fontSize: '0.8em', display: 'block', marginBottom: '2px' }}>Rarity/Color:</label>
                 <select
                    id={`color_select_${index}`}
                    value={item.color}
                    onChange={(e) => handleItemChange(index, 'color', e.target.value)}
                    className="cs-input"
                    required
                 >
                    {RARITY_COLORS.map(colorOption => (
                        <option key={colorOption.value} value={colorOption.value}>
                        {colorOption.name}
                        </option>
                    ))}
                 </select>
             </div>
            {/* Remove Button */}
            <div style={{ flexBasis: '10%', textAlign: 'right' }}>
                <StyledButton
                onClick={() => removeItem(index)}
                disabled={items.length <= 1}
                variant="danger"
                style={{ padding: '5px 10px', minWidth: 'auto' }}
                >
                Remove
                </StyledButton>
            </div>
          </div>
        </React.Fragment>
      ))}

      <StyledButton onClick={addItem} style={{ marginRight: '10px' }} disabled={isLoadingTemplates}>
        Add Item Row
      </StyledButton>

      <StyledButton onClick={handleSaveCase} style={{ marginTop: '20px' }} disabled={isLoadingTemplates}>
        Save Case to Database
      </StyledButton>
    </div>
  );
}

export default CreateCaseForm;
