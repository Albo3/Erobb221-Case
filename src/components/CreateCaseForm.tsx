import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getApiUrl } from '../config';
import type { ChangeEvent, FormEvent } from 'react'; // Add FormEvent
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
    items: Array<{
        item_template_id: number;
        override_name: string | null;
        color: string;
    }>;
    image_path: string | null; // Add image_path to the case data
}

// Define structure for existing asset paths (only need images for cases)
interface ExistingAssets {
    images: string[];
    // sounds: string[]; // Not needed for cases
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
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([]);

  // State for case image handling
  const [caseImageFile, setCaseImageFile] = useState<File | null>(null);
  const [selectedExistingCaseImagePath, setSelectedExistingCaseImagePath] = useState<string>('');
  const [clearExistingCaseImage, setClearExistingCaseImage] = useState(false);
  const [existingImagePaths, setExistingImagePaths] = useState<string[]>([]); // From templates/assets endpoint
  const caseImageInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  // State for loading/error/editing
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [isLoadingExistingAssets, setIsLoadingExistingAssets] = useState(true); // Loading state for assets
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [editingCaseOriginalImagePath, setEditingCaseOriginalImagePath] = useState<string | null>(null); // Store original path when editing

  // Fetch available item templates, cases, and existing assets on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoadingTemplates(true);
        setIsLoadingCases(true);
        setIsLoadingExistingAssets(true);
        setError(null);
        try {
            // Fetch Templates
            const templatesPromise = fetch(getApiUrl('/api/item-templates'))
                .then(res => { if (!res.ok) throw new Error(`Templates fetch failed: ${res.status}`); return res.json(); })
                .then((data: ItemTemplate[]) => setAvailableTemplates(data));

            // Fetch Cases
            const casesPromise = fetch(getApiUrl('/api/cases'))
                .then(res => { if (!res.ok) throw new Error(`Cases fetch failed: ${res.status}`); return res.json(); })
                .then((data: CaseInfo[]) => setAvailableCases(data));

            // Fetch Existing Assets (Images)
            const assetsPromise = fetch(getApiUrl('/api/existing-assets'))
                .then(res => { if (!res.ok) throw new Error(`Assets fetch failed: ${res.status}`); return res.json(); })
                .then((data: ExistingAssets) => setExistingImagePaths(data.images || []));

            await Promise.all([templatesPromise, casesPromise, assetsPromise]);

        } catch (err) {
            console.error(`Error fetching initial data:`, err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during initial load');
            setAvailableTemplates([]);
            setAvailableCases([]);
            setExistingImagePaths([]);
        } finally {
            setIsLoadingTemplates(false);
            setIsLoadingCases(false);
            setIsLoadingExistingAssets(false);
        }
    };
    fetchInitialData();
  }, []);

  // Fetch full case details when editingCaseId changes
  useEffect(() => {
      if (editingCaseId === null) {
          // Reset form if we stop editing (or are creating new)
          setCaseName('');
          setCaseDescription('');
          setItems([{ id: Date.now(), item_template_id: null, override_name: '', color: RARITY_COLORS[0]?.value ?? '#b0c3d9' }]);
          // Reset image state as well
          setCaseImageFile(null);
          setSelectedExistingCaseImagePath('');
          setClearExistingCaseImage(false);
          setEditingCaseOriginalImagePath(null);
          if (caseImageInputRef.current) caseImageInputRef.current.value = '';
          return;
      }

      // Fetch details for the selected case
      const fetchCaseDetails = async () => {
          setIsLoadingCases(true); // Indicate loading case details
          setError(null);
          try {
              const response = await fetch(getApiUrl(`/api/cases/${editingCaseId}`));
              if (!response.ok) {
                   let errorMsg = `HTTP error! status: ${response.status}`;
                   try { const errData = await response.json(); errorMsg = errData.error || errorMsg; } catch(e){}
                   throw new Error(errorMsg);
              }
              const data: FullCaseData = await response.json();

              // Populate form state
              setCaseName(data.name);
              setCaseDescription(data.description ?? '');
              setEditingCaseOriginalImagePath(data.image_path); // Store original image path
              // Reset image inputs/selections when starting edit
              setCaseImageFile(null);
              setSelectedExistingCaseImagePath('');
              setClearExistingCaseImage(false);
              if (caseImageInputRef.current) caseImageInputRef.current.value = '';
              // Map fetched items
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


  // --- Image Handling Functions ---
  const handleCaseImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCaseImageFile(file);
    if (file) { // Clear existing selection if new file chosen
        setSelectedExistingCaseImagePath('');
        setClearExistingCaseImage(false); // Uncheck clear if new file added
    }
  };

  const handleExistingCaseImageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const path = event.target.value;
    setSelectedExistingCaseImagePath(path);
    if (path) { // Clear file input if existing selected
        setCaseImageFile(null);
        if (caseImageInputRef.current) caseImageInputRef.current.value = '';
        setClearExistingCaseImage(false); // Uncheck clear
    }
  };

  const handleClearCaseImageToggle = (event: ChangeEvent<HTMLInputElement>) => {
      const isChecked = event.target.checked;
      setClearExistingCaseImage(isChecked);
      if (isChecked) { // Clear file/selection if clear is checked
          setCaseImageFile(null);
          setSelectedExistingCaseImagePath('');
          if (caseImageInputRef.current) caseImageInputRef.current.value = '';
      }
  };

  // Determine current preview path for case image
  const caseImagePreviewPath = useMemo(() => {
      if (clearExistingCaseImage) return null; // No preview if clearing
      if (caseImageFile) return URL.createObjectURL(caseImageFile); // Preview new file
      if (selectedExistingCaseImagePath) return getApiUrl(selectedExistingCaseImagePath); // Preview selected existing
      if (editingCaseOriginalImagePath) return getApiUrl(editingCaseOriginalImagePath); // Preview original editing image
      return null; // Otherwise no preview
  }, [caseImageFile, selectedExistingCaseImagePath, editingCaseOriginalImagePath, clearExistingCaseImage]);

  // Cleanup object URLs
  useEffect(() => {
      let imageUrl = caseImageFile ? URL.createObjectURL(caseImageFile) : null;
      return () => {
          if (imageUrl) URL.revokeObjectURL(imageUrl);
      };
  }, [caseImageFile]);
  // --- End Image Handling ---


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

    // Prepare FormData
    const formData = new FormData();
    formData.append('name', caseName.trim());
    if (caseDescription.trim()) {
        formData.append('description', caseDescription.trim());
    }

    // Append items as JSON string
    const itemsPayload = validItems.map(({ item_template_id, override_name, color }) => ({
        item_template_id: item_template_id,
        override_name: override_name.trim() || null,
        color: color.trim(),
    }));
    formData.append('items', JSON.stringify(itemsPayload));

    // Append image data
    if (caseImageFile) {
        formData.append('image_file', caseImageFile);
    } else if (selectedExistingCaseImagePath) {
        formData.append('existing_image_path', selectedExistingCaseImagePath);
    }

    // Append clear flag if editing
    if (editingCaseId !== null && clearExistingCaseImage) {
        formData.append('clear_image', 'true');
    }


    // Determine URL and Method
    const url = editingCaseId
        ? getApiUrl(`/api/cases/${editingCaseId}`)
        : getApiUrl('/api/cases');
    const method = editingCaseId ? 'PUT' : 'POST';

    setIsSaving(true);
    setError(null);

    // --- Send FormData to backend API ---
    fetch(url, {
      method: method,
      // No 'Content-Type' header needed for FormData, browser sets it
      body: formData,
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
      alert(`Case "${caseName.trim()}" ${editingCaseId ? 'updated' : 'created'} successfully!`); // Use name from state
      // Reset form and editing state
      setEditingCaseId(null); // This will trigger the useEffect to reset the form
      // Refetch case list
       setIsLoadingCases(true); // Keep loading state for cases
       fetch(getApiUrl('/api/cases'))
         .then(res => res.ok ? res.json() : Promise.reject(`Failed to refetch cases: ${res.status}`))
         .then(setAvailableCases) // Update available cases list
         .catch(err => {
             console.error("Failed to refetch cases list:", err);
             setError(err instanceof Error ? err.message : 'Failed to refetch cases list');
         })
         .finally(() => setIsLoadingCases(false)); // Ensure loading state is cleared
    })
    .catch(error => {
      console.error(`Error ${editingCaseId ? 'updating' : 'saving'} case:`, error);
      alert(`Error ${editingCaseId ? 'updating' : 'saving'} case: ${error.message}`);
      setError(error.message); // Show error to user
    })
    .finally(() => setIsSaving(false));
  };

  // Function to handle deleting a case
  const handleDeleteCase = () => {
      if (editingCaseId === null) {
          alert("No case selected to delete.");
          return;
      }

      if (!window.confirm(`Are you sure you want to delete case "${caseName}" (ID: ${editingCaseId})? This action cannot be undone.`)) {
          return;
      }

      setIsSaving(true); // Use the same saving state to disable buttons
      setError(null);

      fetch(getApiUrl(`/api/cases/${editingCaseId}`), {
          method: 'DELETE',
      })
      .then(async response => {
          if (!response.ok) {
              let errorMsg = `HTTP error! status: ${response.status}`;
              try { const errData = await response.json(); errorMsg = errData.error || errorMsg; }
              catch (e) { /* Ignore */ }
              throw new Error(errorMsg);
          }
          return response.json();
      })
      .then(data => {
          alert(`Case "${caseName}" deleted successfully!`);
          // Reset form and editing state
          setEditingCaseId(null); // This will trigger the useEffect to reset the form
          // Refetch case list
          setIsLoadingCases(true);
          fetch(getApiUrl('/api/cases'))
              .then(res => res.ok ? res.json() : Promise.reject(`Failed to refetch cases: ${res.status}`))
              .then(setAvailableCases)
              .catch(err => {
                  console.error("Failed to refetch cases list after delete:", err);
                  setError(err instanceof Error ? err.message : 'Failed to refetch cases list');
              })
              .finally(() => setIsLoadingCases(false));
      })
      .catch(error => {
          console.error(`Error deleting case ${editingCaseId}:`, error);
          alert(`Error deleting case: ${error.message}`);
          setError(error.message);
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
              <>
                  <StyledButton onClick={() => setEditingCaseId(null)} disabled={isSaving} style={{ marginLeft: '10px' }}>
                      Clear Selection (Create New)
                  </StyledButton>
                  {/* Add Delete Button */}
                  <StyledButton
                      onClick={handleDeleteCase}
                      disabled={isSaving}
                      variant="danger" // Use danger variant for delete
                      style={{ marginLeft: '10px' }}
                  >
                      Delete Selected Case
                  </StyledButton>
              </>
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

      {/* Case Image Input Section */}
      <div style={{ marginBottom: '20px', border: '1px solid var(--border-color-2)', padding: '10px', borderRadius: '3px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Case Image (Optional):</label>
          {/* File Upload */}
          <div style={{ marginBottom: '5px' }}>
              <label htmlFor="caseImage" style={{ display: 'block', fontSize: '0.9em', marginBottom: '3px' }}>Upload New:</label>
              <input
                  type="file" id="caseImage" accept="image/*"
                  onChange={handleCaseImageFileChange} ref={caseImageInputRef}
                  className="cs-input" style={{ width: '100%' }}
                  disabled={isSaving || clearExistingCaseImage} // Disable if clearing
              />
          </div>
          {/* OR Separator */}
          <div style={{ textAlign: 'center', margin: '5px 0', fontSize: '0.9em', color: 'var(--secondary-text)' }}>OR</div>
          {/* Existing Path Selection */}
          <div style={{ marginBottom: '5px' }}>
              <label htmlFor="existingCaseImageSelect" style={{ display: 'block', fontSize: '0.9em', marginBottom: '3px' }}>Select Existing:</label>
              <select
                  id="existingCaseImageSelect"
                  value={selectedExistingCaseImagePath}
                  onChange={handleExistingCaseImageChange}
                  disabled={isLoadingExistingAssets || isSaving || !!caseImageFile || clearExistingCaseImage} // Disable if loading, saving, new file selected, or clearing
                  className="cs-input" style={{ width: '100%' }}
              >
                  <option value="">-- Select Existing Image --</option>
                  {existingImagePaths.map(path => {
                      const fullFilename = path.split('/').pop() || '';
                      const firstHyphenIndex = fullFilename.indexOf('-');
                      const displayName = firstHyphenIndex !== -1 ? fullFilename.substring(firstHyphenIndex + 1) : fullFilename;
                      return <option key={path} value={path}>{displayName}</option>;
                  })}
              </select>
          </div>
          {/* Clear Option (only when editing and image exists) */}
          {editingCaseId !== null && editingCaseOriginalImagePath && (
              <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
                  <input type="checkbox" id="clearCaseImage" checked={clearExistingCaseImage} onChange={handleClearCaseImageToggle} />
                  <label htmlFor="clearCaseImage" style={{ marginLeft: '4px' }}>Remove/Clear Image</label>
              </div>
          )}
          {/* Preview */}
          {caseImagePreviewPath && <img src={caseImagePreviewPath} alt="Case Preview" style={{ height: '50px', width: 'auto', border: '1px solid var(--border-color)', marginTop: '5px' }} />}
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
