import React, { useState, useEffect } from 'react';
import SnippetForm from './SnippetForm';
import SnippetList from './SnippetList';
import Notification from './Notification';
import Tabs, { Tab } from './Tabs';
import SettingsTab from './SettingsTab';
import CaseOpener from './CaseOpener'; // Import CaseOpener component
import type { Snippet } from './SnippetList';

// Define notification state structure
interface NotificationState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

function App() {
  // State to hold the snippets, initialized from localStorage if available
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    const savedSnippets = localStorage.getItem('codeNexusSnippets');
    return savedSnippets ? JSON.parse(savedSnippets) : [];
  });
  // State for the search term
  const [searchTerm, setSearchTerm] = useState('');
  // State for the notification
  const [notification, setNotification] = useState<NotificationState>({ show: false, message: '', type: 'success' });

  // Effect to save snippets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('codeNexusSnippets', JSON.stringify(snippets));
  }, [snippets]);

  const addSnippet = (title: string, code: string, language: string) => {
    const newSnippet: Snippet = {
      id: Date.now(), // Simple unique ID using timestamp
      title,
      code,
      language,
    };
    setSnippets(prevSnippets => [...prevSnippets, newSnippet]);
  };

  const deleteSnippet = (id: number) => {
    setSnippets(prevSnippets => prevSnippets.filter(snippet => snippet.id !== id));
  };

  // Function to clear all snippets
  const clearAllSnippets = () => {
    setSnippets([]); // Clear state
    // localStorage will be updated by the useEffect hook watching 'snippets'
  };

  // Filter snippets based on search term (case-insensitive)
  const filteredSnippets = snippets.filter(snippet =>
    snippet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.language.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to show a notification
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ show: true, message, type });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px' }}>
      {/* Render Notification if show is true */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}

      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--accent)', paddingBottom: '5px' }}>
          Cline Code Nexus
        </h1>
        <p style={{ color: 'var(--secondary-text)', marginTop: '5px' }}>Your Personal Code Snippet Manager</p>
      </header>

      {/* Use Tabs component */}
      <Tabs>
        <Tab label="Snippets">
          <main> {/* Keep main semantic tag inside the tab content */}
            <SnippetForm onAddSnippet={addSnippet} />
            <hr className="cs-hr" style={{ margin: '20px 0' }} />
            {/* Add Search Input */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="search-snippets" className="cs-input__label" style={{ display: 'block', marginBottom: '5px' }}>Search Snippets:</label>
          <input
            type="text"
            id="search-snippets"
            placeholder="Search by title or language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cs-input"
            style={{ width: '100%' }}
              />
            </div>
            {/* Pass filtered snippets and notification handler to the list */}
            <SnippetList
              snippets={filteredSnippets}
              onDeleteSnippet={deleteSnippet}
              onShowNotification={showNotification}
            />
          </main>
        </Tab>
        <Tab label="Settings">
          <SettingsTab
            snippets={snippets}
            onClearAllSnippets={clearAllSnippets}
            onShowNotification={showNotification}
          />
        </Tab>
        <Tab label="Case Opener">
          <CaseOpener />
        </Tab>
      </Tabs>

      <footer style={{ marginTop: '30px', textAlign: 'center', fontSize: '0.9em', color: 'var(--text-3)' }}>
        <p>&copy; {new Date().getFullYear()} Cline Code Nexus. Built with Bun, React, and TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;
