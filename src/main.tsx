import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import { WorkspaceProvider } from '@/lib/workspace'
import { App } from './app'
import './styles.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><WorkspaceProvider><App/></WorkspaceProvider><Toaster richColors position="bottom-right"/></BrowserRouter></React.StrictMode>)
