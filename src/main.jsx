import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import HebiSnake from './HebiSnake.jsx'
import InstallPrompt from './InstallPrompt.jsx'
import './index.css'

// autoUpdate : le nouveau service worker prend la main dès qu'il est prêt.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HebiSnake />
    <InstallPrompt />
  </StrictMode>,
)
