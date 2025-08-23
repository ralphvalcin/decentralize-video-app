import { useEffect, useState, Suspense, lazy } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Lazy load heavy components for better performance
const Room = lazy(() => import('./components/Room'));
const Home = lazy(() => import('./components/Home'));

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
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="/" element={<Home />} />
          </Routes>
        </Suspense>
      </Router>
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

export default App;