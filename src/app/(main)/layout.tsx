import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { APP_NAME } from '@/lib/constants';

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 container max-w-screen-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      {/* Optional Footer can be added here */}
      {/* <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} {APP_NAME}
      </footer> */}
    </div>
  );
}
