import { handleLearningLiveSubscriptionCheckout } from "@/app/lib/payments/learning-live-subscription-checkout";

export async function POST(request: Request) {
  return handleLearningLiveSubscriptionCheckout(request);
}
