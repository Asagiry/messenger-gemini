import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { WebSocketProvider } from './context/WebSocketContext'
import { PreferencesProvider } from './context/PreferencesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PreferencesProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </PreferencesProvider>
    </AuthProvider>
  </StrictMode>,
)
