import { db } from "./db";

export interface ApiKeys {
  geminiApiKey: string | null;
  hfToken: string | null;
}

export interface ApiKeyStatus {
  geminiConfigured: boolean;
  hfConfigured: boolean;
  allConfigured: boolean;
}

async function getOrSeed(): Promise<ApiKeys> {
  let row = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    const envGemini =
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
    const envHf = process.env.HF_TOKEN ?? null;
    row = await db.appSettings.create({
      data: {
        id: "singleton",
        geminiApiKey: envGemini,
        hfToken: envHf,
      },
    });
  }
  return {
    geminiApiKey: row.geminiApiKey,
    hfToken: row.hfToken,
  };
}

export async function getApiKeys(): Promise<ApiKeys> {
  return getOrSeed();
}

export async function setApiKeys(patch: Partial<ApiKeys>): Promise<ApiKeys> {
  await getOrSeed();
  const row = await db.appSettings.update({
    where: { id: "singleton" },
    data: {
      ...(patch.geminiApiKey !== undefined && { geminiApiKey: patch.geminiApiKey }),
      ...(patch.hfToken !== undefined && { hfToken: patch.hfToken }),
    },
  });
  return { geminiApiKey: row.geminiApiKey, hfToken: row.hfToken };
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const keys = await getOrSeed();
  const geminiConfigured = !!keys.geminiApiKey && keys.geminiApiKey.trim().length > 0;
  const hfConfigured = !!keys.hfToken && keys.hfToken.trim().length > 0;
  return {
    geminiConfigured,
    hfConfigured,
    allConfigured: geminiConfigured && hfConfigured,
  };
}

export async function resolveGeminiKey(): Promise<string> {
  const keys = await getOrSeed();
  const key =
    keys.geminiApiKey ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    null;
  if (!key) {
    throw new Error(
      "Gemini API key not configured. Add one in Settings → API Keys.",
    );
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = key;
  }
  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = key;
  }
  return key;
}

export async function resolveHfToken(): Promise<string> {
  const keys = await getOrSeed();
  const tok = keys.hfToken ?? process.env.HF_TOKEN ?? null;
  if (!tok) {
    throw new Error(
      "HuggingFace token not configured. Add one in Settings → API Keys.",
    );
  }
  return tok;
}

export function maskKey(key: string | null): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}
