"use server";

import { revalidatePath } from "next/cache";
import {
  getApiKeys,
  setApiKeys,
  getApiKeyStatus,
  type ApiKeys,
  type ApiKeyStatus,
} from "@/lib/api-keys";

export async function fetchApiKeys(): Promise<ApiKeys> {
  return getApiKeys();
}

export async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  return getApiKeyStatus();
}

export async function saveApiKeys(patch: Partial<ApiKeys>): Promise<ApiKeys> {
  const normalized: Partial<ApiKeys> = {};
  if (patch.geminiApiKey !== undefined) {
    normalized.geminiApiKey = patch.geminiApiKey?.trim() || null;
  }
  if (patch.hfToken !== undefined) {
    normalized.hfToken = patch.hfToken?.trim() || null;
  }
  const result = await setApiKeys(normalized);
  revalidatePath("/");
  revalidatePath("/settings");
  return result;
}

export async function testGeminiKey(key: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "Empty key" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`,
      { method: "GET" },
    );
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function testHfToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Empty token" };
  try {
    const res = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Invalid token (HTTP ${res.status})` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
