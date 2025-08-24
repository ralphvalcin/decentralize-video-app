import { useEffect, useRef } from 'react';

const SidePanel = ({ 
  isOpen, 
  onToggle, 
  title, 
  children, 
  icon,
  position = 'right', // 'right' or 'left'
  width = 'w-60 md:w-72', // Smaller default width for stacking
  zIndex = 'z-40',
  stackPosition = 0, // Position in the stack (0 = rightmost)
  totalOpenPanels = 1 // Total number of open panels
}) => {
  const inputRef = useRef(null);

   
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Adjust width based on number of open panels
  const getAdjustedWidth = () => {
    if (totalOpenPanels === 1) return 'w-80 md:w-96'; // Full width when alone
    return 'w-60 md:w-72'; // Compact width when stacked
  };

  // Calculate right position for stacking
  const getRightPosition = () => {
    if (position !== 'right' || !isOpen) return position === 'right' ? '0px' : undefined;
    
    const baseWidth = totalOpenPanels === 1 ? 320 : 240; // Adjust based on panel width
    const mdWidth = totalOpenPanels === 1 ? 384 : 288;
    
    return `${stackPosition * baseWidth}px`;
  };

  const widthClasses = getAdjustedWidth();
  const rightPos = getRightPosition();

  return (
    <div 
      className={`fixed top-16 bottom-20 bg-slate-900 border-l border-slate-700 transition-all duration-300 ease-in-out ${zIndex} ${
        isOpen ? widthClasses : 'w-0'
      } overflow-hidden flex flex-col`}
      style={{
        right: rightPos,
        zIndex: 40 - stackPosition // Higher z-index for panels closer to the edge
      }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            {typeof title === 'string' ? (
              <>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
              </>
            ) : (
              title
            )}
          </div>
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900">
        {children}
      </div>
    </div>
  );
};

export default SidePanel;
