"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCheck, Ban } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserScanStat {
  id: number;
  email: string;
  name: string;
  tier: string;
  totalScans: number;
  lastScanAt: string | null;
  signedUpAt: string;
}

interface EventRow {
  id: number;
  event: string;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  metadata: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  created_at: string;
}

interface VisitorRow {
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  hits: number;
  scans: number;
  firstSeen: string;
  lastSeen: string;
  type: "bot" | "browser" | "unknown" | "other";
}

interface AbuseFlag {
  id: number;
  user_id: number | null;
  user_email: string | null;
  ip: string | null;
  reason: string;
  metadata: string | null;
  resolved: number;
  resolved_by: number | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CARD_BG = "#1a2a1a";

async function adminFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api/admin/${endpoint}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function countryFlag(country: string | null): string {
  if (!country) return "";
  const code = country.trim().toUpperCase().slice(0, 2);
  if (code.length < 2) return "";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
}

function shortenUA(ua: string): string {
  const m = ua.match(/(?:Chrome|Firefox|Safari|Edge|OPR)\/[\d.]+/) ||
            ua.match(/(?:bot|crawler|spider)/i);
  return m ? m[0] : ua.slice(0, 30);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/40 bg-card">
      <CardContent className="p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    browser: "bg-green-500/15 text-green-300",
    bot: "bg-red-500/15 text-red-300",
    unknown: "bg-yellow-500/15 text-yellow-300",
    other: "bg-zinc-500/15 text-zinc-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[type] ?? styles.other}`}>
      {type}
    </span>
  );
}

const EVENT_COLORS: Record<string, string> = {
  page_view: "bg-blue-500/15 text-blue-300",
  scan: "bg-primary/15 text-primary",
  signup: "bg-green-500/15 text-green-300",
  login: "bg-purple-500/15 text-purple-300",
  button_click: "bg-zinc-500/15 text-zinc-300",
  scan_quota_exceeded: "bg-red-500/15 text-red-300",
};

