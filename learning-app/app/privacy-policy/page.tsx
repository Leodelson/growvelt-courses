import type { Metadata } from "next";
import { LegalPage } from "@/app/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Growvelt collects, uses, protects, and manages personal information.",
};

const sections = [
  {
    heading: "1. About this policy",
    paragraphs: [
      "This Privacy Policy explains how Growvelt Technologies Limited (RC 8738218) handles personal information when you use Growvelt, including its public pages, learner and instructor accounts, course services, company workspaces, support tools, and related features.",
      "Growvelt Careers is a separate product with separate authentication, sessions, and user data. A Growvelt account does not automatically sign you into Careers, and the two products do not share account cookies or course records. Notices shown inside a particular feature may add details to this policy.",
    ],
  },
  {
    heading: "2. Information we handle",
    paragraphs: [
      "Depending on what you do, we may handle account identifiers, name, email address, profile photo, country or location, preferences, teaching application and expertise details, organization information, course content you submit, and messages or files you send to support.",
      "To provide Growvelt, we process course enrollments, lesson and quiz activity, completion and certificate records, saved courses, and company-workspace invitations, membership, course assignments, and assignment progress. Authorized company owners and administrators can see information about company-sponsored assignments, including their status and recorded progress; those reports do not provide an employee’s full personal learning history or individual quiz answers.",
      "We also handle order references, course prices, payment and refund status, and related financial records. Payment providers process payment credentials. Growvelt sign-in history can include the sign-in time, a browser and device category, and a country when available. Hosting and security providers may separately process technical request information such as an IP address or device data to operate and protect the service.",
    ],
  },
  {
    heading: "3. How and why we use information",
    paragraphs: [
      "We use information to create and secure accounts, provide courses and requested features, record learning and certificates, support teaching applications, administer company workspaces, confirm payments, respond to support requests, deliver service messages, prevent fraud and abuse, maintain reliable records, and meet legal obligations.",
      "Depending on the purpose and applicable law, processing may be necessary to provide a requested service or perform an agreement, based on your consent, required by law, or needed for legitimate service, safety, and security interests. Where consent is the basis, you can withdraw it; withdrawal does not undo processing that already took place lawfully.",
    ],
  },
  {
    heading: "4. Accounts and sign-in",
    paragraphs: [
      "Growvelt supports the sign-in options displayed on its authentication pages, which may include email and password or Google sign-in. If you choose a third-party provider, that provider may share account details such as an identifier, email address, name, or profile image according to your provider settings and its own privacy policy.",
      "We use authentication and session technology to keep you signed in. A successful sign-in may create a security record and an email or in-app alert. If you do not recognize a sign-in, use the account security controls and contact support.",
    ],
  },
  {
    heading: "5. Courses, teaching, and company workspaces",
    paragraphs: [
      "Course activity and assessment records let us provide progress, completion, and eligible certificates. Teaching applications and submitted courses are used for instructor review, course review, and publication workflows. Organization owners and authorized instructors may see the organization information needed to manage their provider workspace.",
      "In a company workspace, authorized owners and administrators can manage invitations and assignments and see progress for company-sponsored learning. This is separate from an employee’s personal course history. We do not provide individual quiz answers through company progress reports.",
    ],
  },
  {
    heading: "6. Payments and financial records",
    paragraphs: [
      "When you use an enabled payment flow, Paystack or another clearly identified payment provider processes the payment under its own terms and privacy policy. Growvelt receives payment confirmations and related references needed to confirm an order, provide access, manage refunds or disputes, and maintain financial records. We do not intentionally store full card numbers or banking credentials on Growvelt servers.",
      "Payment, refund, chargeback, and course-access records may be retained after an account closes where needed for financial integrity, legal obligations, security, or dispute resolution. See the Refund Policy for course-refund terms.",
    ],
  },
  {
    heading: "7. Email and other communications",
    paragraphs: [
      "We send essential account, sign-in security, payment, course, invitation, and support messages when needed to operate a feature you requested. These service messages are separate from optional marketing messages.",
      "Growvelt news and offers are sent only when you opt in. You can change the marketing-email preference in Account Settings or use an unsubscribe link in a marketing email. Turning off marketing does not stop essential account or course-service messages.",
    ],
  },
  {
    heading: "8. Cookies and browser storage",
    paragraphs: [
      "Essential cookies and similar technologies support sign-in, session security, requested authentication and payment flows, and core platform features. Browser storage may remember interface choices such as theme or language, temporary workflow state, and other preferences you request. Where available, the Progressive Web App may use Cache Storage for its stated offline or performance features.",
      "Growvelt uses a first-party cookie to remember cookie or technology choices and consent-version information. It is not intended to contain passwords, authentication tokens, payment credentials, account role, or sensitive personal information. You can manage optional choices through Cookie Settings where available; blocking essential storage may stop parts of the service from working.",
      "Based on the current Growvelt implementation review, no third-party analytics or browser advertising tracker is intentionally installed. If optional measurement technologies are introduced later, this policy and any required consent choices will be updated before they are used where required by law.",
    ],
  },
  {
    heading: "9. Service providers and other sharing",
    paragraphs: [
      "We use service providers to operate Growvelt. Depending on the feature, these may include Vercel for hosting, Supabase for authentication, database, and storage, Paystack for payments, Resend for email delivery, Google for sign-in, Cloudflare Turnstile for abuse prevention, and YouTube for video content. Providers process information as needed to provide their services under their own terms and applicable safeguards.",
      "We share application or workspace information with the employer, organization, or authorized workspace manager that needs it to provide the service you chose. We may also disclose information when required by law, to protect users or the service, investigate abuse, enforce our terms, or complete a business transfer. We do not sell personal information as a standalone product.",
    ],
  },
  {
    heading: "10. Processing in other locations",
    paragraphs: [
      "Our providers may store or process information in locations outside the country where you live, depending on their infrastructure and configuration. When information is handled across borders, Growvelt uses providers and transfer arrangements intended to protect it in accordance with applicable requirements. Provider-specific locations and terms can change; consult the relevant provider’s privacy information for its practices.",
    ],
  },
  {
    heading: "11. Retention and deletion",
    paragraphs: [
      "We keep information for as long as it is reasonably needed for the purpose it was collected, including to provide the service, maintain learning and certificate records, protect accounts, meet legal or financial obligations, resolve disputes, and enforce our terms. Retention periods vary by record type and purpose.",
      "A sign-in alert in the notification bell is removed 24 hours after you mark it as read. Security sign-in records may be retained separately for account protection. Closing or deleting an account does not automatically erase financial, security, legal, or dispute records that must or may be retained.",
      "When an eligible learner deletes an account, Growvelt asks whether an earned certificate should remain publicly verifiable. If you choose to keep verification, the certificate’s issued snapshot may remain available without being linked to an active account. If you choose to remove public verification, the learner name is removed from that verification record and the certificate is marked revoked. Instructors with dependent course content and active administrators require managed offboarding so content and platform access are handled safely.",
    ],
  },
  {
    heading: "12. Your privacy choices and rights",
    paragraphs: [
      "Depending on applicable law, you may have rights to be informed about processing, request access to or a copy of information, correct inaccurate information, request erasure or restriction, object to certain processing, request portability, withdraw consent, and complain to the relevant supervisory authority. These rights may be subject to lawful exceptions, including records needed for security, legal, payment, or dispute purposes.",
      "You can change available profile and email preferences in your account. For a privacy request, contact support@growvelt.com from the email associated with your account and describe the request. We may ask for reasonable information to confirm your identity before responding.",
    ],
  },
  {
    heading: "13. Security and third-party content",
    paragraphs: [
      "We use technical and organizational safeguards intended to protect information from unauthorized access, loss, or misuse. No online service can be guaranteed completely secure, so protect your password, device, and account access and tell us promptly about suspicious activity.",
      "Some courses or public pages link to or embed third-party content, such as YouTube videos. Opening that content may allow the provider to process information or use technologies under its own policy. Growvelt does not control third-party websites or services.",
    ],
  },
  {
    heading: "14. Changes and contact",
    paragraphs: [
      "We may revise this policy when Growvelt features, providers, legal requirements, or our practices change. We will post the current version with its latest update date. Material changes may also be communicated through an appropriate service channel.",
      "For privacy questions or requests, contact support@growvelt.com or use the Contact us page.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return <LegalPage title="Privacy Policy" summary="How Growvelt handles personal information and technology choices." updated="October 20, 2026" sections={sections} />;
}
