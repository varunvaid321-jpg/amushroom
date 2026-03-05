"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Minus, Mail, CheckCircle, XCircle, MessageSquare, AlertTriangle, DollarSign, Ban, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Summary {
  totalUsers: number;
  totalScans: number;
  scansToday: number;
  uniqueVisitors7d: number;
}

interface DayCount { day: string; count: number; }
interface SpeciesCount { species: string; count: number; }
interface GeoRow { country: string; city: string; count: number; }

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

interface VisitorSummary {
  totalHits: number;
  botHits: number;
  browserHits: number;
  unknownHits: number;
  uniqueIPs: number;
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

interface FunnelData {
  pageViews: number;
  signups: number;
  logins: number;
  scans: number;
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

interface RevenueData {
  proSubscriptions: number;
  mrr: number;
  totalRevenue: number;
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

// ── Constants ──────────────────────────────────────────────────────────────────

const COPPER = "#c8956c";
const FOREST = "#3a5a3a";
const SAGE = "#6a9a6a";
const CREAM = "#f0e4cc";
const CARD_BG = "#1a2a1a";
const GRID = "rgba(100,140,100,0.12)";

const TOOLTIP_STYLE = {
  background: "#0e1a0e",
  border: "1px solid rgba(200,149,108,0.3)",
  borderRadius: 8,
  color: CREAM,
  fontSize: 12,
};

const TICK = { fill: CREAM, fontSize: 11 };

const PIE_COLORS: Record<string, string> = {
  browser: SAGE,
  bot: "#e05c5c",
  unknown: "#8a7a5a",
  other: "#6a6a8a",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function delta(recent: DayCount[], half: number) {
  const sorted = [...recent].sort((a, b) => a.day.localeCompare(b.day));
  const cur = sorted.slice(-half).reduce((s, d) => s + d.count, 0);
  const prev = sorted.slice(-half * 2, -half).reduce((s, d) => s + d.count, 0);
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function fmtDay(v: string) { return v.slice(5); }

function mergeDays(a: DayCount[], b: DayCount[], keyA: string, keyB: string) {
  const map: Record<string, Record<string, number>> = {};
  for (const r of a) { map[r.day] = { ...(map[r.day] || {}), [keyA]: r.count }; }
  for (const r of b) { map[r.day] = { ...(map[r.day] || {}), [keyB]: r.count }; }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vals]) => ({ day, [keyA]: vals[keyA] ?? 0, [keyB]: vals[keyB] ?? 0 }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  pct,
  sub,
}: {
  label: string;
  value: number;
  pct?: number | null;
  sub?: string;
}) {
  return (
    <Card className="border-border/40 bg-card">
      <CardContent className="p-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
        <div className="mt-1 flex items-center gap-1.5">
          {pct !== undefined && pct !== null ? (
            <>
              {pct > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              ) : pct < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={`text-xs font-medium ${pct > 0 ? "text-green-400" : pct < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {pct > 0 ? "+" : ""}{pct}% vs prior period
              </span>
            </>
          ) : sub ? (
            <span className="text-xs text-muted-foreground">{sub}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`border-border/40 bg-card ${className ?? ""}`}>
      <CardContent className="p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

// Custom gradient area chart tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [days, setDays] = useState(30);
  const [emailTestState, setEmailTestState] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [emailTestMsg, setEmailTestMsg] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [scansByDay, setScansByDay] = useState<DayCount[]>([]);
  const [signupsByDay, setSignupsByDay] = useState<DayCount[]>([]);
  const [pageViewsByDay, setPageViewsByDay] = useState<DayCount[]>([]);
  const [topSpecies, setTopSpecies] = useState<SpeciesCount[]>([]);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorSummary, setVisitorSummary] = useState<VisitorSummary | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [abuseFlags, setAbuseFlags] = useState<AbuseFlag[]>([]);
  const [unresolvedAbuseCount, setUnresolvedAbuseCount] = useState(0);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [userScanStats, setUserScanStats] = useState<UserScanStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setLoading(true);
    Promise.all([
      adminFetch<Summary>("summary").then(setSummary),
      adminFetch<{ data: DayCount[] }>(`scans-by-day?days=${days}`).then((r) => setScansByDay(r.data)),
      adminFetch<{ data: DayCount[] }>(`signups-by-day?days=${days}`).then((r) => setSignupsByDay(r.data)),
      adminFetch<{ data: DayCount[] }>(`page-views-by-day?days=${days}`).then((r) => setPageViewsByDay(r.data)),
      adminFetch<{ data: SpeciesCount[] }>(`species?days=${days}`).then((r) => setTopSpecies(r.data)),
      adminFetch<{ data: GeoRow[] }>(`geo?days=${days}`).then((r) => setGeo(r.data)),
      adminFetch<{ events: EventRow[] }>("events?limit=100").then((r) => setEvents(r.events)),
      adminFetch<{ summary: VisitorSummary; visitors: VisitorRow[] }>(`visitors?days=${days}`).then((r) => {
        setVisitorSummary(r.summary);
        setVisitors(r.visitors);
      }),
      adminFetch<FunnelData>(`funnel?days=${days}`).then(setFunnel),
      adminFetch<{ feedback: FeedbackRow[] }>("feedback").then((r) => setFeedback(r.feedback)),
      adminFetch<{ flags: AbuseFlag[]; unresolvedCount: number }>("abuse-flags").then((r) => {
        setAbuseFlags(r.flags);
        setUnresolvedAbuseCount(r.unresolvedCount);
      }),
      adminFetch<RevenueData>("revenue").then(setRevenue).catch(() => {}),
      adminFetch<{ users: UserScanStat[] }>("user-scan-stats").then((r) => setUserScanStats(r.users)).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin, days]);

  // Derived data
  const activityChart = useMemo(
    () => mergeDays(pageViewsByDay, scansByDay, "views", "scans"),
    [pageViewsByDay, scansByDay],
  );

  const scansDelta = useMemo(() => delta(scansByDay, Math.ceil(days / 2)), [scansByDay, days]);
  const signupsDelta = useMemo(() => delta(signupsByDay, Math.ceil(days / 2)), [signupsByDay, days]);
  const viewsDelta = useMemo(() => delta(pageViewsByDay, Math.ceil(days / 2)), [pageViewsByDay, days]);

  const trafficPie = useMemo(() => {
    if (!visitorSummary) return [];
    return [
      { name: "browser", value: visitorSummary.browserHits },
      { name: "bot", value: visitorSummary.botHits },
      { name: "unknown", value: visitorSummary.unknownHits },
    ].filter((d) => d.value > 0);
  }, [visitorSummary]);

  const funnelBars = useMemo(() => {
    if (!funnel) return [];
    const max = Math.max(funnel.pageViews, 1);
    return [
      { stage: "Page Views", count: funnel.pageViews, pct: 100 },
      { stage: "Signups", count: funnel.signups, pct: Math.round((funnel.signups / max) * 100) },
      { stage: "Logins", count: funnel.logins, pct: Math.round((funnel.logins / max) * 100) },
      { stage: "Scans", count: funnel.scans, pct: Math.round((funnel.scans / max) * 100) },
    ];
  }, [funnel]);

  // ── Auth guards ──

  if (authLoading) return <Spinner />;
  if (!user || !isAdmin) {
    if (typeof window !== "undefined") window.location.href = "/";
    return <Spinner />;
  }
  if (loading) return <Spinner />;

  // ── Render ──

  return (
    <div className="min-h-screen py-8">
      <Container>
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
            Analytics
          </h1>
          <div className="flex items-center gap-3">
            {/* Email test */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={emailTestState === "sending"}
                onClick={async () => {
                  setEmailTestState("sending");
                  setEmailTestMsg("");
                  try {
                    const r = await adminFetch<{ ok: boolean; to: string; error?: string }>("test-email");
                    if (r.ok) { setEmailTestState("ok"); setEmailTestMsg(`Sent to ${r.to}`); }
                    else { setEmailTestState("fail"); setEmailTestMsg(r.error ?? "Failed"); }
                  } catch {
                    setEmailTestState("fail");
                    setEmailTestMsg("Request failed");
                  }
                }}
                className="gap-1.5 text-xs"
              >
                {emailTestState === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Test Email
              </Button>
              {emailTestState === "ok" && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="h-3.5 w-3.5" />{emailTestMsg}</span>}
              {emailTestState === "fail" && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="h-3.5 w-3.5" />{emailTestMsg}</span>}
            </div>
            <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/20 p-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  days === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Abuse alert banner */}
        {unresolvedAbuseCount > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <p className="text-sm font-medium text-red-300">
              {unresolvedAbuseCount} unresolved abuse flag{unresolvedAbuseCount !== 1 ? "s" : ""} — review in the Abuse tab
            </p>
          </div>
        )}

        {/* KPI row */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Users" value={summary?.totalUsers ?? 0} sub="all time" />
          <KpiCard label="Total Scans" value={summary?.totalScans ?? 0} pct={scansDelta} />
          <KpiCard label="Signups" value={signupsByDay.reduce((s, d) => s + d.count, 0)} pct={signupsDelta} sub={`last ${days}d`} />
          <KpiCard label="Page Views" value={pageViewsByDay.reduce((s, d) => s + d.count, 0)} pct={viewsDelta} sub={`last ${days}d`} />
          <KpiCard label="Pro Subs" value={revenue?.proSubscriptions ?? 0} sub="active" />
          <KpiCard label="MRR" value={revenue?.mrr ?? 0} sub="cents/mo" />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="border border-border/50 bg-muted/20">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="traffic">Traffic</TabsTrigger>
            <TabsTrigger value="species">Species</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="abuse" className="relative">
              Abuse
              {unresolvedAbuseCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/80 px-1.5 text-[10px] font-bold text-white">
                  {unresolvedAbuseCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="feedback" className="relative">
              Feedback
              {feedback.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/80 px-1.5 text-[10px] font-bold text-primary-foreground">
                  {feedback.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="space-y-6">
            {/* Combined area chart */}
            <Section title={`Page Views & Scans — last ${days} days`}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={activityChart} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SAGE} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={SAGE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COPPER} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COPPER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="day" tick={TICK} tickFormatter={fmtDay} />
                  <YAxis tick={TICK} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ color: CREAM, fontSize: 12 }} />
                  <Area type="monotone" dataKey="views" name="Page Views" stroke={SAGE} strokeWidth={2} fill="url(#gViews)" dot={false} />
                  <Area type="monotone" dataKey="scans" name="Scans" stroke={COPPER} strokeWidth={2} fill="url(#gScans)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>

            {/* Signups + Funnel side by side */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title={`Signups — last ${days} days`}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={signupsByDay} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={FOREST} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={FOREST} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                    <XAxis dataKey="day" tick={TICK} tickFormatter={fmtDay} />
                    <YAxis tick={TICK} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="Signups" stroke={SAGE} strokeWidth={2} fill="url(#gSignups)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Section>

              <Section title={`Conversion Funnel — last ${days} days`}>
                <div className="space-y-3 pt-1">
                  {funnelBars.map((f) => (
                    <div key={f.stage}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground/80">{f.stage}</span>
                        <span className="tabular-nums text-muted-foreground">{f.count.toLocaleString()} ({f.pct}%)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${f.pct}%`, background: COPPER, opacity: 0.6 + f.pct / 250 }}
                        />
                      </div>
                    </div>
                  ))}
                  {funnelBars.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No funnel data yet</p>
                  )}
                </div>
              </Section>
            </div>
          </TabsContent>

