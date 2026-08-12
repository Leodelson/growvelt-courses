import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/app/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "Growvelt Learning",
    template: "%s | Growvelt Learning",
  },
  description: "Learn practical skills, build proof, and grow into opportunity.",
  icons: { icon: "/favicon-32x32.png", shortcut: "/favicon.ico", apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
