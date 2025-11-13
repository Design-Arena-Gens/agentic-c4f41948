import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pinterest Top Pins Downloader',
  description: 'Find and download the most liked images from any public Pinterest board.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
