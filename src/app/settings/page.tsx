import Link from "next/link";
import { ArrowLeft, KeyRound, Terminal } from "lucide-react";
import { ApiKeysForm } from "@/components/settings/api-keys-form";
import { SystemDepsCard } from "@/components/settings/system-deps-card";
import { getApiKeys } from "@/lib/api-keys";
import { getSystemStatus } from "@/lib/system-check";

export const dynamic = "force-dynamic";

export default async function AppSettingsPage() {
  const [keys, systemStatus] = await Promise.all([
    getApiKeys(),
    getSystemStatus(),
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-sm">App Settings</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">App Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global configuration for ClipEngine. Applies to every project.
        </p>
      </div>

      <div className="space-y-10">
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">API Keys</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              ClipEngine uses two external AI services. Both have free tiers.
              Your keys are stored locally in the app database and never leave
              your computer.
            </p>
            <ApiKeysForm
              initialGemini={keys.geminiApiKey ?? ""}
              initialHf={keys.hfToken ?? ""}
            />
          </section>
        </>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">System Dependencies</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            External tools ClipEngine needs to process videos. Missing items
            can be installed directly from here.
          </p>
          <SystemDepsCard initial={systemStatus} />
        </section>
      </div>
    </div>
  );
}
