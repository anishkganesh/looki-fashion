'use client';

import { useEffect, useState } from 'react';

interface HydrationSafeBodyProps {
  children: React.ReactNode;
  className?: string;
}

export default function HydrationSafeBody({ children, className }: HydrationSafeBodyProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // During SSR and initial hydration, render with minimal props
  const bodyProps = isHydrated 
    ? { className, suppressHydrationWarning: true }
    : { className };

  return (
    <div {...bodyProps}>
      {children}
    </div>
  );
} 