import '../src/ui/styles.css';

export const metadata = { title: 'Health Track', description: 'Your personal AI health coach' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/assets/genie.png" />
      </head>
      <body><div id="ht-root">{children}</div></body>
    </html>
  );
}
