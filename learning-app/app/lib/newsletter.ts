"use client";

export type NewsletterStatus = {
  type: "success" | "error";
  message: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(
  rawEmail: string
): Promise<NewsletterStatus> {
  const normalizedEmail = rawEmail.toLowerCase().trim();

  if (!normalizedEmail) {
    return {
      type: "error",
      message: "Please enter your email address.",
    };
  }

  if (!emailRegex.test(normalizedEmail)) {
    return {
      type: "error",
      message: "Please enter a valid email address.",
    };
  }

  try {
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const data = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!res.ok) {
      return {
        type: "error",
        message:
          data?.message || "Subscription failed. Please try again.",
      };
    }

    return {
      type: "success",
      message:
        data?.message || "You have been subscribed successfully.",
    };
  } catch {
    return {
      type: "error",
      message: "Network error. Please try again.",
    };
  }
}
