import React from 'react'
import ReactDOM from 'react-dom/client'
// Initialize Sentry (no-op without VITE_SENTRY_DSN) BEFORE the app renders,
// so early errors in App init are also captured.
import './lib/sentry'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
