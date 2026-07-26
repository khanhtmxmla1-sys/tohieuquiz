import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MathJaxContext } from 'better-react-mathjax';
import App from './App';
import MathRenderTelemetryObserver from './src/components/common/MathRenderTelemetryObserver';
import { installChunkRecovery } from './src/utils/chunkRecovery';
import { cleanupLegacyAuthStorage } from './src/services/api/auth';
import { mathJaxConfig } from './src/config/mathJaxConfig';

cleanupLegacyAuthStorage();
installChunkRecovery();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <MathJaxContext config={mathJaxConfig}>
        <MathRenderTelemetryObserver />
        <App />
      </MathJaxContext>
    </BrowserRouter>
  </React.StrictMode>
);