import { useState, useRef, useEffect } from 'react';

const DraggableWindow = ({ 
  children, 
  title, 
  isOpen, 
  onClose, 
  defaultPosition = { x: 20, y: 80 }, 
  width = 'w-96',
  zIndex = 'z-40'
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const windowRef = useRef(null);

  const handleMouseDown = (e) => {
    // Only allow dragging from the header area
    if (e.target.closest('.drag-handle')) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Boundary constraints
    const windowRect = windowRef.current?.getBoundingClientRect();
    const maxX = window.innerWidth - (windowRect?.width || 384);
    const maxY = window.innerHeight - (windowRect?.height || 400);

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, dragStart, position]);

  // Reset position when window opens
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      setPosition(defaultPosition);
    }
  }, [isOpen, defaultPosition]);

  if (!isOpen) return null;

  return (
    <div
      ref={windowRef}
      className={`fixed ${width} max-w-[calc(100vw-2rem)] card flex flex-col ${zIndex} shadow-hard animate-slide-down ${
        isDragging ? 'shadow-2xl scale-105' : ''
      } transition-transform duration-150`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: 'calc(100vh - 120px)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <div className="drag-handle card-header cursor-grab active:cursor-grabbing">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {title}
          </div>
          <div className="flex items-center gap-2">
            {/* Minimize/Restore Button */}
            <button
              className="btn-ghost p-1 text-gray-400 hover:text-gray-600 text-xs"
              title="Drag to move window"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path d="M10 4a2 2 0 100-4 2 2 0 000 4z" />
                <path d="M10 20a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="btn-ghost p-2 text-gray-400 hover:text-gray-600"
              aria-label="Close window"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>

      {/* Resize Handle (optional visual indicator) */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100">
        <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-gray-300"></div>
        <div className="absolute bottom-2 right-2 w-0 h-0 border-l-2 border-b-2 border-gray-300"></div>
      </div>
    </div>
  );
};

export default DraggableWindow;