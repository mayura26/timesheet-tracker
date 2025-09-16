'use client';

import { usePathname } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <Navigation />
      {children}
    </ProtectedRoute>
  );
}
