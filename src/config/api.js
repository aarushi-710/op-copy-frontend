// API Configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5100';

export const API_BASE_URL = BACKEND_URL;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
  },
  OPERATORS: (line) => `${API_BASE_URL}/api/operators/${line}`,
  ATTENDANCE: (line, date) => `${API_BASE_URL}/api/attendance/${line}/${date}`,
  ATTENDANCE_BASE: (line) => `${API_BASE_URL}/api/attendance/${line}`,
};

export default API_BASE_URL; 