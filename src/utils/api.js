import axios from 'axios';

// IMPORTANT: API_URL already includes the '/api' prefix
// so we SHOULD NOT include '/api' in our endpoint paths in the code
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Create a centralized axios instance with default configuration
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add debug logging for API calls
api.interceptors.request.use(config => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// Add a request interceptor to set auth token
api.interceptors.request.use(
  config => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return config;
    }
  },
  error => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with improved error handling
api.interceptors.response.use(
  response => {
    return response;
  }, 
  error => {
    // Don't log cancellation errors as they're often intentional
    if (axios.isCancel(error)) {
      console.log('Request canceled:', error.message);
      return Promise.reject(error);
    }
    
    // Handle 431 Request Header Too Large errors
    if (error.response?.status === 431) {
      console.error('Header too large error (431). Clearing localStorage to reduce header size.');
      
      try {
        // Get user ID if available
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user._id;
        
        // Clear non-essential storage that could be causing large headers
        if (userId) {
          localStorage.removeItem(`local-projects-${userId}`);
        }
        
        // Retry the request with minimal headers
        if (error.config) {
          console.log('Retrying request with minimal headers');
          
          // Clone the config but use only essential headers
          const retryConfig = {
            ...error.config,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': error.config.headers?.Authorization
            }
          };
          
          // Return the retry request
          return axios(retryConfig);
        }
      } catch (e) {
        console.error('Error handling 431:', e);
      }
    }
    
    // Special handling for 400 errors to projects endpoint
    if (error.response?.status === 400 && 
        error.config?.url?.includes('/projects') &&
        error.config?.method === 'post') {
      
      console.log('Project creation error:', error.response?.data?.message);
      
      // Let the component handle this specially
      return Promise.reject(error);
    }
    // Check for project limit error (special handling)
    else if (error.response?.status === 400 && 
        error.response?.data?.message === 'You can have a maximum of 4 projects') {
      console.log('Project limit reached - this will be handled by the component');
    }
    // Add detailed logging
    else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`API Error [${error.response.status}]:`, error.response.data);
      
      // Handle authentication errors
      if (error.response.status === 401) {
        console.warn('Authentication error detected, redirecting to login...');
        // Clear any auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // If not already on login page, redirect there
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network error - no response received:', error.request);
    } else if (error.name === 'AbortError' || error.name === 'CanceledError') {
      // Handle aborted requests without excessive logging
      console.log('Request was aborted:', error.message);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    // Let the calling code handle specific errors
    return Promise.reject(error);
  }
);

// Helper function to check API health
export const checkApiHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data.status === 'ok';
  } catch (error) {
    if (!axios.isCancel(error)) {
      console.error('API health check failed:', error);
    }
    return false;
  }
};

// Add a new debounce utility at the bottom of the file
// Debounce function to prevent excessive API calls
export const debounce = (func, wait) => {
  let timeout;
  
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
};

// Rate limiter for API calls
const pendingRequests = {};

export const throttledRequest = async (key, requestFn, timeout = 2000) => {
  // If there's a pending request with this key and it's not expired, return it
  if (pendingRequests[key] && pendingRequests[key].timestamp > Date.now() - timeout) {
    console.log(`Using cached request for ${key}`);
    return pendingRequests[key].promise;
  }
  
  // Create a new request
  console.log(`Creating new request for ${key}`);
  const requestPromise = requestFn();
  
  // Store it
  pendingRequests[key] = {
    promise: requestPromise,
    timestamp: Date.now()
  };
  
  // Clean up after it resolves
  requestPromise.finally(() => {
    // Keep it in cache for the timeout period
    setTimeout(() => {
      delete pendingRequests[key];
    }, timeout);
  });
  
  return requestPromise;
};

export default api; 