"use client";

import type { ReactNode } from 'react';
import { AppProvider } from '@/contexts/AppContext';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider as NextThemesProvider } from "next-themes";


export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <AppProvider>
        {children}
        <Toaster />
      </AppProvider>
    </NextThemesProvider>
  );
}
