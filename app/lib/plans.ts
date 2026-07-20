// Shared plan definitions used by both the billing integration and the UI.
// Keep this file free of server-only imports so it can be used anywhere.

export const FREE_GENERATION_LIMIT = 20;

export const PLAN_NAMES = {
  STARTER: "Starter",
  GROWTH: "Growth",
} as const;

export type PlanName = (typeof PLAN_NAMES)[keyof typeof PLAN_NAMES];

export interface PlanDetails {
  name: PlanName;
  price: number;
  currencyCode: "USD";
  generationLimit: number | null; // null = unlimited
  description: string;
  features: string[];
}

export const PLAN_DETAILS: Record<PlanName, PlanDetails> = {
  [PLAN_NAMES.STARTER]: {
    name: PLAN_NAMES.STARTER,
    price: 9.99,
    currencyCode: "USD",
    generationLimit: 200,
    description: "For growing stores that publish new products regularly.",
    features: [
      "Up to 200 AI generations / month",
      "Titles, descriptions, tags & meta",
      "Bulk generation (up to 20 at once)",
      "3 brand voice profiles",
      "Email support",
    ],
  },
  [PLAN_NAMES.GROWTH]: {
    name: PLAN_NAMES.GROWTH,
    price: 29.99,
    currencyCode: "USD",
    generationLimit: null,
    description: "For catalogs of any size with unlimited AI usage.",
    features: [
      "Unlimited AI generations",
      "Unlimited bulk apply",
      "Unlimited brand voice profiles",
      "Priority support",
      "Early access to new features",
    ],
  },
};

export const ALL_PLAN_NAMES: PlanName[] = [PLAN_NAMES.STARTER, PLAN_NAMES.GROWTH];

export function getGenerationLimit(plan: string | null | undefined): number | null {
  if (!plan) return FREE_GENERATION_LIMIT;
  return PLAN_DETAILS[plan as PlanName]?.generationLimit ?? FREE_GENERATION_LIMIT;
}

export const BRAND_VOICES = [
  { id: "neutral", label: "Neutral", description: "Clear, friendly, and straightforward" },
  { id: "playful", label: "Playful", description: "Fun, energetic, with light humor" },
  { id: "luxury", label: "Luxury", description: "Elegant, sophisticated, premium" },
  { id: "minimal", label: "Minimal", description: "Short and to the point, no fluff" },
  { id: "bold", label: "Bold", description: "Confident, bold, and persuasive" },
] as const;

export type BrandVoiceId = (typeof BRAND_VOICES)[number]["id"];
