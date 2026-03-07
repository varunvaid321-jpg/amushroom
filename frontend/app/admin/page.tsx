"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCheck, Ban, MessageSquare } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DailyPageView {
  day: string;
  count: number;
}

interface GeoRow {
  country: string;
  city: string | null;
  count: number;
}

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

interface FeedbackRow {
  id: number;
  user_id: number | null;
  email: string | null;
  name: string | null;
  user_email: string | null;
  user_name: string | null;
  message: string;
  also_email: number;
  ip: string | null;
  created_at: string;
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

// ── Charts ──────────────────────────────────────────────────────────────────────

function TrafficChart({ data }: { data: DailyPageView[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No traffic data yet</p>;

  // Fill in missing days with 0
  const filled: DailyPageView[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const found = data.find((r) => r.day === day);
    filled.push({ day, count: found ? found.count : 0 });
  }

  const max = Math.max(...filled.map((d) => d.count), 1);
  const W = 700;
  const H = 180;
  const padL = 36;
  const padB = 24;
  const chartW = W - padL;
  const chartH = H - padB;

  const points = filled.map((d, i) => {
    const x = padL + (i / (filled.length - 1)) * chartW;
    const y = chartH - (d.count / max) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${chartH} L${padL},${chartH} Z`;

  // Y-axis labels
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[500px]" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((t) => {
          const y = chartH - (t / max) * chartH;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={W} y2={y} stroke="currentColor" className="text-border/30" strokeDasharray="4 4" />
              <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{t}</text>
            </g>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} className="fill-primary/10" />
        {/* Line */}
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots on non-zero days */}
        {points.filter((p) => p.count > 0).map((p) => (
          <circle key={p.day} cx={p.x} cy={p.y} r="3" className="fill-primary" />
        ))}
        {/* X-axis month labels */}
        {points.filter((_, i) => i % 30 === 0 || i === points.length - 1).map((p) => (
          <text key={p.day} x={p.x} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {new Date(p.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

const DONUT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
];
const BOT_COLOR = "#ef4444";

function GeoDonut({ visitors, geoData }: { visitors: VisitorRow[]; geoData: GeoRow[] }) {
  // Aggregate by country from geo data
  const byCountry: Record<string, number> = {};
  for (const g of geoData) {
    const c = g.country || "Unknown";
    byCountry[c] = (byCountry[c] || 0) + g.count;
  }
  const countryEntries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);

  // Bot vs browser from visitors
  const botHits = visitors.filter((v) => v.type === "bot").reduce((s, v) => s + v.hits, 0);
  const browserHits = visitors.filter((v) => v.type === "browser").reduce((s, v) => s + v.hits, 0);
  const otherHits = visitors.filter((v) => v.type !== "bot" && v.type !== "browser").reduce((s, v) => s + v.hits, 0);

  const totalHits = botHits + browserHits + otherHits || 1;

  // Donut: countries
  const totalGeo = countryEntries.reduce((s, [, c]) => s + c, 0) || 1;
  const R = 60;
  const r = 38;
  const cx = 80;
  const cy = 80;

  function arcSlice(startAngle: number, endAngle: number, color: string, key: string) {
    const s = (startAngle - 90) * (Math.PI / 180);
    const e = (endAngle - 90) * (Math.PI / 180);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);
    const x3 = cx + r * Math.cos(e), y3 = cy + r * Math.sin(e);
    const x4 = cx + r * Math.cos(s), y4 = cy + r * Math.sin(s);
    return <path key={key} d={`M${x1},${y1} A${R},${R} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${largeArc} 0 ${x4},${y4} Z`} fill={color} />;
  }

  const slices: React.ReactNode[] = [];
  let angle = 0;
  const top5 = countryEntries.slice(0, 7);
  const otherGeo = countryEntries.slice(7).reduce((s, [, c]) => s + c, 0);
  const items = [...top5, ...(otherGeo > 0 ? [["Other", otherGeo] as [string, number]] : [])];

  for (let i = 0; i < items.length; i++) {
    const [, count] = items[i];
    const sweep = (count / totalGeo) * 360;
    if (sweep > 0.5) {
      slices.push(arcSlice(angle, angle + sweep - 0.5, DONUT_COLORS[i % DONUT_COLORS.length], `geo-${i}`));
    }
    angle += sweep;
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      {/* Country donut */}
      <div className="flex items-center gap-4">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {slices.length > 0 ? slices : <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor" className="text-border/30" strokeWidth="2" />}
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-foreground text-[14px] font-semibold">{totalGeo}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="fill-muted-foreground text-[9px]">events</text>
        </svg>
        <div className="space-y-1">
          {items.map(([country, count], i) => (
            <div key={country} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-foreground">{countryFlag(country as string)} {country}</span>
              <span className="text-muted-foreground">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bot vs Browser bars */}
      <div className="flex-1 min-w-[200px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Real vs Bots (30d)</p>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400">Real users</span>
              <span className="text-muted-foreground">{browserHits} ({Math.round((browserHits / totalHits) * 100)}%)</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${(browserHits / totalHits) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400">Bots</span>
              <span className="text-muted-foreground">{botHits} ({Math.round((botHits / totalHits) * 100)}%)</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-red-500" style={{ width: `${(botHits / totalHits) * 100}%` }} />
            </div>
          </div>
          {otherHits > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-yellow-400">Unknown</span>
                <span className="text-muted-foreground">{otherHits} ({Math.round((otherHits / totalHits) * 100)}%)</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(otherHits / totalHits) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [userScanStats, setUserScanStats] = useState<UserScanStat[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [dailyViews, setDailyViews] = useState<DailyPageView[]>([]);
  const [geoData, setGeoData] = useState<GeoRow[]>([]);
  const [abuseFlags, setAbuseFlags] = useState<AbuseFlag[]>([]);
  const [unresolvedAbuseCount, setUnresolvedAbuseCount] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setLoading(true);
    Promise.all([
      adminFetch<{ users: UserScanStat[] }>("user-scan-stats").then((r) => setUserScanStats(r.users)).catch(() => {}),
      adminFetch<{ events: EventRow[] }>("events?limit=200").then((r) => setEvents(r.events)),
      adminFetch<{ summary: unknown; visitors: VisitorRow[] }>("visitors?days=30").then((r) => setVisitors(r.visitors)),
      adminFetch<{ data: DailyPageView[] }>("page-views-by-day?days=90").then((r) => setDailyViews(r.data)).catch(() => {}),
      adminFetch<{ data: GeoRow[] }>("geo?days=30").then((r) => setGeoData(r.data)).catch(() => {}),
      adminFetch<{ feedback: FeedbackRow[] }>("feedback").then((r) => setFeedback(r.feedback)).catch(() => {}),
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

        {/* Daily Traffic Chart */}
        <Section title="Homepage Traffic — Last 90 Days">
          <TrafficChart data={dailyViews} />
        </Section>

        {/* Geo & Bot Breakdown */}
        <Section title="Traffic Breakdown — Last 30 Days">
          <GeoDonut visitors={visitors} geoData={geoData} />
        </Section>

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

        {/* User Feedback */}
        <Section title={`User Feedback (${feedback.length})`}>
          {feedback.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm">No feedback yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedback.map((f) => {
                const from = f.user_name || f.user_email || f.name || f.email || (f.user_id ? `User #${f.user_id}` : "Anonymous");
                const contact = f.email || f.user_email || null;
                return (
                  <div key={f.id} className="rounded-lg border border-border/30 bg-muted/10 p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <span className="font-medium text-foreground">{from}</span>
                        {contact && <span className="ml-2 text-xs text-muted-foreground">{contact}</span>}
                        {f.also_email === 1 && (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">wants reply</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{f.message}</p>
                  </div>
                );
              })}
            </div>
          )}
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
