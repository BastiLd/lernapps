import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../shared/styles/base.css';
import './app.css';
import { registerPWA } from '../../shared/pwa';
import App from './App';
import { AppProvider } from './state';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

registerPWA();
