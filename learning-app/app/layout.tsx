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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const stored = localStorage.getItem("growvelt-learning-theme");
                const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
                const resolved = theme === "system"
                  ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
                  : theme;
                document.documentElement.dataset.theme = resolved;
                document.documentElement.style.colorScheme = resolved;
              } catch (_) {}
            })();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
