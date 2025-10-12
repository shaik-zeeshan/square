import { Toaster as SolidToaster } from 'solid-toast';
import { cn } from '~/lib/utils';

export function Toaster() {
  return (
    <SolidToaster
      position="top-center"
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className: '',
        duration: 5000,
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(0 0 0 / 0.05)',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '420px',
          minWidth: '320px',
        },
      }}
    />
  );
}
