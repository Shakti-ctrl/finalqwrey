import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export interface WindowState {
  id: string;
  visible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  snapState: 'none' | 'left' | 'right' | 'top' | 'bottom';
  title: string;
  icon?: string;
}

interface WindowManagerContextType {
  windows: { [id: string]: WindowState };
  createWindow: (id: string, initialState: Partial<WindowState>) => void;
  closeWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  getNextZIndex: () => number;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within WindowManagerProvider');
  }
  return context;
};

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [windows, setWindows] = useState<{ [id: string]: WindowState }>({});
  const [maxZIndex, setMaxZIndex] = useState(2000);

  const getNextZIndex = useCallback(() => {
    setMaxZIndex(prev => prev + 1);
    return maxZIndex + 1;
  }, [maxZIndex]);

  const createWindow = useCallback((id: string, initialState: Partial<WindowState>) => {
    setWindows(prev => ({
      ...prev,
      [id]: {
        id,
        visible: true,
        position: { x: 100, y: 100 },
        size: { width: 400, height: 300 },
        zIndex: getNextZIndex(),
        minimized: false,
        maximized: false,
        snapState: 'none',
        title: 'Window',
        ...initialState
      }
    }));
  }, [getNextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], visible: false }
    }));
  }, []);

  const updateWindow = useCallback((id: string, updates: Partial<WindowState>) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], zIndex: getNextZIndex() }
    }));
  }, [getNextZIndex]);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], minimized: true }
    }));
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], maximized: true, minimized: false }
    }));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], maximized: false, minimized: false }
    }));
  }, []);

  return (
    <WindowManagerContext.Provider
      value={{
        windows,
        createWindow,
        closeWindow,
        updateWindow,
        focusWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        getNextZIndex
      }}
    >
      {children}
    </WindowManagerContext.Provider>
  );
};

interface FloatingWindowProps {
  id: string;
  title: string;
  icon?: string;
  children: React.ReactNode;
  onClose?: () => void;
  headerColor?: string;
  borderColor?: string;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
}

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  id,
  title,
  icon,
  children,
  onClose,
  headerColor = 'linear-gradient(45deg, #667eea, #764ba2)',
  borderColor = '#667eea',
  minWidth = 300,
  minHeight = 200,
  resizable = true
}) => {
  const {
    windows,
    updateWindow,
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow
  } = useWindowManager();

  const windowState = windows[id];
  const windowRef = useRef<HTMLDivElement>(null);
  const [, setIsDragging] = useState(false);
  const [, setIsResizing] = useState(false);

  useEffect(() => {
    if (!windowState) {
      console.error(`Window ${id} not found in state`);
    }
  }, [id, windowState]);

  if (!windowState || !windowState.visible) {
    return null;
  }

  if (windowState.minimized) {
    return null;
  }

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (windowState.maximized) return;
    
    // Don't drag if clicking on a button
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    
    setIsDragging(true);
    focusWindow(id);
    
    const isTouch = 'touches' in e;
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startPos = windowState.position;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const newX = startPos.x + (clientX - startX);
      const newY = startPos.y + (clientY - startY);
      
      // Snap to edges
      const snapThreshold = 20;
      let finalX = newX;
      let finalY = newY;
      
      if (newX < snapThreshold) finalX = 0;
      if (newY < snapThreshold) finalY = 0;
      if (newX + windowState.size.width > window.innerWidth - snapThreshold) {
        finalX = window.innerWidth - windowState.size.width;
      }
      if (newY + windowState.size.height > window.innerHeight - snapThreshold) {
        finalY = window.innerHeight - windowState.size.height;
      }
      
      updateWindow(id, {
        position: { x: finalX, y: finalY }
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    if (isTouch) {
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    } else {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (windowState.maximized) return;
    
    setIsResizing(true);
    const isTouch = 'touches' in e;
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startSize = windowState.size;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const newWidth = Math.max(minWidth, startSize.width + (clientX - startX));
      const newHeight = Math.max(minHeight, startSize.height + (clientY - startY));
      
      updateWindow(id, {
        size: { width: newWidth, height: newHeight }
      });
    };

    const handleEnd = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    if (isTouch) {
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    } else {
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }
  };

  const handleClose = () => {
    closeWindow(id);
    if (onClose) onClose();
  };

  const handleMinimize = () => {
    minimizeWindow(id);
  };

  const handleMaximize = () => {
    if (windowState.maximized) {
      restoreWindow(id);
    } else {
      maximizeWindow(id);
    }
  };

  const windowStyle: React.CSSProperties = windowState.maximized
    ? {
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100vw',
        height: '100vh',
        zIndex: windowState.zIndex
      }
    : {
        position: 'fixed',
        left: windowState.position.x,
        top: windowState.position.y,
        width: windowState.size.width,
        height: windowState.size.height,
        zIndex: windowState.zIndex
      };

  return (
    <div
      ref={windowRef}
      style={{
        ...windowStyle,
        background: 'white',
        border: `2px solid ${borderColor}`,
        borderRadius: windowState.maximized ? '0' : '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: minWidth,
        minHeight: minHeight
      }}
      onClick={() => focusWindow(id)}
    >
      {/* Window Header */}
      <div
        style={{
          background: headerColor,
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: windowState.maximized ? 'default' : 'move',
          borderRadius: windowState.maximized ? '0' : '10px 10px 0 0',
          userSelect: 'none',
          touchAction: 'none'
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <span style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <span>{icon}</span>}
          {title}
        </span>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMinimize();
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '8px',
              borderRadius: '6px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation'
            }}
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMaximize();
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '8px',
              borderRadius: '6px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation'
            }}
            title={windowState.maximized ? 'Restore' : 'Maximize'}
          >
            {windowState.maximized ? '❐' : '□'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '8px',
              borderRadius: '6px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation'
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        background: '#f9f9f9'
      }}>
        {children}
      </div>

      {/* Resize Handle */}
      {resizable && !windowState.maximized && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '30px',
            height: '30px',
            background: borderColor,
            cursor: 'nwse-resize',
            borderTopLeftRadius: '4px',
            zIndex: 1,
            touchAction: 'none'
          }}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '0',
            height: '0',
            borderLeft: '12px solid transparent',
            borderBottom: '12px solid white'
          }} />
        </div>
      )}
    </div>
  );
};

export const MinimizedWindowBar: React.FC = () => {
  const { windows, restoreWindow, closeWindow } = useWindowManager();
  
  const minimizedWindows = Object.values(windows).filter(w => w.minimized && w.visible);
  
  if (minimizedWindows.length === 0) {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50px',
      background: 'linear-gradient(135deg, rgba(0, 20, 40, 0.95), rgba(0, 40, 80, 0.9))',
      borderTop: '2px solid rgba(102, 126, 234, 0.5)',
      display: 'flex',
      gap: '10px',
      padding: '5px 10px',
      alignItems: 'center',
      zIndex: 9999,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
    }}>
      {minimizedWindows.map(window => (
        <div
          key={window.id}
          style={{
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          onClick={() => restoreWindow(window.id)}
        >
          {window.icon && <span>{window.icon}</span>}
          <span>{window.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(window.id);
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: 'auto'
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
