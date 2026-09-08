import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Puerto App · El grupo',
  description:
    'Ruleta, ubicaciones, chat y perfil del grupo. Demo interactiva de Puerto App.',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
