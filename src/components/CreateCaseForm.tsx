import React, { useState, useMemo, useEffect } from 'react';
import type { ChangeEvent } from 'react'; // Use type-only import
import StyledButton from './StyledButton';

// Define structure for Item Template data received from backend
interface ItemTemplate {
    id: number;
    base_name: string;
}

// Define structure for Case List data
interface CaseInfo {
    id: number;
    name: string;
}

// Define structure for full Case Data (including items for editing)
interface FullCaseData {
    id: number;
    name: string;
    description: string | null;
    items: Array<{ // Structure returned by GET /api/cases/:id
        item_template_id: number;
        override_name: string | null;
        color: string;
        // We don't need the resolved name/urls here, just the IDs/color/override
    }>;
}


// Define the structure for an item's state in the form (linking template)
interface CaseItemState {
  id: number; // For React key prop (client-side only)
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

// Define weights based on rarity colors (copied from CaseOpener for consistency)
const rarityWeights: { [colorValue: string]: number } = {
    [RARITY_COLORS[0]?.value ?? '#b0c3d9']: 100, // Consumer Grade
    [RARITY_COLORS[1]?.value ?? '#5e98d9']: 50,  // Industrial Grade
    [RARITY_COLORS[2]?.value ?? '#4b69ff']: 25,  // Mil-Spec
    [RARITY_COLORS[3]?.value ?? '#8847ff']: 10,  // Restricted
    [RARITY_COLORS[4]?.value ?? '#d32ce6']: 5,   // Classified
    [RARITY_COLORS[5]?.value ?? '#eb4b4b']: 2,   // Covert
    [RARITY_COLORS[6]?.value ?? '#ffd700']: 1,   // Exceedingly Rare
};


function CreateCaseForm() {
  // Form state
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [items, setItems] = useState<CaseItemState[]>([
    { id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' },
  ]);

  // State for available data
  const [availableTemplates, setAvailableTemplates] = useState<ItemTemplate[]>([]);
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([]); // For edit dropdown

  // State for loading/error/editing
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingCases, setIsLoadingCases] = useState(true); // Loading state for cases list
  const [isSaving, setIsSaving] = useState(false); // For create/update button
  const [error, setError] = useState<string | null>(null); // General error display
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null); // Track if editing

