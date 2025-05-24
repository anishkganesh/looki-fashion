'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // For static exports, we need to handle client-side routing
    // Redirect to the correct route based on the current path
    if (isClient && typeof window !== 'undefined') {
      const path = window.location.pathname;
      
      // If it's one of our valid routes, navigate to it
      if (path.includes('/login') || path.includes('/signup') || path.includes('/dashboard')) {
        router.replace(path);
      } else {
        // Default to login page for unknown routes
        router.replace('/login');
      }
    }
  }, [router, isClient]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        <p className="text-muted-foreground">Redirecting you to the right page...</p>
      </div>
    </div>
  );
} 