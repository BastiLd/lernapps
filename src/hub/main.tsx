import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/styles/base.css';
import './hub.css';
import { registerPWA } from '../shared/pwa';
import Hub from './Hub';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);

registerPWA();
