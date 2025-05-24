import * as React from 'react';
import { useChat } from '@/lib/chat-context';

interface ContextMenuOptions {
  data: any;
  type: 'widget' | 'table-row' | 'text' | 'chart';
  description?: string;
}

export function useContextMenu(options: ContextMenuOptions) {
  const { openChat } = useChat();
  const elementRef = React.useRef<HTMLElement>(null);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let hoverTimeout: NodeJS.Timeout;

    const handleMouseEnter = (e: MouseEvent) => {
      hoverTimeout = setTimeout(() => {
        setShowTooltip(true);
        const rect = element.getBoundingClientRect();
        setTooltipPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10
        });
      }, 500);
    };

    const handleMouseLeave = () => {
      clearTimeout(hoverTimeout);
      setShowTooltip(false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      
      let contextData = '';
      
      if (options.type === 'widget') {
        // For widget data, format it as key-value pairs
        contextData = `Context from ${options.description || 'Widget'}:\n`;
        for (const [key, value] of Object.entries(options.data)) {
          contextData += `${key}: ${value}\n`;
        }
      } else if (options.type === 'chart') {
        // For charts, extract data points
        contextData = `Context from ${options.description || 'Chart'}:\n`;
        if (Array.isArray(options.data)) {
          // If data is an array of data points
          contextData += 'Data points:\n';
          options.data.forEach((point: any, index: number) => {
            contextData += `- ${JSON.stringify(point)}\n`;
          });
        } else if (options.data.datasets && Array.isArray(options.data.datasets)) {
          // If it's a chart.js style data structure
          contextData += 'Chart datasets:\n';
          options.data.datasets.forEach((dataset: any) => {
            contextData += `${dataset.label || 'Dataset'}:\n`;
            if (dataset.data && Array.isArray(dataset.data)) {
              dataset.data.forEach((value: any, idx: number) => {
                const label = options.data.labels?.[idx] || `Point ${idx + 1}`;
                contextData += `  ${label}: ${value}\n`;
              });
            }
          });
        } else {
          // Fallback to JSON
          contextData += JSON.stringify(options.data, null, 2);
        }
      } else if (options.type === 'table-row') {
        // For table rows
        contextData = `Context from table row:\n`;
        for (const [key, value] of Object.entries(options.data)) {
          contextData += `${key}: ${value}\n`;
        }
      } else {
        // For text or other types
        contextData = `Context: ${options.data}`;
      }
      
      // Open chat and add context
      openChat('sidebar');
      
      // Wait a bit for chat to open, then add context
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('addChatContext', { 
          detail: { context: contextData } 
        }));
      }, 300);
      
      setShowTooltip(false);
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('contextmenu', handleContextMenu);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('contextmenu', handleContextMenu);
      clearTimeout(hoverTimeout);
    };
  }, [options, openChat]);

  // Render tooltip
  React.useEffect(() => {
    if (!showTooltip) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'fixed z-50 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md pointer-events-none';
    tooltip.style.left = `${tooltipPosition.x}px`;
    tooltip.style.top = `${tooltipPosition.y}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.textContent = 'Right-click to use as context';
    
    document.body.appendChild(tooltip);

    return () => {
      if (tooltip.parentNode) {
        document.body.removeChild(tooltip);
      }
    };
  }, [showTooltip, tooltipPosition]);

  return { ref: elementRef };
} 