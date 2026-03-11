"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CheckCheck, Ban, MessageSquare, TrendingUp, Users, Scan, Eye, Camera, ArrowUpRight, ArrowDownRight, Mail } from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DailyPageView { day: string; count: number }
interface GeoRow { country: string; city: string | null; count: number }

interface UserScanStat {
  id: number; email: string; name: string; tier: string;
  totalScans: number; lastScanAt: string | null; signedUpAt: string;
  country: string | null;
}

interface EventRow {
  id: number; event: string; user_id: number | null;
  user_name: string | null; user_email: string | null;
  metadata: string | null; ip: string | null;
  country: string | null; city: string | null;
  user_agent: string | null; created_at: string;
}

interface VisitorRow {
  ip: string | null; userAgent: string | null;
  country: string | null; city: string | null;
  hits: number; scans: number;
  firstSeen: string; lastSeen: string;
  type: "bot" | "browser" | "unknown" | "other";
}

interface NewsletterSub {
  id: number; email: string; name: string | null;
  country: string | null; subscribed_at: string; unsubscribed_at: string | null;
}

interface FeedbackRow {
  id: number; user_id: number | null; email: string | null;
  name: string | null; user_email: string | null; user_name: string | null;
  message: string; also_email: number; ip: string | null; created_at: string;
}

interface ScanLogEntry {
  id: number; userId: number | null;
  userName: string | null; userEmail: string | null;
  isAnonymous: boolean; species: string | null;
  confidence: number | null; imageCount: number | null;
  uploadId: string | null; quotaExceeded: boolean;
  country: string | null; city: string | null;
  createdAt: string;
}

interface AbuseFlag {
  id: number; user_id: number | null; user_email: string | null;
  ip: string | null; reason: string; metadata: string | null;
  resolved: number; resolved_by: number | null; created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CARD_BG = "#1a2a1a";

async function adminFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api/admin/${endpoint}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function countryLabel(country: string | null, city: string | null): string {
  if (!country) return "";
  if (city) return `${city}, ${country}`;
  return country;
}

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/bot|crawler|spider|googlebot|bingbot/i.test(ua)) return "Bot";
  return "Other";
}

function parseDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android.*Mobile/i.test(ua)) return "Android";
  if (/Android/i.test(ua)) return "Android Tablet";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  if (/bot|crawler|spider/i.test(ua)) return "Bot";
  return "Other";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <Card className="border-border/40 bg-card">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground/60">{subtitle}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value, subValue, icon: Icon, accent, active, onClick, trend }: {
  label: string; value: string | number; subValue?: string; icon: React.ElementType;
  accent?: string; active?: boolean; onClick?: () => void; trend?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-4 transition cursor-pointer ${active ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30" : "border-border/30 bg-muted/10 hover:border-border/60 hover:bg-muted/20"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${accent || "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend > 0 ? "text-green-400" : "text-red-400"}`}>
            {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {subValue && <p className="mt-0.5 text-[11px] text-muted-foreground/60">{subValue}</p>}
    </button>
  );
}

const EVENT_COLORS_HEX: Record<string, string> = {
  page_view: "#3b82f6",
  scan: "#22c55e",
  signup: "#a855f7",
  login: "#f59e0b",
  button_click: "#71717a",
  scan_quota_exceeded: "#ef4444",
};

const EVENT_LABELS: Record<string, string> = {
  page_view: "Page Views",
  scan: "Scans",
  signup: "Signups",
  login: "Logins",
  button_click: "Clicks",
  scan_quota_exceeded: "Quota Hit",
};

const EVENT_BADGE_STYLES: Record<string, string> = {
  page_view: "bg-blue-500/15 text-blue-300",
  scan: "bg-primary/15 text-primary",
  signup: "bg-green-500/15 text-green-300",
  login: "bg-purple-500/15 text-purple-300",
  button_click: "bg-zinc-500/15 text-zinc-300",
  scan_quota_exceeded: "bg-red-500/15 text-red-300",
};

// ── Bar chart (vertical) ────────────────────────────────────────────────────────

function BarChart({ items, maxItems = 8 }: { items: { label: string; value: number; color: string }[]; maxItems?: number }) {
  const shown = items.slice(0, maxItems);
  const max = Math.max(...shown.map((i) => i.value), 1);
  const total = shown.reduce((s, i) => s + i.value, 0);

  return (
    <div>
      <div className="flex items-end gap-1 h-32 mb-3">
        {shown.map((item) => {
          const pct = (item.value / max) * 100;
          const sharePct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1 group relative">
              <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {item.value.toLocaleString()} ({sharePct}%)
              </span>
              <div
                className="w-full rounded-t transition-all hover:opacity-80"
                style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: item.color, minHeight: "4px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {shown.map((item) => (
          <div key={item.label} className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground truncate leading-tight">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal ranked list ──────────────────────────────────────────────────────

function RankedList({ items, maxItems = 8 }: { items: { label: string; value: number; color: string; pct?: number }[]; maxItems?: number }) {
  const shown = items.slice(0, maxItems);
  const max = Math.max(...shown.map((i) => i.value), 1);
  const total = shown.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-2.5">
      {shown.map((item, i) => {
        const pct = item.pct ?? (total > 0 ? Math.round((item.value / total) * 100) : 0);
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-4 text-right">{i + 1}</span>
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums text-foreground">{item.value.toLocaleString()}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Traffic sparkline ───────────────────────────────────────────────────────────

function TrafficChart({ data }: { data: DailyPageView[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No traffic data yet</p>;

  const filled: DailyPageView[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const found = data.find((r) => r.day === day);
    filled.push({ day, count: found ? found.count : 0 });
  }

  const max = Math.max(...filled.map((d) => d.count), 1);
  const totalViews = filled.reduce((s, d) => s + d.count, 0);
  const last7 = filled.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = filled.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

  const W = 700;
  const H = 160;
  const padL = 36;
  const padB = 20;
  const padT = 8;
  const chartW = W - padL;
  const chartH = H - padB - padT;

  const points = filled.map((d, i) => {
    const x = padL + (i / (filled.length - 1)) * chartW;
    const y = padT + chartH - (d.count / max) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${padL},${padT + chartH} Z`;

  const yTicks = [0, Math.round(max / 2), max];

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-4">
        <span className="text-xl font-bold tabular-nums text-foreground">{totalViews.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">total views</span>
        <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
          {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(trend)}% WoW
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">Last 7d: <span className="font-medium text-foreground">{last7}</span></span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {yTicks.map((t) => {
            const y = padT + chartH - (t / max) * chartH;
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W} y2={y} stroke="currentColor" className="text-border/20" strokeDasharray="3 3" />
                <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{t}</text>
              </g>
            );
          })}
          <path d={areaPath} className="fill-primary/10" />
          <path d={linePath} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.filter((p) => p.count > 0).map((p) => (
            <circle key={p.day} cx={p.x} cy={p.y} r="2.5" className="fill-primary" />
          ))}
          {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p) => (
            <text key={p.day} x={p.x} y={H - 2} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {new Date(p.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Donut chart ─────────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

function DonutChart({ items, centerLabel }: { items: { label: string; value: number; color: string }[]; centerLabel: string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const R = 56, r = 36, cx = 70, cy = 70;

  const slices: React.ReactNode[] = [];
  let angle = 0;
  for (let i = 0; i < items.length; i++) {
    const sweep = (items[i].value / total) * 360;
    if (sweep > 0.5) {
      const s = (angle - 90) * (Math.PI / 180);
      const e = (angle + sweep - 0.5 - 90) * (Math.PI / 180);
      const large = sweep > 180 ? 1 : 0;
      const d = `M${cx + R * Math.cos(s)},${cy + R * Math.sin(s)} A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(e)},${cy + R * Math.sin(e)} L${cx + r * Math.cos(e)},${cy + r * Math.sin(e)} A${r},${r} 0 ${large} 0 ${cx + r * Math.cos(s)},${cy + r * Math.sin(s)} Z`;
      slices.push(<path key={i} d={d} fill={items[i].color} />);
    }
    angle += sweep;
  }

  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {slices.length > 0 ? slices : <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor" className="text-border/30" strokeWidth="2" />}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground text-[13px] font-bold">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" className="fill-muted-foreground text-[8px]">{centerLabel}</text>
      </svg>
      <div className="space-y-1">
        {items.map((item) => {
          const pct = Math.round((item.value / total) * 100);
          return (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-foreground">{item.label}</span>
              <span className="text-muted-foreground tabular-nums">{item.value} ({pct}%)</span>
            </div>
          );
        })}
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
  const [newsletterSubs, setNewsletterSubs] = useState<NewsletterSub[]>([]);
  const [newsletterCount, setNewsletterCount] = useState(0);
  const [scanLog, setScanLog] = useState<ScanLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [healthBanner, setHealthBanner] = useState<{ uptime: number; dbReady: boolean; dbError: string | null } | null>(null);
  const [healthDismissed, setHealthDismissed] = useState(false);

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
      adminFetch<{ subscribers: NewsletterSub[]; activeSubscribers: number }>("newsletter").then((r) => { setNewsletterSubs(r.subscribers); setNewsletterCount(r.activeSubscribers); }).catch(() => {}),
      adminFetch<{ scans: ScanLogEntry[] }>("scan-log?limit=200").then((r) => setScanLog(r.scans)).catch(() => {}),
      fetch("/api/ping").then(r => r.json()).then((d: { ok: boolean; dbReady: boolean; dbError: string | null; uptime: number }) => {
        if (!d.ok || !d.dbReady || d.uptime < 3600) setHealthBanner({ uptime: d.uptime, dbReady: d.dbReady, dbError: d.dbError });
      }).catch(() => setHealthBanner({ uptime: 0, dbReady: false, dbError: "Backend unreachable" })),
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

  // ── Derived analytics ──────────────────────────────────────────────────────

  const totalUsers = userScanStats.length;
  const tierCounts = userScanStats.reduce<Record<string, number>>((acc, u) => { acc[u.tier] = (acc[u.tier] || 0) + 1; return acc; }, {});

  const browserVisitors = visitors.filter((v) => v.type === "browser");
  const totalHits = browserVisitors.reduce((s, v) => s + v.hits, 0);
  const totalScans = events.filter((e) => e.event === "scan").length;
  const totalSignups = userScanStats.length;
  const uniqueVisitors = browserVisitors.length;

  // Weekly trend for KPI
  const last7Views = dailyViews.filter(d => {
    const diff = (Date.now() - new Date(d.day + "T12:00:00").getTime()) / 86400000;
    return diff <= 7;
  }).reduce((s, d) => s + d.count, 0);
  const prev7Views = dailyViews.filter(d => {
    const diff = (Date.now() - new Date(d.day + "T12:00:00").getTime()) / 86400000;
    return diff > 7 && diff <= 14;
  }).reduce((s, d) => s + d.count, 0);
  const viewsTrend = prev7Views > 0 ? Math.round(((last7Views - prev7Views) / prev7Views) * 100) : 0;

  // Event breakdown
  const eventCounts: Record<string, number> = {};
  for (const e of events) { eventCounts[e.event] = (eventCounts[e.event] || 0) + 1; }
  const eventBarItems = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([event, count]) => ({
      label: EVENT_LABELS[event] || event,
      value: count,
      color: EVENT_COLORS_HEX[event] || "#71717a",
    }));

  // Top locations — country name only, no flags
  const byCountry: Record<string, number> = {};
  for (const g of geoData) { byCountry[g.country || "Unknown"] = (byCountry[g.country || "Unknown"] || 0) + g.count; }
  const countryItems = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([country, count], i) => ({
      label: country,
      value: count,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  // Top cities
  const cityItems = geoData
    .filter((g) => g.city)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((g, i) => ({
      label: `${g.city}, ${g.country}`,
      value: g.count,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  // Browser breakdown
  const browserCounts: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {};
  for (const v of browserVisitors) {
    if (!v.userAgent) continue;
    const browser = parseBrowser(v.userAgent);
    browserCounts[browser] = (browserCounts[browser] || 0) + v.hits;
    const device = parseDevice(v.userAgent);
    deviceCounts[device] = (deviceCounts[device] || 0) + v.hits;
  }

  const BROWSER_COLORS: Record<string, string> = { Chrome: "#4285F4", Safari: "#000000", Firefox: "#FF7139", Edge: "#0078D7", Opera: "#FF1B2D", Bot: "#ef4444", Other: "#71717a" };
  const browserItems = Object.entries(browserCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([b, count]) => ({ label: b, value: count, color: BROWSER_COLORS[b] || "#71717a" }));

  const DEVICE_COLORS: Record<string, string> = { iPhone: "#A2AAAD", Mac: "#555555", Windows: "#0078D6", Android: "#3DDC84", iPad: "#C0C0C0", Linux: "#FCC624", "Android Tablet": "#3DDC84", Bot: "#ef4444", Other: "#71717a" };
  const deviceItems = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([d, count]) => ({ label: d, value: count, color: DEVICE_COLORS[d] || "#71717a" }));

  // Bot vs real
  const botHits = visitors.filter((v) => v.type === "bot").reduce((s, v) => s + v.hits, 0);
  const realHits = browserVisitors.reduce((s, v) => s + v.hits, 0);
  const botPct = Math.round((botHits / (botHits + realHits || 1)) * 100);

  // Top scanners
  const topScanners = [...visitors]
    .filter((v) => v.scans > 0 && v.type === "browser")
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 8);

  const recentEvents = events.slice(0, 10);

  return (
    <div className="min-h-screen py-8">
      <Container className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">Admin</h1>
            <Link href="/admin/scans" className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Camera className="h-3.5 w-3.5" />
              Scan Gallery
            </Link>
            <TestEmailButton />
          </div>
          <p className="text-sm text-muted-foreground">
            {totalUsers} user{totalUsers !== 1 ? "s" : ""}
            {Object.entries(tierCounts).map(([tier, count]) => (
              <span key={tier} className="ml-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tier === "pro" ? "bg-primary/15 text-primary" : tier === "lifetime" ? "bg-purple-500/15 text-purple-300" : "bg-zinc-500/15 text-zinc-300"}`}>
                  {count} {tier}
                </span>
              </span>
            ))}
          </p>
        </div>

        {/* Health banner */}
        {healthBanner && !healthDismissed && (
          <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${healthBanner.dbReady ? "border-yellow-500/40 bg-yellow-500/10" : "border-red-500/40 bg-red-500/10"}`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${healthBanner.dbReady ? "text-yellow-400" : "text-red-400"}`} />
              <p className={`text-sm font-medium ${healthBanner.dbReady ? "text-yellow-300" : "text-red-300"}`}>
                {!healthBanner.dbReady
                  ? `Backend database error: ${healthBanner.dbError || "unreachable"}`
                  : `Backend restarted ${Math.round(healthBanner.uptime / 60)} min ago (uptime: ${Math.round(healthBanner.uptime / 60)}m)`}
              </p>
            </div>
            <button onClick={() => setHealthDismissed(true)} className="text-xs text-muted-foreground hover:text-foreground ml-4 shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* Abuse alert */}
        {unresolvedAbuseCount > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm font-medium text-red-300">
              {unresolvedAbuseCount} unresolved abuse flag{unresolvedAbuseCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Page Views" value={totalHits.toLocaleString()} subValue="Last 30 days" icon={Eye} accent="text-blue-400" trend={viewsTrend} active={activeKpi === "views"} onClick={() => setActiveKpi(activeKpi === "views" ? null : "views")} />
          <KpiCard label="Scans" value={totalScans} subValue="Recent activity" icon={Scan} accent="text-primary" active={activeKpi === "scans"} onClick={() => setActiveKpi(activeKpi === "scans" ? null : "scans")} />
          <KpiCard label="Users" value={totalSignups} subValue={`${tierCounts["pro"] || 0} pro, ${tierCounts["lifetime"] || 0} lifetime`} icon={Users} accent="text-purple-400" active={activeKpi === "signups"} onClick={() => setActiveKpi(activeKpi === "signups" ? null : "signups")} />
          <KpiCard label="Visitors" value={uniqueVisitors} subValue="Unique (30d)" icon={TrendingUp} accent="text-amber-400" active={activeKpi === "visitors"} onClick={() => setActiveKpi(activeKpi === "visitors" ? null : "visitors")} />
        </div>

        {/* KPI detail panels */}
        {activeKpi === "views" && (
          <Section title="Daily Page Views" subtitle="Last 7 days breakdown">
            {(() => {
              const last7 = dailyViews
                .sort((a, b) => b.day.localeCompare(a.day))
                .slice(0, 7);
              return last7.length > 0 ? (
                <div className="space-y-1.5">
                  {last7.map((d) => (
                    <div key={d.day} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/10">
                      <span className="text-sm text-foreground">{new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{d.count.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between rounded-lg border-t border-border/30 px-3 pt-3">
                    <span className="text-sm font-medium text-muted-foreground">7-day total</span>
                    <span className="text-sm font-bold tabular-nums text-primary">{last7.reduce((s, d) => s + d.count, 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No data yet</p>
              );
            })()}
          </Section>
        )}

        {activeKpi === "scans" && (
          <Section title="Scan Log" subtitle={`${scanLog.length} scans (logged-in + anonymous)`}>
            {scanLog.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: CARD_BG }}>
                    <tr className="border-b border-border/50 text-left text-muted-foreground text-xs">
                      <th className="px-2 py-2">Who</th>
                      <th className="hidden sm:table-cell px-2 py-2">Location</th>
                      <th className="px-2 py-2">Result</th>
                      <th className="px-2 py-2 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanLog.map((s) => (
                      <tr key={s.id} className="border-b border-border/20 hover:bg-muted/10">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            {s.uploadId && (
                              <span className="shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/uploads/${s.uploadId}/cover-image`} alt={s.species || "Scan"} className="h-8 w-8 rounded object-cover border border-border/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </span>
                            )}
                            <div className="min-w-0">
                              <span className="text-sm text-foreground truncate block">{s.isAnonymous ? "anonymous" : (s.userName || s.userEmail || "unknown")}</span>
                              <span className={`text-[10px] font-medium ${s.isAnonymous ? "text-zinc-400" : "text-green-400"}`}>{s.isAnonymous ? "not logged in" : "logged in"}{s.uploadId ? ` · ${s.uploadId.slice(0,8)}` : " · no-uid"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-2 py-2 text-xs text-foreground/50">{countryLabel(s.country, s.city) || "\u2014"}</td>
                        <td className="px-2 py-2">
                          {s.quotaExceeded ? (
                            <span className="text-xs text-red-400">quota exceeded</span>
                          ) : s.species ? (
                            <div>
                              <span className="text-sm text-foreground italic">{s.species}</span>
                              {s.confidence != null && <span className="ml-1.5 text-[10px] font-bold tabular-nums text-primary">{s.confidence}%</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">no result</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{timeAgo(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No scans yet</p>
            )}
          </Section>
        )}

        {activeKpi === "signups" && (
          <Section title="All Users" subtitle="Sorted by signup date">
            {(() => {
              const signupUsers = userScanStats
                .sort((a, b) => new Date(b.signedUpAt).getTime() - new Date(a.signedUpAt).getTime())
                .slice(0, 20);
              return signupUsers.length > 0 ? (
                <div className="space-y-1.5">
                  {signupUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/10">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${u.tier === "pro" ? "bg-primary/15 text-primary" : u.tier === "lifetime" ? "bg-purple-500/15 text-purple-300" : "bg-zinc-500/15 text-zinc-300"}`}>{u.tier}</span>
                      <span className="text-sm font-medium text-foreground">{u.name || "\u2014"}</span>
                      <span className="min-w-0 truncate text-xs text-foreground/60">{u.email}</span>
                      {u.country && <span className="hidden sm:block shrink-0 text-xs text-foreground/40">{u.country}</span>}
                      <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-foreground">{u.totalScans}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">scans</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">No users yet</p>
              );
            })()}
          </Section>
        )}

        {activeKpi === "visitors" && (
          <Section title="Top Visitors" subtitle="Unique browsers, 30 days, sorted by hits">
            {browserVisitors.length > 0 ? (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {browserVisitors
                  .sort((a, b) => b.hits - a.hits)
                  .slice(0, 30)
                  .map((v, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/10">
                      <span className="shrink-0 text-sm font-bold tabular-nums text-amber-400 w-8 text-right">{v.hits}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">hits</span>
                      {v.scans > 0 && (
                        <>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-primary">{v.scans}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">scans</span>
                        </>
                      )}
                      <span className="text-xs text-foreground/60">{countryLabel(v.country, v.city) || "Unknown"}</span>
                      <span className="hidden sm:block text-xs text-foreground/40">{v.userAgent ? parseDevice(v.userAgent) : ""}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{timeAgo(v.lastSeen)}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No visitor data yet</p>
            )}
          </Section>
        )}

        {/* Traffic trend */}
        <Section title="Traffic Trend" subtitle="30-day page views with weekly comparison">
          <TrafficChart data={dailyViews} />
        </Section>

        {/* Analytics grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Event breakdown — vertical bar chart */}
          <Section title="Activity Breakdown" subtitle="Last 200 events by type">
            <BarChart items={eventBarItems} />
          </Section>

          {/* Bot vs Real */}
          <Section title="Traffic Quality" subtitle="Real users vs bots, 30 days">
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{(100 - botPct)}%</p>
                <p className="text-[11px] text-muted-foreground">real traffic</p>
              </div>
              <div className="flex-1 h-4 rounded-full bg-muted/50 overflow-hidden flex">
                <div className="h-full rounded-l-full bg-green-500 transition-all" style={{ width: `${100 - botPct}%` }} />
                <div className="h-full rounded-r-full bg-red-500/60 transition-all" style={{ width: `${botPct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-green-400">{realHits.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Real Users</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-red-400">{botHits.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground">Bots</p>
              </div>
            </div>
          </Section>

          {/* Countries — donut */}
          <Section title="Top Countries" subtitle="30-day geographic distribution">
            {countryItems.length > 0 ? (
              <DonutChart items={countryItems} centerLabel="events" />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No geo data yet</p>
            )}
          </Section>

          {/* Top Cities — ranked list */}
          <Section title="Top Cities" subtitle="30-day activity by city">
            {cityItems.length > 0 ? (
              <RankedList items={cityItems} />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No city data yet</p>
            )}
          </Section>

          {/* Browser — donut */}
          <Section title="Browsers" subtitle="By page views">
            {browserItems.length > 0 ? (
              <DonutChart items={browserItems} centerLabel="views" />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No data</p>
            )}
          </Section>

          {/* Devices — donut */}
          <Section title="Devices" subtitle="By page views">
            {deviceItems.length > 0 ? (
              <DonutChart items={deviceItems} centerLabel="views" />
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No data</p>
            )}
          </Section>
        </div>

        {/* Top scanners */}
        {topScanners.length > 0 && (
          <Section title="Top Scanners" subtitle="Most active scanners, 30 days">
            <div className="grid gap-2 sm:grid-cols-2">
              {topScanners.map((v, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/20 bg-muted/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold tabular-nums text-muted-foreground w-4">#{i + 1}</span>
                    <span className="text-sm font-bold tabular-nums text-primary">{v.scans}</span>
                    <span className="text-xs text-muted-foreground">scans</span>
                    <span className="mx-1 text-border/40">|</span>
                    <span className="text-xs text-foreground/70">{countryLabel(v.country, v.city) || "Unknown"}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{v.hits} hits</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent activity */}
        <Section title="Recent Activity" subtitle="Last 10 events">
          <div className="space-y-1.5">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/10">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${EVENT_BADGE_STYLES[e.event] ?? "bg-zinc-500/15 text-zinc-300"}`}>
                  {e.event}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground/70">
                  {e.user_name || e.user_email || "anon"}
                </span>
                <span className="hidden sm:block shrink-0 text-xs text-foreground/50">
                  {countryLabel(e.country, e.city)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {timeAgo(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Registered Users table */}
        <Section title={`Registered Users`} subtitle={`${totalUsers} total accounts`}>
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
                    <th className="hidden sm:table-cell px-3 py-2">Country</th>
                    <th className="px-3 py-2 text-right">Scans</th>
                    <th className="px-3 py-2 text-right">Signed Up</th>
                  </tr>
                </thead>
                <tbody>
                  {userScanStats.map((u) => (
                    <tr key={u.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="px-3 py-2 text-foreground">{u.name || "\u2014"}</td>
                      <td className="px-3 py-2 text-foreground/70">{u.email}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.tier === "pro" ? "bg-primary/15 text-primary" : u.tier === "lifetime" ? "bg-purple-500/15 text-purple-300" : "bg-zinc-500/15 text-zinc-300"}`}>
                          {u.tier}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2 text-xs text-foreground/50">{u.country || "\u2014"}</td>
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

        {/* User Feedback */}
        <Section title={`User Feedback`} subtitle={`${feedback.length} messages`}>
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

        {/* Newsletter */}
        <Section title={`Newsletter`} subtitle={`${newsletterCount} active subscribers`}>
          {newsletterSubs.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm">No subscribers yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {newsletterSubs.map((s) => (
                <div key={s.id} className={`flex items-center justify-between gap-3 rounded-lg border border-border/20 px-4 py-3 ${s.unsubscribed_at ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="truncate text-sm font-medium text-foreground">{s.email}</span>
                    {s.name && <span className="hidden sm:block text-xs text-muted-foreground">{s.name}</span>}
                    {s.country && <span className="hidden sm:block rounded-full bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">{s.country}</span>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(s.subscribed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Abuse Flags */}
        <Section title={`Security — Abuse Flags`} subtitle={`${abuseFlags.length} total, ${unresolvedAbuseCount} unresolved`}>
          {abuseFlags.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <CheckCheck className="mb-2 h-8 w-8 text-green-400/40" />
              <p className="text-sm">No abuse flags. All clear.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {abuseFlags.map((f) => (
                <div key={f.id} className={`flex items-center justify-between gap-3 rounded-lg border border-border/20 px-4 py-3 ${f.resolved ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">{f.reason}</span>
                    <span className="truncate text-sm text-foreground/70">{f.user_email || "\u2014"}</span>
                    <span className="hidden sm:block text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {!f.resolved && (
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
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
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-red-400 hover:text-red-300"
                        onClick={async () => {
                          await fetch(`/api/admin/users/${f.user_id}/suspend`, { method: "POST", credentials: "include" });
                        }}
                      >
                        <Ban className="h-3 w-3" /> Suspend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
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

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function TestEmailButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const send = async () => {
    setStatus("sending");
    try {
      const res = await fetch("/api/admin/test-email", { credentials: "include" });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      onClick={send}
      disabled={status === "sending"}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
    >
      {status === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
      {status === "idle" && "Send Test Email"}
      {status === "sending" && "Sending…"}
      {status === "sent" && "Sent ✓"}
      {status === "error" && "Failed"}
    </button>
  );
}
