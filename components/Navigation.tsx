'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';

export default function Navigation() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems = [
    { href: '/', label: 'Timesheet', icon: '📊' },
    { href: '/admin', label: 'Projects', icon: '⚙️' },
    { href: '/reports', label: 'Reports', icon: '📈' },
  ];

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                  pathname === item.href
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="ml-4"
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
