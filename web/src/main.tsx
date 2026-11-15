import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/public-sans/wght.css';
import '@fontsource/azeret-mono/400.css';
import '@fontsource/azeret-mono/500.css';
import './sistema/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
