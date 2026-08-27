import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ProvedorApp } from './estado'
import './estilos.css'

const raiz = document.getElementById('raiz')
if (raiz === null) throw new Error('elemento #raiz não encontrado')

createRoot(raiz).render(
  <StrictMode>
    <ProvedorApp>
      <App />
    </ProvedorApp>
  </StrictMode>,
)
