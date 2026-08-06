import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './app/routes';
import { ThemeProvider } from './providers/theme-provider';
import { AuthProvider } from './providers/auth-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
