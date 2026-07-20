import db from "../db.server";
import { getGenerationLimit } from "./plans";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getOrCreateShopSettings(shop: string) {
  let settings = await db.shopSettings.findUnique({ where: { shop } });

  if (!settings) {
    settings = await db.shopSettings.create({ data: { shop } });
    return settings;
  }

  const periodAge = Date.now() - settings.periodStart.getTime();
  if (periodAge >= THIRTY_DAYS_MS) {
    settings = await db.shopSettings.update({
      where: { shop },
      data: { generationsUsed: 0, periodStart: new Date() },
    });
  }

  return settings;
}

export async function setShopPlan(shop: string, plan: string | null) {
  await getOrCreateShopSettings(shop);
  return db.shopSettings.update({
    where: { shop },
    data: { plan },
  });
}

export async function setBrandVoice(shop: string, brandVoice: string) {
  await getOrCreateShopSettings(shop);
  return db.shopSettings.update({
    where: { shop },
    data: { brandVoice },
  });
}

export interface UsageStatus {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  plan: string | null;
}

export async function getUsageStatus(shop: string): Promise<UsageStatus> {
  const settings = await getOrCreateShopSettings(shop);
  const limit = getGenerationLimit(settings.plan);

  if (limit === null) {
    return { allowed: true, used: settings.generationsUsed, limit: null, remaining: null, plan: settings.plan };
  }

  const remaining = Math.max(0, limit - settings.generationsUsed);
  return {
    allowed: remaining > 0,
    used: settings.generationsUsed,
    limit,
    remaining,
    plan: settings.plan,
  };
}

export async function recordGeneration(shop: string, productId: string, productTitle: string) {
  await getOrCreateShopSettings(shop);
  await db.shopSettings.update({
    where: { shop },
    data: { generationsUsed: { increment: 1 } },
  });
  await db.generationLog.create({
    data: { shop, productId, productTitle },
  });
}

export async function markGenerationApplied(shop: string, productId: string) {
  const log = await db.generationLog.findFirst({
    where: { shop, productId },
    orderBy: { createdAt: "desc" },
  });
  if (log) {
    await db.generationLog.update({ where: { id: log.id }, data: { applied: true } });
  }
}
