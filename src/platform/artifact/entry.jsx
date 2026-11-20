import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../ui/App.jsx';
import { createArtifactPlatform } from './platform.js';

const el = document.getElementById('ht-root');
createArtifactPlatform().then((platform) => {
  createRoot(el).render(<App platform={platform} />);
}).catch((e) => {
  el.textContent = 'Health Track could not start: ' + (e?.message || e);
});
