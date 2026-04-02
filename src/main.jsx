import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './index.css'
import App from './App.jsx'
import { AccountProvider } from '@/providers/account-provider'
import { AuthProvider } from '@/providers/auth-provider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AccountProvider>
          <App />
        </AccountProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
