import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Fix TypeError: Cannot set property fetch of #<Window> which has only a getter
try {
  const originalFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    value: originalFetch,
    writable: true,
    configurable: true
  });
} catch (e) {
  console.warn('Could not make window.fetch writable', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
