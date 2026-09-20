import { useRoomStore } from './store';
import { logger } from './core/logger';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
  const { token } = useRoomStore.getState();
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  // Generate a Request ID to trace from frontend to backend
  const requestId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  headers.set('X-Request-ID', requestId);

  const startTime = performance.now();
  const method = options.method || 'GET';

  logger.debug(`API_REQUEST_START ${method} ${endpoint}`, { requestId, endpoint, method });

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Our backend now returns structured error objects: { success: false, errorCode: string, message: string }
      const errorMessage = errorData.message || errorData.error || `HTTP Error ${response.status}`;
      
      logger.warn(`API_REQUEST_FAILED ${method} ${endpoint} - ${response.status}`, {
        requestId,
        durationMs: duration,
        status: response.status,
        errorCode: errorData.errorCode,
        errorMessage
      });

      // Handle 401 (expired/invalid token) globally
      if (response.status === 401) {
        const { logout } = useRoomStore.getState();
        if (logout) logout();
      }

      // Throw a structured error that UI components can catch
      const err: any = new Error(errorMessage);
      err.status = response.status;
      err.errorCode = errorData.errorCode;
      err.requestId = requestId;
      throw err;
    }

    const data = await response.json();
    
    logger.debug(`API_REQUEST_SUCCESS ${method} ${endpoint} - 200`, { 
      requestId, 
      durationMs: duration 
    });

    return data;
  } catch (error: any) {
    // If it's a network error (e.g., fetch failed entirely, CORS, offline)
    if (!error.status) {
      logger.error(`API_REQUEST_ERROR ${method} ${endpoint} - NETWORK_FAILURE`, error, { requestId });
    }
    throw error;
  }
};
