/**
 * App Component with Global State Management Integration
 * This shows how to integrate the global state system into the main App component
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Global State Provider
import { GlobalStateProvider } from './providers/GlobalStateProvider';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import Home from './components/Home';
// import Room from './components/Room'; // Original version
import Room from './components/Room.migration-example'; // Migration example

// Styles
import './index.css';

/**
 * App component with global state management
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Routes>
            {/* Home Route */}
            <Route path="/" element={<Home />} />
            
            {/* Room Route with Global State Provider */}
            <Route
              path="/room/:roomId"
              element={
                <GlobalStateProvider>
                  <RoomWrapper />
                </GlobalStateProvider>
              }
            />
            
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Global Toast Notifications */}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#374151',
                color: '#fff',
                border: '1px solid #4B5563',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
              loading: {
                duration: Infinity,
              },
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

/**
 * Room wrapper component that handles loading and error states
 */
const RoomWrapper: React.FC = () => {
  return (
    <ErrorBoundary>
      <GlobalStateLoadingWrapper>
        <Room />
      </GlobalStateLoadingWrapper>
    </ErrorBoundary>
  );
};

/**
 * Loading wrapper that shows initialization state
 */
const GlobalStateLoadingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This would use the global state context to show loading states
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      {children}
    </React.Suspense>
  );
};

/**
 * Loading screen component
 */
const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          Initializing Video Call
        </h2>
        <p className="text-gray-400">
          Setting up secure peer-to-peer connection...
        </p>
      </div>
    </div>
  );
};

export default App;