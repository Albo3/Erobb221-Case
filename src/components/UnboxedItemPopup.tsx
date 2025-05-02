import React from 'react';
import { getApiUrl } from '../config';
import './UnboxedItemPopup.css'; // Import the CSS for styling

// Define the CaseItem interface (can be imported from a shared types file later if needed)
interface CaseItem {
  name: string;
  display_color: string;
  percentage_chance: number;
  image_url?: string | null;
  rules?: string | null;
  sound_url?: string | null;
  item_template_id?: number;
}

// Define the props for the popup component
interface UnboxedItemPopupProps {
  item: CaseItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const UnboxedItemPopup: React.FC<UnboxedItemPopupProps> = ({ item, isOpen, onClose }) => {
  // Don't render anything if the popup is not open or there's no item
  if (!isOpen || !item) {
    return null;
  }

  // Stop propagation to prevent clicks inside the modal from closing it
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="popup-overlay" onClick={onClose}> {/* Overlay closes modal on click */}
      <div className="popup-content" onClick={handleContentClick} style={{ borderColor: item.display_color || 'var(--border-color)' }}>
        <button className="popup-close-button" onClick={onClose}>&times;</button>
        <h3 className="popup-title">You unboxed:</h3>
        <p className="popup-item-name" style={{ color: item.display_color || 'white' }}>
          {item.name}
        </p>
        {item.image_url && (
          <img
            src={getApiUrl(item.image_url)}
            alt={item.name}
            className="popup-item-image"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        {/* Optionally display rules if they exist */}
        {item.rules && (
          <div className="popup-item-rules">
            <h4>Rules:</h4>
            <p>{item.rules}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnboxedItemPopup;
