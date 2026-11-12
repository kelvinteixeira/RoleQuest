/**
 * Plans and AI credit packs. Limits must match `spend_chronicle_quota` and
 * `guard_campaign_limit` (supabase/migrations/20261112000000_launch.sql);
 * prices here are what the page shows — the charge itself comes from the
 * Stripe price ids in the environment (STRIPE_PRICE_*).
 */
export type PlanId = "free" | "mestre" | "mesa";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price shown on the page, in BRL. */
  priceMonthly: number;
  tagline: string;
  features: string[];
  /** Episodes and comics carry the "feito com Role Quest" mark. */
  watermark: boolean;
  campaigns: number | null;
  daily: { script: number; image: number; voice: number };
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Grátis",
    priceMonthly: 0,
    tagline: "Para conhecer e jogar com o grupo.",
    features: ["Mesa 3D completa, fichas e dados", "Jogadores entram de graça pelo convite", "1 campanha em andamento", "Chronicles: 3 roteiros e 30 quadros por dia", "Episódios com a marca Role Quest"],
    watermark: true,
    campaigns: 1,
    daily: { script: 3, image: 30, voice: 40 },
  },
  {
    id: "mestre",
    name: "Mestre",
    priceMonthly: 19.9,
    tagline: "Para quem conduz as mesas.",
    features: ["Campanhas ilimitadas", "Chronicles: 20 roteiros e 120 quadros por dia", "Narração gravada", "Episódios e HQs sem marca d'água"],
    watermark: false,
    campaigns: null,
    daily: { script: 20, image: 120, voice: 200 },
  },
  {
    id: "mesa",
    name: "Mesa",
    priceMonthly: 34.9,
    tagline: "Para grupos que dividem a conta.",
    features: ["Tudo do Mestre", "Chronicles: 40 roteiros e 240 quadros por dia", "Ideal para dividir entre o grupo"],
    watermark: false,
    campaigns: null,
    daily: { script: 40, image: 240, voice: 400 },
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** Credits pay for AI use over the daily allowance: a script costs 5, an image or a narration 1. */
export const CREDIT_PACKS = [
  { id: "credits-100", credits: 100, price: 9.9 },
  { id: "credits-300", credits: 300, price: 24.9 },
] as const;
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export interface BillingStatus {
  plan: PlanId;
  /** False until billing is switched on: everyone has the Mestre allowances. */
  enforced: boolean;
  status: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  credits: number;
  usedToday: Partial<Record<"script" | "image" | "voice", number>>;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
