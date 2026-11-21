import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { DEMO } from './lib/supabase';
import { DemoBanner } from './components/DemoBanner';

// A la demo estàtica (GitHub Pages) fem servir rutes amb # perquè no cal configurar el servidor.
const Router = DEMO ? HashRouter : BrowserRouter;
import { SessionProvider } from './lib/session';
import { ToastProvider } from './lib/toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <SessionProvider>
        <ToastProvider>
          <App />
          {DEMO && <DemoBanner />}
        </ToastProvider>
      </SessionProvider>
    </Router>
  </React.StrictMode>,
);
