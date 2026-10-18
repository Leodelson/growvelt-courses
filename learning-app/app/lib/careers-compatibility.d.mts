import type { SiteEnvironment } from "./site-urls.mjs";
export const careersLegacyPages: string[];
export const careersPrivatePages: string[];
export function careersTransitionWorker(): string;
export function careersCompatibilityResponse(request: Request, env?: SiteEnvironment): Response | null;
export function learningWwwSafetyBridgeResponse(request: Request, env?: SiteEnvironment): Response | null;