  // Fetch available item templates and cases on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoadingTemplates(true);
        setIsLoadingCases(true);
        setError(null);
        try {
            // Fetch Templates
            const templatesResponse = await fetch(`http://localhost:3001/api/item-templates`);
            if (!templatesResponse.ok) throw new Error(`Failed to fetch item templates: ${templatesResponse.status}`);
            const templatesData: ItemTemplate[] = await templatesResponse.json();
            setAvailableTemplates(templatesData);

             // Fetch Cases
            const casesResponse = await fetch(`http://localhost:3001/api/cases`);
            if (!casesResponse.ok) throw new Error(`Failed to fetch cases: ${casesResponse.status}`);
            const casesData: CaseInfo[] = await casesResponse.json();
            setAvailableCases(casesData);

        } catch (err) {
            console.error(`Error fetching initial data:`, err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setAvailableTemplates([]);
            setAvailableCases([]);
        } finally {
            setIsLoadingTemplates(false);
            setIsLoadingCases(false);
        }
    };
    fetchInitialData();
  }, []); // Empty dependency array means run once on mount

  // Fetch full case details when editingCaseId changes
  useEffect(() => {
      if (editingCaseId === null) {
          // Reset form if we stop editing (or are creating)
          setCaseName('');
          setCaseDescription('');
          setItems([{ id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
          return;
      }

      // Fetch details for the selected case
      const fetchCaseDetails = async () => {
          setIsLoadingCases(true); // Indicate loading case details
          setError(null);
          try {
              const response = await fetch(`http://localhost:3001/api/cases/${editingCaseId}`);
              if (!response.ok) {
                   let errorMsg = `HTTP error! status: ${response.status}`;
                   try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch(e){}
                   throw new Error(errorMsg);
              }
              const data: FullCaseData = await response.json();

              // Populate form state
              setCaseName(data.name);
              setCaseDescription(data.description ?? '');
              // Map fetched items to the form's item state structure
              setItems(data.items.map(item => ({
                  id: Math.random(), // Generate temporary client-side ID for React key
                  item_template_id: item.item_template_id,
                  override_name: item.override_name ?? '',
                  color: item.color,
              })));

          } catch (err) {
              console.error(`Error fetching details for case ${editingCaseId}:`, err);
              setError(err instanceof Error ? err.message : 'Failed to load case details');
              // Optionally reset form or keep old data? Resetting might be safer.
              setEditingCaseId(null); // Stop editing on error
          } finally {
              setIsLoadingCases(false);
          }
      };

      fetchCaseDetails();

  }, [editingCaseId]); // Re-run when editingCaseId changes


  // Calculate odds based on item counts per rarity (remains the same)
  const itemCounts = useMemo(() => {
      const counts: { [color: string]: number } = {};
      for (const item of items) {
          counts[item.color] = (counts[item.color] || 0) + 1;
      }
      return counts;
  }, [items]);

  // Calculate total weight based on current items and their colors
  const totalWeight = useMemo(() => {
      return items.reduce((sum, item) => {
          const weight = rarityWeights[item.color] || 1; // Default weight if color somehow not found
          return sum + weight;
      }, 0);
  }, [items]); // Recalculate when items array changes

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

  // Function to handle saving the case (Create or Update)
  const handleSaveCase = () => {
    // Basic validation
    if (!caseName.trim()) {
      alert('Please enter a case name.');
      return;
    }
    const validItems = items.filter(item => item.item_template_id !== null && item.color.trim());
    if (validItems.length === 0) {
        alert('Please add at least one item with an Item Template selected and a color.');
        return;
    }
     if (validItems.length !== items.length) {
        alert('One or more items are missing an Item Template selection. Please select a template for all items.');
        return;
    }

    // Prepare payload
    const caseDataPayload = {
      name: caseName.trim(),
      description: caseDescription.trim() || null, // Send null if empty
      items: validItems.map(({ item_template_id, override_name, color }) => ({
        item_template_id: item_template_id,
        override_name: override_name.trim() || null,
        color: color.trim(),
      })),
    };

    // Determine URL and Method
    const url = editingCaseId
        ? `http://localhost:3001/api/cases/${editingCaseId}`
        : 'http://localhost:3001/api/cases';
    const method = editingCaseId ? 'PUT' : 'POST';

    setIsSaving(true);
    setError(null);

    // --- Send JSON data to backend API ---
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(caseDataPayload),
    })
    .then(async response => {
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try { const text = await response.text(); console.error("Raw error response text:", text); const errData = JSON.parse(text); errorMsg = errData.error || errorMsg; }
        catch (e) { console.warn("Could not parse error response as JSON.", e); }
        throw new Error(errorMsg);
      }
      return response.json();
    })
    .then(data => {
      alert(`Case "${caseDataPayload.name}" ${editingCaseId ? 'updated' : 'created'} successfully!`);
      // Reset form and editing state
      setEditingCaseId(null); // This will trigger the useEffect to reset the form
      // Refetch case list if needed (e.g., if names changed) - could optimize later
       setIsLoadingCases(true);
       fetch(`http://localhost:3001/api/cases`)
         .then(res => res.json())
         .then(setAvailableCases)
         .catch(err => console.error("Failed to refetch cases list:", err))
         .finally(() => setIsLoadingCases(false));
    })
    .catch(error => {
      console.error(`Error ${editingCaseId ? 'updating' : 'saving'} case:`, error);
      alert(`Error ${editingCaseId ? 'updating' : 'saving'} case: ${error.message}`);
      setError(error.message); // Show error to user
    })
    .finally(() => setIsSaving(false));
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
      {/* Case Selection for Editing */}
       <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
          <label htmlFor="case-edit-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>Edit Existing Case:</label>
          <select
              id="case-edit-select"
              value={editingCaseId ?? ''}
              onChange={(e) => setEditingCaseId(e.target.value ? Number(e.target.value) : null)}
              disabled={isLoadingCases || isLoadingTemplates || isSaving}
              className="cs-input"
              style={{ minWidth: '250px', marginRight: '10px' }}
          >
              <option value="">-- Create New Case --</option>
              {availableCases.map(caseInfo => (
                  <option key={caseInfo.id} value={caseInfo.id}>
                      {caseInfo.name} (ID: {caseInfo.id})
                  </option>
              ))}
          </select>
          {editingCaseId !== null && (
              <StyledButton onClick={() => setEditingCaseId(null)} disabled={isSaving}> {/* Removed size="small" */}
                  Clear Selection (Create New)
              </StyledButton>
          )}
          {isLoadingCases && <span style={{ marginLeft: '10px' }}>Loading cases...</span>}
      </div>

      <h2>{editingCaseId ? `Edit Case (ID: ${editingCaseId})` : 'Create New Case'}</h2>
      <hr className="cs-hr" style={{ margin: '15px 0' }} />

      {/* Display Errors */}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}

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
          disabled={isSaving}
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
          disabled={isSaving}
        />
      </div>

      {/* Items Section */}
      <h3>Items</h3>
      {/* Use the general 'error' state for template loading errors too */}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {isLoadingTemplates && <p>Loading item templates...</p>}

      {!isLoadingTemplates && !error && items.map((item, index) => ( // Also check for error before mapping
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
                    disabled={isSaving}
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
                    disabled={isSaving}
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
                    disabled={isSaving}
                 >
                    {RARITY_COLORS.map(colorOption => (
                        <option key={colorOption.value} value={colorOption.value}>
                        {colorOption.name}
                        </option>
                    ))}
                 </select>
                 {/* Display Percentage Chance */}
                 <span style={{ fontSize: '0.8em', marginLeft: '5px', color: 'var(--secondary-text)' }}>
                     ({totalWeight > 0
                         ? ((rarityWeights[item.color] || 1) / totalWeight * 100).toFixed(2)
                         : (items.length === 1 ? '100.00' : '0.00')
                     }%)
                 </span>
             </div>
            {/* Remove Button */}
            <div style={{ flexBasis: '10%', textAlign: 'right' }}>
                <StyledButton
                onClick={() => removeItem(index)}
                disabled={items.length <= 1 || isSaving}
                variant="danger"
                style={{ padding: '5px 10px', minWidth: 'auto' }}
                >
                Remove
                </StyledButton>
            </div>
          </div>
        </React.Fragment>
      ))}

      <StyledButton onClick={addItem} style={{ marginRight: '10px' }} disabled={isLoadingTemplates || isSaving}>
        Add Item Row
      </StyledButton>

      <StyledButton onClick={handleSaveCase} style={{ marginTop: '20px' }} disabled={isLoadingTemplates || isLoadingCases || isSaving}>
        {isSaving ? 'Saving...' : (editingCaseId ? 'Update Case' : 'Save New Case')}
      </StyledButton>
    </div>
  );
}

export default CreateCaseForm;
