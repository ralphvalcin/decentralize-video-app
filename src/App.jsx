import { useEffect, useState } from 'react';
import Room from './components/Room';
import toast from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home'; // Create a Home component

function App() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;