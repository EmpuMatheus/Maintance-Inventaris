import { AppProviders } from '@/app/providers';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { AppRouter } from '@/app/router';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export default function App() {
  return (
    <AuthProvider>
      <AppProviders>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </AppProviders>
    </AuthProvider>
  );
}
