import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DataProvider } from '@/state/DataProvider';
import { AuthGate } from '@/state/AuthGate';
import { App } from './App';
import './index.css';

// Embedded builds (e.g. a sandboxed preview) cannot use URL paths: route in memory.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AuthGate>
        {(repo, key, signOut) => (
          <DataProvider key={key} repository={repo} signOut={signOut}>
            <App />
          </DataProvider>
        )}
      </AuthGate>
    </Router>
  </StrictMode>,
);