          {/* ── Traffic tab ── */}
          <TabsContent value="traffic" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Bot vs browser donut */}
              <Section title="Traffic Type Breakdown">
                {trafficPie.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={trafficPie}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                          labelLine={false}
                        >
                          {trafficPie.map((entry) => (
                            <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? "#888"} />
                          ))}
                        </Pie>
                        <Tooltip
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v: any) => [typeof v === "number" ? v.toLocaleString() : v]}
                          contentStyle={TOOLTIP_STYLE}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 text-xs">
                      {trafficPie.map((e) => (
                        <span key={e.name} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[e.name] }} />
                          <span className="text-foreground/70">{e.name}</span>
                          <span className="tabular-nums font-medium text-foreground">{e.value.toLocaleString()}</span>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">Traffic data populates as visitors arrive</p>
                )}
              </Section>

              {/* Geo table */}
              <Section title={`Geography — last ${days} days`}>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: CARD_BG }}>
                      <tr className="border-b border-border/50 text-left text-muted-foreground">
                        <th className="px-2 py-2">Country</th>
                        <th className="px-2 py-2">City</th>
                        <th className="px-2 py-2 text-right">Events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geo.map((r, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/10">
                          <td className="px-2 py-2 text-foreground">
                            <span className="mr-1.5">{countryFlag(r.country)}</span>{r.country}
                          </td>
                          <td className="px-2 py-2 text-foreground/70">{r.city || "—"}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-foreground">{r.count}</td>
                        </tr>
                      ))}
                      {geo.length === 0 && (
                        <tr><td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">No geo data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>

            {/* Visitor table */}
            <Section title={`Visitor Detail — last ${days} days (top 200 IPs)`}>
              <div className="max-h-[480px] overflow-y-auto">
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
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Visitor data populates going forward</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          </TabsContent>

          {/* ── Species tab ── */}
          <TabsContent value="species" className="space-y-6">
            <Section title={`Top Identified Species — last ${days} days`}>
              {topSpecies.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(300, topSpecies.length * 38)}>
                  <BarChart data={topSpecies} layout="vertical" margin={{ left: 140, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={TICK} />
                    <YAxis
                      dataKey="species"
                      type="category"
                      tick={TICK}
                      width={130}
                      tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 20) + "…" : v}
                    />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [typeof v === "number" ? v.toLocaleString() : v, "identifications"]}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" fill={COPPER} radius={[0, 5, 5, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">No species data yet</p>
              )}
            </Section>

            {/* Scans-per-day for context */}
            <Section title={`Scan Volume — last ${days} days`}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={scansByDay} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="gScans2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COPPER} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COPPER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="day" tick={TICK} tickFormatter={fmtDay} />
                  <YAxis tick={TICK} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="count" name="Scans" stroke={COPPER} strokeWidth={2} fill="url(#gScans2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          </TabsContent>

          {/* ── Activity tab ── */}
          <TabsContent value="activity">
            <Section title="Recent Events (last 100)">
              <div className="max-h-[600px] overflow-y-auto">
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
          </TabsContent>

          {/* ── Abuse tab ── */}
          <TabsContent value="abuse">
            <Section title={`Abuse Flags (${abuseFlags.length})`}>
              {abuseFlags.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
                  <CheckCheck className="mb-2 h-8 w-8 text-green-400/40" />
                  <p className="text-sm">No abuse flags. All clear.</p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
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
          </TabsContent>

          {/* ── Users tab ── */}
          <TabsContent value="users">
            <Section title={`Users (${userScanStats.length})`}>
              {userScanStats.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No users yet</p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: CARD_BG }}>
                      <tr className="border-b border-border/50 text-left text-muted-foreground">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Tier</th>
                        <th className="px-3 py-2 text-right">Total Scans</th>
                        <th className="px-3 py-2 text-right">Last Scan</th>
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
                            {u.lastScanAt ? new Date(u.lastScanAt).toLocaleDateString() : "—"}
                          </td>
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
          </TabsContent>

          {/* ── Feedback tab ── */}
          <TabsContent value="feedback">
            <Section title={`User Feedback (${feedback.length})`}>
              {feedback.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center text-muted-foreground">
                  <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm">No feedback submitted yet.</p>
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
                            {contact && (
                              <span className="ml-2 text-xs text-muted-foreground">{contact}</span>
                            )}
                            {f.also_email === 1 && (
                              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">wants reply</span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(f.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{f.message}</p>
                        {f.ip && (
                          <p className="mt-2 font-mono text-[11px] text-muted-foreground/50">IP: {f.ip}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </TabsContent>
        </Tabs>
      </Container>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
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

function shortenUA(ua: string): string {
  const m = ua.match(/(?:Chrome|Firefox|Safari|Edge|OPR)\/[\d.]+/) ||
            ua.match(/(?:bot|crawler|spider)/i);
  return m ? m[0] : ua.slice(0, 30);
}
