const COLORS = ['#222222', '#ff4444', '#4a9eff', '#22cc22'] as const

interface WhiteboardToolbarProps {
  currentTool: 'pen' | 'eraser'
  currentColor: string
  onToolChange: (tool: 'pen' | 'eraser') => void
  onColorChange: (color: string) => void
  onClear: () => void
}

export function WhiteboardToolbar({
  currentTool,
  currentColor,
  onToolChange,
  onColorChange,
  onClear,
}: WhiteboardToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-raised)] border-b border-[var(--border-subtle)]">
      <button
        data-testid="btn-tool-pen"
        aria-pressed={currentTool === 'pen'}
        aria-label="Pen"
        onClick={() => onToolChange('pen')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          currentTool === 'pen'
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        ✏️ Pen
      </button>

      <button
        data-testid="btn-tool-eraser"
        aria-pressed={currentTool === 'eraser'}
        aria-label="Eraser"
        onClick={() => onToolChange('eraser')}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          currentTool === 'eraser'
            ? 'bg-[var(--accent-primary)] text-white'
            : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        🧹 Eraser
      </button>

      <div className="w-px h-6 bg-[var(--border-subtle)]" />

      <div className="flex items-center gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            data-testid={`btn-color-${color}`}
            aria-label={`Color ${color}`}
            onClick={() => onColorChange(color)}
            style={{ background: color }}
            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
              currentColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--surface-raised)]' : ''
            }`}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-[var(--border-subtle)]" />

      <button
        data-testid="btn-clear"
        aria-label="Clear canvas"
        onClick={onClear}
        className="px-3 py-1.5 rounded text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
      >
        Clear
      </button>
    </div>
  )
}
