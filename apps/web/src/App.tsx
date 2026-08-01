import { AppProviders } from '@/app/providers';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { AppRouter } from '@/app/router';

export default function App() {
  return (
    <AuthProvider>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AuthProvider>
  );
}
