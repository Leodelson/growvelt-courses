import type { Metadata } from "next";
import { getLearningOrigin, learningAbsoluteUrl } from "./site-urls.mjs";

export const growveltLearningUrl = new URL(getLearningOrigin());

export const defaultSocialImage = "/og-image2.png";

export function absoluteLearningUrl(path = "/") {
  return learningAbsoluteUrl(path);
}

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const socialTitle = `${title} | Growvelt`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_NG",
      siteName: "Growvelt",
      url: path,
      title: socialTitle,
      description,
      images: [{ url: defaultSocialImage, width: 1200, height: 630, alt: "Growvelt" }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [defaultSocialImage],
    },
  };
}

export const growveltOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Growvelt Technologies Limited",
  url: absoluteLearningUrl(),
  logo: absoluteLearningUrl("/logo/growvelt-wordmark-purple-20261019.png"),
  description: "Growvelt connects practical learning, career development, and opportunity.",
};