function EventBadge({ event }: { event: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_COLORS[event] ?? "bg-zinc-500/15 text-zinc-300"}`}>
      {event}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [userScanStats, setUserScanStats] = useState<UserScanStat[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [abuseFlags, setAbuseFlags] = useState<AbuseFlag[]>([]);
  const [unresolvedAbuseCount, setUnresolvedAbuseCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setLoading(true);
    Promise.all([
      adminFetch<{ users: UserScanStat[] }>("user-scan-stats").then((r) => setUserScanStats(r.users)).catch(() => {}),
      adminFetch<{ events: EventRow[] }>("events?limit=200").then((r) => setEvents(r.events)),
      adminFetch<{ summary: unknown; visitors: VisitorRow[] }>("visitors?days=30").then((r) => setVisitors(r.visitors)),
      adminFetch<{ flags: AbuseFlag[]; unresolvedCount: number }>("abuse-flags").then((r) => {
        setAbuseFlags(r.flags);
        setUnresolvedAbuseCount(r.unresolvedCount);
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin]);

  if (authLoading) return <Spinner />;
  if (!user || !isAdmin) {
    if (typeof window !== "undefined") window.location.href = "/";
    return <Spinner />;
  }
  if (loading) return <Spinner />;

  const totalUsers = userScanStats.length;
  const tierCounts = userScanStats.reduce<Record<string, number>>((acc, u) => {
    acc[u.tier] = (acc[u.tier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen py-8">
      <Container className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalUsers} registered user{totalUsers !== 1 ? "s" : ""}
            {Object.entries(tierCounts).map(([tier, count]) => (
              <span key={tier} className="ml-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  tier === "pro" ? "bg-primary/15 text-primary" : "bg-zinc-500/15 text-zinc-300"
                }`}>
                  {count} {tier}
                </span>
              </span>
            ))}
          </p>
        </div>

        {/* Abuse alert banner */}
        {unresolvedAbuseCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm font-medium text-red-300">
              {unresolvedAbuseCount} unresolved abuse flag{unresolvedAbuseCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* Registered Users */}
        <Section title={`Registered Users (${totalUsers})`}>
          {userScanStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No users yet</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: CARD_BG }}>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2 text-right">Scans</th>
                    <th className="px-3 py-2 text-right">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {userScanStats.map((u) => (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-3 py-2 text-foreground">{u.name || "—"}</td>
                      <td className="px-3 py-2 text-foreground/70">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.tier === "pro" ? "bg-primary/15 text-primary" : "bg-zinc-500/15 text-zinc-300"
                        }`}>
                          {u.tier}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{u.totalScans}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {new Date(u.signedUpAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Activity Log */}
        <Section title="Activity Log (last 200 events)">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: CARD_BG }}>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">UA</th>
                  <th className="px-3 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <EventBadge event={e.event} />
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {e.user_name || e.user_email || (e.user_id ? `#${e.user_id}` : "anon")}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {e.country
                        ? `${countryFlag(e.country)} ${e.city || ""} ${e.country}`.trim()
                        : e.ip?.slice(0, 15) || "—"}
                    </td>
                    <td className="max-w-[180px] px-3 py-2">
                      <span className="block truncate text-xs text-muted-foreground" title={e.user_agent || ""}>
                        {e.user_agent ? shortenUA(e.user_agent) : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Visitor Detail */}
        <Section title="Visitors — last 30 days (top 200 IPs)">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ background: CARD_BG }}>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">User Agent</th>
                  <th className="px-3 py-2 text-right">Hits</th>
                  <th className="px-3 py-2 text-right">Scans</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <TypeBadge type={v.type} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-foreground/70">{v.ip || "—"}</td>
                    <td className="px-3 py-2 text-foreground/70">
                      {v.country ? `${countryFlag(v.country)} ${v.city || ""} ${v.country}`.trim() : "—"}
                    </td>
                    <td className="max-w-[240px] px-3 py-2">
                      <span className="block truncate text-xs text-muted-foreground" title={v.userAgent || ""}>
                        {v.userAgent || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">{v.hits}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/70">{v.scans || 0}</td>
                  </tr>
                ))}
                {visitors.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No visitor data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Abuse Flags */}
        <Section title={`Security — Abuse Flags (${abuseFlags.length})`}>
          {abuseFlags.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <CheckCheck className="mb-2 h-8 w-8 text-green-400/40" />
              <p className="text-sm">No abuse flags. All clear.</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: CARD_BG }}>
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Details</th>
                    <th className="px-3 py-2 text-right">Time</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {abuseFlags.map((f) => (
                    <tr key={f.id} className={`border-b border-border/20 hover:bg-muted/10 ${f.resolved ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
                          {f.reason}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground/70">{f.user_email || (f.user_id ? `#${f.user_id}` : "—")}</td>
                      <td className="px-3 py-2 font-mono text-xs text-foreground/70">{f.ip || "—"}</td>
                      <td className="max-w-[200px] px-3 py-2">
                        <span className="block truncate text-xs text-muted-foreground" title={f.metadata || ""}>
                          {f.metadata ? f.metadata.slice(0, 80) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {!f.resolved && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={async () => {
                                await fetch(`/api/admin/abuse-flags/${f.id}/resolve`, { method: "POST", credentials: "include" });
                                setAbuseFlags((prev) => prev.map((x) => x.id === f.id ? { ...x, resolved: 1 } : x));
                                setUnresolvedAbuseCount((c) => Math.max(0, c - 1));
                              }}
                            >
                              <CheckCheck className="h-3 w-3" /> Resolve
                            </Button>
                          )}
                          {f.user_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs text-red-400 hover:text-red-300"
                              onClick={async () => {
                                await fetch(`/api/admin/users/${f.user_id}/suspend`, { method: "POST", credentials: "include" });
                              }}
                            >
                              <Ban className="h-3 w-3" /> Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </Container>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
