'use client';

import TimesheetMatrix from '@/components/TimesheetMatrix';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Timesheet Tracker</h1>
          <p className="text-muted-foreground mt-2">Track your consulting hours efficiently</p>
        </div>
        <TimesheetMatrix />
      </main>
    </div>
  );
}
