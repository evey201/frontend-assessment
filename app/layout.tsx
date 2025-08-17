import "../styles/globals.css";
import type { ReactNode } from "react";
export const metadata = { title: "FrontEnd Assessment", description: "Real-time devices dashboard starter" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <header className="border-b">
          <div className="container py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Devices Dashboard</h1>
            <nav className="text-sm text-gray-500">assessment starter</nav>
          </div>
        </header>
        <main className="container py-4">{children}</main>
      </body>
    </html>
  );
}
