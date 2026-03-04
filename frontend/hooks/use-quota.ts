"use client";

import { useCallback, useEffect, useState } from "react";
import { getQuota, type QuotaInfo } from "@/lib/api";

export function useQuota() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getQuota();
      setQuota(data);
    } catch {
      // Silently fail — quota display is non-critical
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remaining = quota && quota.limit !== null ? Math.max(0, quota.limit - quota.used) : null;

  return {
    tier: quota?.tier ?? "anonymous",
    used: quota?.used ?? 0,
    limit: quota?.limit ?? null,
    remaining,
    resetsAt: quota?.resetsAt ?? null,
    refresh,
  };
}
