import { getLearningOrigin, learningAbsoluteUrl } from "./site-urls.mjs";

export const growveltLearningUrl = new URL(getLearningOrigin());

export const defaultSocialImage = "/og-image2.png";

export function absoluteLearningUrl(path = "/") {
  return learningAbsoluteUrl(path);
}

export const growveltOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Growvelt Technologies Limited",
  url: absoluteLearningUrl(),
  logo: absoluteLearningUrl("/logo/growvelt-wordmark-purple-20261019.png"),
  description: "Growvelt connects practical learning, career development, and opportunity.",
};
