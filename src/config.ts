// Always use relative URLs for production deployment behind proxy
export const API_BASE_URL = '';

// Helper function to construct API URLs
export const getApiUrl = (path: string) => `${API_BASE_URL}${path}`; // Will resolve to just the path, e.g., /api/cases
