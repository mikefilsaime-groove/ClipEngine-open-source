"use server";

import { getSystemStatus, type SystemStatus } from "@/lib/system-check";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  return getSystemStatus();
}
