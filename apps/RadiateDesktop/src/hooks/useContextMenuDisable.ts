import { useEffect } from 'react';

interface UseContextMenuDisableOptions {
  disableContextMenu?: boolean;
  disableSelection?: boolean;
  disableDragDrop?: boolean;
  disableDevTools?: boolean;
  allowSelectionInInputs?: boolean;
}

export const useContextMenuDisable = (options: UseContextMenuDisableOptions = {}) => {
  const {
    disableContextMenu = true,
    disableSelection = true,
    disableDragDrop = true,
    disableDevTools = true,
    allowSelectionInInputs = true,
  } = options;

  useEffect(() => {
    const eventListeners: Array<{
      element: Document | Window;
      event: string;
      handler: (e: Event) => void;
      useCapture?: boolean;
    }> = [];

    // Disable context menu
    if (disableContextMenu) {
      const disableContextMenuHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      document.addEventListener('contextmenu', disableContextMenuHandler, true);
      eventListeners.push({
        element: document,
        event: 'contextmenu',
        handler: disableContextMenuHandler,
        useCapture: true
      });
    }

    // Disable text selection (except in inputs)
    if (disableSelection) {
      const disableSelectionHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        const allowedTags = ['INPUT', 'TEXTAREA', 'SELECT'];
        const isContentEditable = target.isContentEditable;
        const hasAllowSelectClass = target.classList.contains('allow-select') || 
                                   target.closest('.allow-select');
        
        if (allowSelectionInInputs && 
            (allowedTags.includes(target.tagName) || isContentEditable || hasAllowSelectClass)) {
          return true;
        }
        
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      document.addEventListener('selectstart', disableSelectionHandler, true);
      eventListeners.push({
        element: document,
        event: 'selectstart',
        handler: disableSelectionHandler,
        useCapture: true
      });
    }

    // Disable drag and drop
    if (disableDragDrop) {
      const disableDragStartHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        // Allow drag for file inputs and elements with drag-allowed class
        if ((target as HTMLInputElement).type === 'file' || target.classList.contains('drag-allowed')) {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      const disableDropHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        // Allow drop for elements with drop-allowed class
        if (target.classList.contains('drop-allowed') || target.closest('.drop-allowed')) {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      };

      document.addEventListener('dragstart', disableDragStartHandler, true);
      document.addEventListener('drop', disableDropHandler, true);
      document.addEventListener('dragover', disableDropHandler, true);
      
      eventListeners.push(
        {
          element: document,
          event: 'dragstart',
          handler: disableDragStartHandler,
          useCapture: true
        },
        {
          element: document,
          event: 'drop',
          handler: disableDropHandler,
          useCapture: true
        },
        {
          element: document,
          event: 'dragover',
          handler: disableDropHandler,
          useCapture: true
        }
      );
    }

    // Disable developer tools shortcuts
    if (disableDevTools) {
      const disableDevToolsHandler = (e: KeyboardEvent) => {
        // F12
        if (e.keyCode === 123) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+U (View Source)
        if (e.ctrlKey && e.keyCode === 85) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+Shift+C (Inspect Element)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+Shift+K (Console in Firefox)
        if (e.ctrlKey && e.shiftKey && e.keyCode === 75) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+S (Save page)
        if (e.ctrlKey && e.keyCode === 83) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+P (Print)
        if (e.ctrlKey && e.keyCode === 80) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        
        // Ctrl+A (Select all) - optional, might interfere with normal usage
        // Uncomment if you want to disable select all
        // if (e.ctrlKey && e.keyCode === 65) {
        //   e.preventDefault();
        //   e.stopPropagation();
        //   return false;
        // }
      };

      document.addEventListener('keydown', disableDevToolsHandler, true);
      eventListeners.push({
        element: document,
        event: 'keydown',
        handler: disableDevToolsHandler as (e: Event) => void,
        useCapture: true
      });
    }

    // Cleanup function
    return () => {
      eventListeners.forEach(({ element, event, handler, useCapture }) => {
        element.removeEventListener(event, handler, useCapture);
      });
    };
  }, [disableContextMenu, disableSelection, disableDragDrop, disableDevTools, allowSelectionInInputs]);

  // Return helper functions for manual control
  return {
    disableContextMenuOnElement: (element: HTMLElement) => {
      element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
      });
    },
    
    allowSelectionOnElement: (element: HTMLElement) => {
      element.classList.add('allow-select');
    },
    
    allowDragOnElement: (element: HTMLElement) => {
      element.classList.add('drag-allowed');
    },
    
    allowDropOnElement: (element: HTMLElement) => {
      element.classList.add('drop-allowed');
    }
  };
};

export default useContextMenuDisable;