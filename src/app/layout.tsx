import { SpeedInsights } from "@vercel/speed-insights/next";
import { type Metadata, type Viewport } from "next";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { Inter } from "next/font/google";
import "~/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

// ─── PWA + SEO metadata ───────────────────────────────────

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Gestione spese personali",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Expense Tracker",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // disabilita zoom su mobile — migliore UX per app
};

// ─── Layout ───────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            {children}
            <Toaster />
            <SpeedInsights />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}