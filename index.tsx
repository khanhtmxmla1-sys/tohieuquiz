import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MathJaxContext } from 'better-react-mathjax';
import App from './App';
import MathRenderTelemetryObserver from './src/components/common/MathRenderTelemetryObserver';
import { installChunkRecovery } from './src/utils/chunkRecovery';
import { cleanupLegacyAuthStorage } from './src/services/api/auth';
import {
  MATHJAX_LOCAL_SRC,
  MATHJAX_VERSION,
  mathJaxConfig,
} from './src/config/mathJaxConfig';
import { installWebVitalsTelemetry } from './src/observability/webVitals';

cleanupLegacyAuthStorage();
installChunkRecovery();
installWebVitalsTelemetry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <MathJaxContext
        version={MATHJAX_VERSION}
        src={MATHJAX_LOCAL_SRC}
        config={mathJaxConfig}
      >
        <MathRenderTelemetryObserver />
        <App />
      </MathJaxContext>
    </BrowserRouter>
  </React.StrictMode>
);