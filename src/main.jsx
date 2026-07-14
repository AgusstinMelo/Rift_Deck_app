import React from 'react'
import ReactDOM, { hydrateRoot } from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const root = document.getElementById('root');
const app = <App />;

if (root.dataset.prerendered === 'true') {
  hydrateRoot(root, app);
} else {
  ReactDOM.createRoot(root).render(app);
}
