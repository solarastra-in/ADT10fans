import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n';
import { capturePendingReferral } from './api';
import './index.css';

capturePendingReferral();

const root = document.getElementById('root')!;
// The server puts a plain-HTML version of the page in #root for search engines; the app replaces it.
root.innerHTML = '';
createRoot(root).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
