import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coff Coff — Find your next favorite coffee shop',
  description:
    'Coff Coff is a cafe review service that helps coffee lovers discover, rate, and share the best local coffee shops. Join the waitlist for early access.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
