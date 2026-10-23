import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/app/components/language-provider";
import { ThemeProvider } from "@/app/components/theme-provider";
import { CookieConsentProvider } from "@/app/components/privacy/cookie-consent-provider";
import { defaultSocialImage, growveltLearningUrl } from "@/app/lib/seo";
import { LearningHelpAssistant } from "@/app/components/learning-help-assistant";

export const metadata: Metadata = {
  metadataBase: growveltLearningUrl,
  title: {
    default: "Growvelt",
    template: "%s | Growvelt",
  },
  description: "Explore practical online courses, learn from instructors, teach your expertise, and help your team build useful skills with Growvelt.",
  applicationName: "Growvelt",
  keywords: ["Growvelt", "online courses", "practical skills", "career development", "data analytics courses", "tech learning"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName: "Growvelt",
    title: "Growvelt | Practical skills for real opportunity",
    description: "Explore practical online courses, learn from instructors, teach your expertise, and help your team build useful skills with Growvelt.",
    images: [{ url: defaultSocialImage, width: 1200, height: 630, alt: "Growvelt" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Growvelt | Practical skills for real opportunity",
    description: "Explore practical online courses, learn from instructors, teach your expertise, and help your team build useful skills with Growvelt.",
    images: [defaultSocialImage],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
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
                const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
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
        <ThemeProvider><LanguageProvider initialLocale="en"><CookieConsentProvider>{children}<LearningHelpAssistant /></CookieConsentProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
