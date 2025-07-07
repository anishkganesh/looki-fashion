"use client"

import { useEffect } from 'react'

export function ChromeTranslateFix() {
  useEffect(() => {
    // Official workaround from React team for Chrome Translate bug
    // https://github.com/facebook/react/issues/11538#issuecomment-417504600
    
    if (typeof Node === 'function' && Node.prototype) {
      const originalRemoveChild = Node.prototype.removeChild;
      // @ts-ignore - Patching DOM methods for Chrome Translate fix
      Node.prototype.removeChild = function(child: Node) {
        if (child.parentNode !== this) {
          if (console) {
            console.warn('Cannot remove a child from a different parent', child, this);
          }
          return child;
        }
        // @ts-ignore - Arguments are correct for removeChild
        return originalRemoveChild.apply(this, arguments);
      };

      const originalInsertBefore = Node.prototype.insertBefore;
      // @ts-ignore - Patching DOM methods for Chrome Translate fix
      Node.prototype.insertBefore = function(newNode: Node, referenceNode: Node | null) {
        if (referenceNode && referenceNode.parentNode !== this) {
          if (console) {
            console.warn('Cannot insert before a reference node from a different parent', referenceNode, this);
          }
          return newNode;
        }
        // @ts-ignore - Arguments are correct for insertBefore
        return originalInsertBefore.apply(this, arguments);
      };
    }

    // Additional: Suppress console errors for known Chrome translate issues
    const originalError = console.error;
    console.error = (...args) => {
      // Filter out the specific Chrome translate errors
      if (
        args[0]?.toString().includes('removeChild') ||
        args[0]?.toString().includes('insertBefore') ||
        args[0]?.toString().includes('Failed to execute')
      ) {
        // Don't log these errors as they're expected with Chrome translate
        return;
      }
      originalError.apply(console, args);
    };

    // No cleanup needed - these patches should remain for the lifetime of the app
  }, []);

  return null;
} 