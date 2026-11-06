import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/styles.css';
import './ui/studio/studio.css';
import { App } from './ui/App';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento root mancante');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
