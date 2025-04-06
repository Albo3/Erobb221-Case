import React, { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react'; // Use type-only imports
import StyledButton from './StyledButton';

// Define structure for Item Template data received from backend
interface ItemTemplate {
    id: number;
    base_name: string;
    image_path: string | null;
    sound_path: string | null;
    rules_text: string | null;
    created_at: string;
}

function ItemTemplateManager() {
    const [templates, setTemplates] = useState<ItemTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Start loading initially
    const [error, setError] = useState<string | null>(null);

    // State for the create template form
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateImageFile, setNewTemplateImageFile] = useState<File | null>(null);
    const [newTemplateSoundFile, setNewTemplateSoundFile] = useState<File | null>(null);
    const [newTemplateRulesText, setNewTemplateRulesText] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Function to fetch item templates
    const fetchItemTemplates = () => {
        setIsLoading(true);
        setError(null);
        fetch('http://localhost:3001/api/item-templates') // Use new endpoint
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then((data: ItemTemplate[]) => {
                setTemplates(data);
            })
            .catch(err => {
                console.error("Error fetching item templates:", err);
                setError(`Failed to load item templates: ${err.message}`);
                setTemplates([]); // Clear templates on error
            })
            .finally(() => setIsLoading(false));
    };

    // Fetch templates on mount
    useEffect(() => {
        fetchItemTemplates();
    }, []);

    // Handle file input changes
    const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewTemplateImageFile(event.target.files?.[0] ?? null);
    };
    const handleSoundFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewTemplateSoundFile(event.target.files?.[0] ?? null);
    };

    // Handle template creation submission
    const handleCreateTemplate = (event: FormEvent) => {
        event.preventDefault();
        if (!newTemplateName.trim()) {
            alert('Please enter a base name for the item template.');
            return;
        }

        const formData = new FormData();
        formData.append('base_name', newTemplateName.trim());

        // Append files and text only if they exist/are provided
        if (newTemplateImageFile) {
            formData.append('image_file', newTemplateImageFile);
        }
        if (newTemplateSoundFile) {
            formData.append('sound_file', newTemplateSoundFile);
        }
        if (newTemplateRulesText.trim()) {
            formData.append('rules_text', newTemplateRulesText.trim());
        }

        setIsUploading(true);
        setError(null);

        fetch('http://localhost:3001/api/item-templates', { // Use new endpoint
            method: 'POST',
            body: formData,
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
            alert(`Item Template "${newTemplateName}" created successfully!`);
            // Reset form
            setNewTemplateName('');
            setNewTemplateImageFile(null);
            setNewTemplateSoundFile(null);
            setNewTemplateRulesText('');
            // TODO: Clear file inputs visually if possible (might need refs or key change)
            // Refetch templates
            fetchItemTemplates();
        })
        .catch(err => {
            console.error("Error creating item template:", err);
            setError(`Failed to create template: ${err.message}`);
        })
        .finally(() => setIsUploading(false));
    };

    return (
        <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '5px' }}>
            <h2>Item Template Manager</h2>
            <hr className="cs-hr" style={{ margin: '15px 0' }} />

            {/* Create Template Form */}
            <form onSubmit={handleCreateTemplate} style={{ marginBottom: '20px', padding: '15px', border: '1px dashed var(--border-color)' }}>
                <h3>Create New Item Template</h3>
                {error && <p style={{ color: 'red' }}>Error: {error}</p>}
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="templateName" style={{ display: 'block', marginBottom: '3px' }}>Base Name:</label>
                    <input
                        type="text"
                        id="templateName"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g., AK-47 | Redline"
                        className="cs-input"
                        required
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="templateImage" style={{ display: 'block', marginBottom: '3px' }}>Image File (Optional):</label>
                    <input
                        type="file"
                        id="templateImage"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="cs-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="templateSound" style={{ display: 'block', marginBottom: '3px' }}>Sound File (Optional):</label>
                    <input
                        type="file"
                        id="templateSound"
                        accept="audio/*"
                        onChange={handleSoundFileChange}
                        className="cs-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label htmlFor="templateRules" style={{ display: 'block', marginBottom: '3px' }}>Rules Text (Optional):</label>
                    <textarea
                        id="templateRules"
                        value={newTemplateRulesText}
                        onChange={(e) => setNewTemplateRulesText(e.target.value)}
                        placeholder="Enter optional rules text..."
                        className="cs-input"
                        style={{ width: '100%', minHeight: '60px' }}
                    />
                </div>

                <StyledButton type="submit" disabled={isUploading} style={{ marginTop: '10px' }}>
                    {isUploading ? 'Creating...' : 'Create Template'}
                </StyledButton>
            </form>

            <h3>Existing Item Templates</h3>
            {isLoading && <p>Loading templates...</p>}
            {/* Display fetch error if any */}
            {!isLoading && error && <p style={{ color: 'red' }}>Error loading templates: {error}</p>}
            {!isLoading && !error && templates.length === 0 && <p>No item templates created yet.</p>}

            {/* Display list of templates */}
            {!isLoading && templates.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '3px' }}>
                    {templates.map(template => (
                        <li key={template.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <strong>{template.base_name}</strong> <span style={{ fontSize: '0.8em', color: 'var(--secondary-text)' }}>(ID: {template.id})</span>
                                    <br />
                                    <small style={{ wordBreak: 'break-all' }}>
                                        Image: {template.image_path ?? 'None'} <br />
                                        Sound: {template.sound_path ?? 'None'} <br />
                                        Rules: {template.rules_text ? (template.rules_text.length > 40 ? template.rules_text.substring(0, 40) + '...' : template.rules_text) : 'None'}
                                    </small>
                                    <br />
                                    <small>Created: {new Date(template.created_at).toLocaleString()}</small>
                                </div>
                                {/* Optional: Add preview/delete later */}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ItemTemplateManager;
