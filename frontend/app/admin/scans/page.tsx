"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface ScanEntry {
  id: string;
  userName: string | null;
  userEmail: string | null;
  primaryMatch: string | null;
  primaryConfidence: number | null;
  imageCount: number;
  thumbnail: string | null;
  country: string | null;
  city: string | null;
  createdAt: string;
}

function countryFlag(country: string | null): string {
  if (!country) return "";
  const trimmed = country.trim();
  if (trimmed.length > 3) return "";
  const code = trimmed.toUpperCase().slice(0, 2);
  if (code.length < 2) return "";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

export default function AdminScansPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    fetch("/api/admin/scan-gallery?limit=500", { credentials: "include" })
      .then(r => r.json())
      .then(d => setScans(d.scans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }

  return (
    <div className="min-h-screen py-8">
      <Container className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Scan Gallery
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{scans.length} scans</span>
            <Link href="/admin" className="text-sm text-primary hover:underline">← Admin</Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scans.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-border/40 bg-card">
              {s.thumbnail ? (
                <img
                  src={s.thumbnail}
                  alt={s.primaryMatch || "Scan"}
                  className="aspect-square w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="aspect-square w-full bg-muted/20 flex items-center justify-center text-muted-foreground text-xs">No image</div>'; }}
                />
              ) : (
                <div className="aspect-square w-full bg-muted/20 flex items-center justify-center text-muted-foreground text-xs">
                  No image
                </div>
              )}
              <div className="p-3 space-y-1">
                {s.primaryMatch && (
                  <p className="text-sm font-semibold text-foreground truncate">
                    {s.primaryMatch}
                    {s.primaryConfidence != null && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {s.primaryConfidence}%
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-foreground/70 truncate">
                  {s.userName || s.userEmail || "Anonymous"}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {s.country ? `${countryFlag(s.country)} ${s.city || s.country}` : "—"}
                  </span>
                  <span>
                    {new Date(s.createdAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {scans.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">No scans recorded yet.</p>
        )}
      </Container>
    </div>
  );
}
