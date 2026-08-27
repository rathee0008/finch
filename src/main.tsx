import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { restoreFromUrlIfPresent } from './lib/urlRestore'

// If this URL carries a #restore=... payload, write it to localStorage
// before the app's own state loader ever runs.
await restoreFromUrlIfPresent()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
