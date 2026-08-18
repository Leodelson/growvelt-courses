import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/app/components/language-provider";
import { ThemeProvider } from "@/app/components/theme-provider";
import { CookieConsentProvider } from "@/app/components/privacy/cookie-consent-provider";
import { defaultSocialImage, growveltLearningUrl } from "@/app/lib/seo";

export const metadata: Metadata = {
  metadataBase: growveltLearningUrl,
  title: {
    default: "Growvelt Learning",
    template: "%s | Growvelt Learning",
  },
  description: "Learn practical skills, build proof, and grow into opportunity.",
  applicationName: "Growvelt Learning",
  keywords: ["Growvelt Learning", "online courses", "practical skills", "career development", "data analytics courses", "tech learning"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName: "Growvelt Learning",
    title: "Growvelt Learning | Practical skills for real opportunity",
    description: "Learn practical skills, build proof, and grow into opportunity with Growvelt Learning.",
    images: [{ url: defaultSocialImage, width: 1200, height: 630, alt: "Growvelt Learning" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growvelt Learning | Practical skills for real opportunity",
    description: "Learn practical skills, build proof, and grow into opportunity with Growvelt Learning.",
    images: [defaultSocialImage],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  icons: {
    icon: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
        <ThemeProvider><LanguageProvider initialLocale="en"><CookieConsentProvider>{children}</CookieConsentProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
