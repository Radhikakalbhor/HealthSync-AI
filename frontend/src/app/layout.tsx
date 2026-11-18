import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'HealthSync AI – Personal Medical Record & Prescription Manager',
  description:
    'Your Health. Connected. Intelligent. Organized. An AI-powered medical record management platform organizing prescriptions, lab reports, and clinical documents into a unified patient timeline.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full flex flex-col bg-slate-50 text-navy-900 antialiased">
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
