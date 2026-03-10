import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// STARKNET ADDED: Importing our custom Starknet config wrapper
import { StarknetProvider } from "./starknetProvider.jsx"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* STARKNET ADDED: Wrapping the entire app to give all components access to the blockchain */}
    <StarknetProvider>
      <App />
    </StarknetProvider>
  </StrictMode>,
)