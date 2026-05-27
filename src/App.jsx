import { useEffect, useState, Suspense, lazy } from 'react';
import ErrorBoundary from './v2/ui/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const HomeV2 = lazy(() => import('./v2/pages/HomeV2'));
const RoomV2 = lazy(() => import('./v2/pages/RoomV2'));

function App() {
  const [dark, _setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        }>
          <Routes>
            <Route path="/room/:roomId" element={<RoomV2 />} />
            <Route path="/" element={<HomeV2 />} />
          </Routes>
        </Suspense>
      </Router>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
