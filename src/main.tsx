import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './ui/styles.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/caveat/latin-700.css';
import './ui/simple/simple.css';
import './ui/studio/studio.css';
import { App } from './ui/App';
import { relayTone3000Callback } from './app/tone3000Client';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento root mancante');
// A window that TONE3000 sent back with an OAuth answer only relays it to the page that asked, and closes: the app does not start there.
if (!relayTone3000Callback()) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
