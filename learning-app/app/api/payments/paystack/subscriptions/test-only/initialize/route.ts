import { handleLearningTestSubscriptionCheckout } from "@/app/lib/payments/learning-test-subscription-checkout";

export async function POST(request: Request) {
  return handleLearningTestSubscriptionCheckout(request, { privateTestOnly: true });
}
