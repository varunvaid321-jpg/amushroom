"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Summary {
  totalUsers: number;
  totalScans: number;
  scansToday: number;
  uniqueVisitors7d: number;
}

interface DayCount {
  day: string;
  count: number;
}

interface SpeciesCount {
  species: string;
  count: number;
}

interface GeoRow {
  country: string;
  city: string;
  count: number;
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

interface VisitorSummary {
  totalHits: number;
  botHits: number;
  browserHits: number;
  unknownHits: number;
  uniqueIPs: number;
}

async function adminFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api/admin/${endpoint}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scansByDay, setScansByDay] = useState<DayCount[]>([]);
  const [signupsByDay, setSignupsByDay] = useState<DayCount[]>([]);
  const [topSpecies, setTopSpecies] = useState<SpeciesCount[]>([]);
  const [geo, setGeo] = useState<GeoRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorSummary, setVisitorSummary] = useState<VisitorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !isAdmin) return;

    Promise.all([
      adminFetch<Summary>("summary").then(setSummary),
      adminFetch<{ data: DayCount[] }>("scans-by-day?days=30").then((r) => setScansByDay(r.data)),
      adminFetch<{ data: DayCount[] }>("signups-by-day?days=30").then((r) => setSignupsByDay(r.data)),
      adminFetch<{ data: SpeciesCount[] }>("species?days=30").then((r) => setTopSpecies(r.data)),
      adminFetch<{ data: GeoRow[] }>("geo?days=30").then((r) => setGeo(r.data)),
      adminFetch<{ events: EventRow[] }>("events?limit=50").then((r) => setEvents(r.events)),
      adminFetch<{ summary: VisitorSummary; visitors: VisitorRow[] }>("visitors?days=30").then((r) => {
        setVisitorSummary(r.summary);
        setVisitors(r.visitors);
      }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isAdmin]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="h-12 w-12" />
        <p>Admin access required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <Container>
        <h1 className="mb-8 font-[family-name:var(--font-heading)] text-3xl font-bold text-foreground">
          Admin Dashboard
        </h1>

        {/* Summary Cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Users" value={summary?.totalUsers ?? 0} />
          <StatCard label="Total Scans" value={summary?.totalScans ?? 0} />
          <StatCard label="Scans Today" value={summary?.scansToday ?? 0} />
          <StatCard label="Visitors (7d)" value={summary?.uniqueVisitors7d ?? 0} />
        </div>

        {/* Charts */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <ChartCard title="Scans / Day (30d)">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={scansByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,100,0.15)" />
                <XAxis dataKey="day" tick={{ fill: "#f0e4cc", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#f0e4cc", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2a1a", border: "1px solid rgba(100,140,100,0.3)", color: "#f0e4cc" }} />
                <Line type="monotone" dataKey="count" stroke="#c8956c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Signups / Day (30d)">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={signupsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,100,0.15)" />
                <XAxis dataKey="day" tick={{ fill: "#f0e4cc", fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#f0e4cc", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1a2a1a", border: "1px solid rgba(100,140,100,0.3)", color: "#f0e4cc" }} />
                <Line type="monotone" dataKey="count" stroke="#3a5a3a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Top Species */}
        <ChartCard title="Top 10 Species (30d)" className="mb-8">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSpecies} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,140,100,0.15)" />
              <XAxis type="number" tick={{ fill: "#f0e4cc", fontSize: 11 }} />
              <YAxis
                dataKey="species"
                type="category"
                tick={{ fill: "#f0e4cc", fontSize: 11 }}
                width={110}
              />
              <Tooltip contentStyle={{ background: "#1a2a1a", border: "1px solid rgba(100,140,100,0.3)", color: "#f0e4cc" }} />
              <Bar dataKey="count" fill="#c8956c" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Geography */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <TableCard title="Geography (30d)">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-3 py-2">Country</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2 text-right">Events</th>
                </tr>
              </thead>
              <tbody>
                {geo.map((r, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2 text-foreground">{r.country}</td>
                    <td className="px-3 py-2 text-foreground/80">{r.city || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.count}</td>
                  </tr>
                ))}
                {geo.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No data yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>

          <TableCard title="Recent Events">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/50 text-left text-muted-foreground">
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-border/30">
                      <td className="px-3 py-2 text-foreground">{e.event}</td>
                      <td className="px-3 py-2 text-foreground/80">{e.user_name || e.user_email || (e.user_id ? `#${e.user_id}` : "anon")}</td>
                      <td className="px-3 py-2 text-foreground/80">
                        {e.country ? `${e.city || ""}, ${e.country}` : e.ip?.slice(0, 15) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>

        {/* Visitor / Bot Breakdown */}
        {visitorSummary && (
          <div className="mb-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Visitor Breakdown (30d)
            </h2>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatCard label="Total Hits" value={visitorSummary.totalHits} />
              <StatCard label="Unique IPs" value={visitorSummary.uniqueIPs} />
              <StatCard label="Browser Hits" value={visitorSummary.browserHits} />
              <StatCard label="Bot Hits" value={visitorSummary.botHits} />
              <StatCard label="Unknown Hits" value={visitorSummary.unknownHits} />
            </div>
            <Card className="border-border/50 bg-card">
              <CardContent className="p-4">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
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
                        <tr key={i} className="border-b border-border/30">
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              v.type === "bot" ? "bg-red-500/20 text-red-300" :
                              v.type === "browser" ? "bg-green-500/20 text-green-300" :
                              "bg-yellow-500/20 text-yellow-300"
                            }`}>
                              {v.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground/80">{v.ip || "—"}</td>
                          <td className="px-3 py-2 text-foreground/80">
                            {v.country ? `${v.city || ""} ${v.country}`.trim() : "—"}
                          </td>
                          <td className="max-w-[260px] px-3 py-2">
                            <span className="block truncate text-xs text-muted-foreground" title={v.userAgent || ""}>
                              {v.userAgent || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{v.hits}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground/80">{v.scans || 0}</td>
                        </tr>
                      ))}
                      {visitors.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                            No visitor data yet — will populate going forward
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Container>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-4 text-center">
        <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`border-border/50 bg-card ${className || ""}`}>
      <CardContent className="p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}
