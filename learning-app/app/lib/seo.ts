export const growveltLearningUrl = new URL("https://learn.growvelt.com");

export const defaultSocialImage = "/og-image2.png";

export function absoluteLearningUrl(path = "/") {
  return new URL(path, growveltLearningUrl).toString();
}

export const growveltOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Growvelt Technologies Limited",
  url: absoluteLearningUrl(),
  logo: absoluteLearningUrl("/logo/Growvelt Logo.png"),
  description: "Growvelt connects practical learning, career development, and opportunity.",
};
