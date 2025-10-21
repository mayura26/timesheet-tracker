'use client';

import TimesheetMatrix from '@/components/TimesheetMatrix';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Timesheet Tracker</h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Track your consulting hours efficiently</p>
        </div>
        <TimesheetMatrix />
      </main>
    </div>
  );
}
