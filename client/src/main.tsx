import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { AudioProvider } from './contexts/AudioProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logger } from './core/logger'
import './index.css'

// Global Error Handlers for unhandled exceptions outside React lifecycle
window.onerror = function (msg, url, lineNo, columnNo, error) {
  logger.error('GLOBAL_UNCAUGHT_EXCEPTION', error, {
    msg, url, lineNo, columnNo
  });
  return false;
};

window.onunhandledrejection = function (event) {
  logger.error('UNHANDLED_PROMISE_REJECTION', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AudioProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              duration: 3000,
            }}
          />
        </AudioProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

