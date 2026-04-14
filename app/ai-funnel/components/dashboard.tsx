"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
  LineChart, Line, AreaChart, Area
} from "recharts"
import { 
  ArrowLeft, TrendingUp, Users, CheckCircle2, Clock, 
  BarChart3, Shield, UserCheck, Loader2 
} from "lucide-react"
import { DateRangePickerWithPresets } from "@/components/e2e/common/DateRangePickerWithPresets"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Colors
const STAGE_COLORS: Record<string, string> = {
  totalAssigned: "#cbd5e1",
  totalAi: "#94a3b8",
  zaloSuccess: "#8b5cf6",
  summary: "#94a3b8",
  contacted: "#60a5fa",
  qualified: "#3b82f6",
  negotiation: "#fbbf24",
  inspection: "#a78bfa",
  completed: "#34d399",
  deposited: "#2dd4bf",
  closed: "#10b981",
  failed: "#f87171",
  unknown: "#94a3b8",
}

const SENTIMENT_COLORS: Record<string, string> = {
  willing: "#10b981",
  hesitant: "#f59e0b",
  want_human: "#6366f1",
  angry: "#ef4444",
  ghosting: "#64748b",
  bot_detected: "#f43f5e",
}

const SENTIMENT_LABELS: Record<string, string> = {
  willing: "Willing",
  hesitant: "Hesitant",
  want_human: "Want Human",
  angry: "Angry",
  ghosting: "Ghosting",
  bot_detected: "Bot Detected",
}

const PIE_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ef4444", "#94a3b8", "#f43f5e"]

const STAGE_LABELS: Record<string, string> = {
  totalAssigned: "Total Assigned Leads",
  totalAi: "Total AI Leads",
  zaloSuccess: "Zalo Success",
  summary: "Có AI Summary",
  contacted: "Contacted",
  qualified: "Strong Qualified",
  negotiation: "Negotiation",
  inspection: "Inspection",
  completed: "Completed",
  deposited: "Deposited",
  closed: "Closed (CRM)",
  failed: "Failed",
  unknown: "Unknown",
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—"
  return n.toLocaleString("vi-VN")
}

function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—"
  return `${n}%`
}

function formatHours(h: number | null | undefined): string {
  if (h == null) return "—"
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${Math.round(h * 10) / 10}h`
  const days = Math.round((h / 24) * 10) / 10
  return `${days}d`
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—"
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  return n.toLocaleString("vi-VN")
}

function TrendChart({ 
  data, 
  dataKey, 
  title, 
  subtitle, 
  color = "#3b82f6", 
  suffix = "" 
}: { 
  data: any[], 
  dataKey: string, 
  title: string, 
  subtitle?: string,
  color?: string,
  suffix?: string
}) {
  if (!data || data.length === 0) return null
  
  return (
    <Card className="flex flex-col border-none shadow-sm bg-muted/30 pb-4">
      <CardHeader className="pb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</p>
        {subtitle && <p className="text-sm font-bold leading-none mt-1">{subtitle}</p>}
      </CardHeader>
      <CardContent className="h-[100px] pt-2 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
            <XAxis dataKey="week" hide={true} />
            <YAxis hide={true} domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ fontSize: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
              labelFormatter={(val) => {
                const d = new Date(val)
                return `Tuần ${d.getDate()}/${d.getMonth() + 1}`
              }}
              formatter={(value: any) => [`${value}${suffix}`, ""]}
            />
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              fillOpacity={1} 
              fill={`url(#gradient-${dataKey})`}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary" }: {
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  color?: string
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4">
        {Icon && (
          <div className={`rounded-lg bg-primary/10 p-2.5 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SECTION 1: Volume
// ============================================================================
function VolumeSection({ data }: { data: any }) {
  const { volume } = data
  const stageData = (volume.stageDistribution || [])
    .sort((a: any, b: any) => b.count - a.count)
    .map((s: any) => ({
      ...s,
      label: STAGE_LABELS[s.stage] || s.stage,
      fill: STAGE_COLORS[s.stage] || "#94a3b8",
    }))

  const qualifiedData = [
    { name: "Strong Qualified", value: volume.qualifiedDistribution?.strongQualified || 0 },
    { name: "Weak Qualified", value: volume.qualifiedDistribution?.weakQualified || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Tổng AI Leads" value={formatNumber(volume.totalAiLeads)} icon={Users} subtitle="Từ workflow" />
        <StatCard title="Có Summary" value={formatNumber(volume.aiLeadsWithSummary)} icon={BarChart3} subtitle={`${volume.totalAiLeads > 0 ? Math.round(volume.aiLeadsWithSummary / volume.totalAiLeads * 100) : 0}% tổng`} />
        <StatCard title="Đang Active" value={formatNumber(volume.active)} icon={TrendingUp} color="text-emerald-500" subtitle="contacted / negotiation / inspection" />
        <StatCard title="Closed (CRM)" value={formatNumber(volume.closed)} icon={CheckCircle2} color="text-blue-500" subtitle="COMPLETED + DEPOSIT_PAID" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Distribution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Phân bổ theo Stage</CardTitle>
            <CardDescription>Snapshot mới nhất của từng lead</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="label" type="category" width={100} fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, _: any, props: any) => [`${value} (${props.payload.percentage}%)`, "Leads"]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stageData.map((entry: any, idx: number) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Qualified Distribution */}
        <div className="space-y-4">
          <TrendChart 
            data={data.weeklyTrends} 
            dataKey="totalLeads" 
            title="Tăng trưởng Volume" 
            subtitle="Số lượng AI leads theo tuần" 
            color="#6366f1"
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Qualified</CardTitle>
              <CardDescription>Phân loại theo ảnh xe</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qualifiedData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                      strokeWidth={2}
                    >
                      {qualifiedData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[0] }} />
                  <span className="text-xs">Strong ({formatPercent(volume.qualifiedDistribution?.strongQualifiedRate)})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[1] }} />
                  <span className="text-xs">Weak ({formatPercent(volume.qualifiedDistribution?.weakQualifiedRate)})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 2: Funnel Conversion
// ============================================================================
function ConversionSection({ data }: { data: any }) {
  const { conversion } = data
  const { stageReachRates, stageToStage, negotiationAnalysis } = conversion

  const funnelData = (stageReachRates || [])
    .filter((s: any) => s.stage !== 'failed')
    .map((s: any) => ({
      name: STAGE_LABELS[s.stage] || s.stage,
      value: s.count,
      rate: s.rate,
      fill: STAGE_COLORS[s.stage] || "#94a3b8",
    }))

  return (
    <div className="space-y-6">
      {/* Stage Reach Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage Reach Rate</CardTitle>
          <CardDescription>Unique leads đã từng xuất hiện ở từng stage (từ lịch sử snapshots)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number, _: any, props: any) => [`${value} leads (${props.payload.rate}%)`, "Reach"]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {funnelData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right text-muted-foreground font-normal text-xs">% Baseline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stageReachRates || []).map((s: any, idx: number) => {
                let baselineText = "---"
                if (s.stage === 'totalAssigned') baselineText = "N/A"
                else if (s.stage === 'totalAi') baselineText = "của tổng leads được giao"
                else baselineText = "của tổng leads được giao"

                return (
                  <TableRow key={s.stage}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage] || "#94a3b8" }} />
                        {STAGE_LABELS[s.stage] || s.stage}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(s.count)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatPercent(s.rate)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{baselineText}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage-to-Stage Conversion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage-to-Stage Conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(stageToStage || []).map((t: any, idx: number) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {STAGE_LABELS[t.from]} → {STAGE_LABELS[t.to]} <span className="text-xs ml-1 opacity-70">({formatNumber(t.fromCount)} → {formatNumber(t.toCount)})</span>
                  </span>
                  <span className="font-semibold">{formatPercent(t.rate)}</span>
                </div>
                <Progress value={t.rate} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Negotiation Analysis */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Negotiation Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Leads có đàm phán (≥2 vòng)</p>
                  <p className="text-xl font-bold">{formatNumber(negotiationAnalysis?.leadsWithActualNegotiation)}</p>
                  <p className="text-xs text-muted-foreground">{formatPercent(negotiationAnalysis?.multiRoundPercentage)} trong nhóm có giá</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Chỉ 1 mức giá</p>
                  <p className="text-xl font-bold">{formatNumber(negotiationAnalysis?.leadsWithSinglePrice)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">TB % giảm giá</p>
                  <p className="text-xl font-bold">{formatPercent(negotiationAnalysis?.avgPriceReductionPercent)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Max vòng đàm phán</p>
                  <p className="text-xl font-bold">{negotiationAnalysis?.maxNegotiationRounds || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <TrendChart 
            data={data.weeklyTrends} 
            dataKey="strongQualifiedRate" 
            title="Xu hướng Chất lượng" 
            subtitle="% Strong Qualified theo tuần" 
            color="#10b981"
            suffix="%"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 3: SLA & Speed
// ============================================================================
function SlaSection({ data }: { data: any }) {
  const { sla } = data
  const { milestones, breachRates } = sla

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrendChart 
          data={data.weeklyTrends} 
          dataKey="medianTimeToPriceShared" 
          title="Xu hướng Phản hồi (Price Shared)" 
          subtitle="Median Time (h) theo tuần" 
          color="#f59e0b"
          suffix="h"
        />
        <TrendChart 
          data={data.weeklyTrends} 
          dataKey="medianTimeToVucarOffered" 
          title="Xu hướng Phản hồi (Vucar Price)" 
          subtitle="Median Time (h) theo tuần" 
          color="#ea580c"
          suffix="h"
        />
      </div>
      {/* SLA Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA Milestones</CardTitle>
          <CardDescription>Thời gian xử lý tại từng bước (Median / P90)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chỉ số</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Median</TableHead>
                <TableHead className="text-right">P90</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">N</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(milestones || []).map((m: any, idx: number) => {
                const isBreaching = m.median != null && m.median > m.target
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatHours(m.target)}</TableCell>
                    <TableCell className="text-right font-medium">{formatHours(m.median)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatHours(m.p90)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatHours(m.avg)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.count}</TableCell>
                    <TableCell className="text-right">
                      {m.median != null && (
                        <Badge variant={isBreaching ? "destructive" : "default"} className={!isBreaching ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                          {isBreaching ? "Breach" : "OK"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


    </div>
  )
}

// ============================================================================
// SECTION 4: AI Quality
// ============================================================================
function QualitySection({ data }: { data: any }) {
  const { quality } = data
  const { sentiment } = quality

  const mainMetrics: { label: string; value: string; desc: string; highlight?: string }[] = [
    { label: "Strong Qualified Rate (D1)", value: formatPercent(quality.strongQualifiedRate), desc: "% leads có ảnh xe" },
    { label: "Avg Negotiation Rounds (D2)", value: quality.avgNegotiationRounds?.toString() || "0", desc: "Leads ở negotiation/inspection" },
    { label: "Giảm Giá Thành Công (D3)", value: `${quality.leadsWithPriceReduction} (${formatPercent(quality.priceReductionRate)})`, desc: "price_customer giảm qua ≥2 snapshots" },
  ]

  const convTotal = quality.convergenceTotal || 1
  const sentimentStages = ['contacted', 'negotiation', 'inspection', 'failed', 'completed', 'deposited']

  return (
    <div className="space-y-8">
      {/* Existing KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainMetrics.map((m, idx) => (
          <Card key={idx} className="py-2">
            <CardContent className="pt-4 pb-2">
              <p className="text-xs text-muted-foreground font-medium">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.highlight || ""}`}>{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Seller Sentiment Subsection */}
      <div className="space-y-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold">Seller Sentiment & Escalation</h3>
        </div>

        {/* S3: Escalation Risk Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium">Escalation Rate</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold">{sentiment?.escalation?.rate}%</p>
                <p className="text-xs text-red-500 mb-1 font-medium">Target &lt; 5%</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">N = {sentiment?.escalation?.total} leads có sentiment</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium">Angry Count</p>
              <p className="text-2xl font-bold text-red-600">{sentiment?.escalation?.angry}</p>
              <Progress value={(sentiment?.escalation?.angry / (sentiment?.escalation?.total || 1)) * 100} className="h-1 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium">Want Human</p>
              <p className="text-2xl font-bold text-indigo-600">{sentiment?.escalation?.wantHuman}</p>
              <Progress value={(sentiment?.escalation?.wantHuman / (sentiment?.escalation?.total || 1)) * 100} className="h-1 mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-medium">Ghosting Proxy</p>
              <p className="text-2xl font-bold text-slate-600">{sentiment?.ghostingProxy?.rate}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{sentiment?.ghostingProxy?.count} active leads &gt; 48h im lặng</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* S1: Sentiment Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Phân bổ Sentiment (S1)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentiment?.distribution}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sentiment?.distribution?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [value, SENTIMENT_LABELS[name] || name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {sentiment?.distribution?.filter((d: any) => d.value > 0).map((d: any) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[d.name] }} />
                    <span className="text-[10px] truncate">{SENTIMENT_LABELS[d.name] || d.name} ({d.pct}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* S4: Negotiation Quality by Sentiment */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sentiment × Chất lượng đàm phán (S4)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] uppercase tracking-wider">
                    <TableHead>Sentiment</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Avg Rounds</TableHead>
                    <TableHead className="text-right">Avg Price Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(sentiment?.negotiationQuality || {}).map(([s, stats]: [string, any]) => (
                    <TableRow key={s}>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[s] }} />
                          <span className="text-xs font-medium">{SENTIMENT_LABELS[s] || s}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs py-2">{stats.count}</TableCell>
                      <TableCell className="text-right text-xs py-2 font-semibold text-indigo-600">{stats.avgRounds}</TableCell>
                      <TableCell className="text-right text-xs py-2 font-bold text-orange-600">{formatCurrency(stats.avgPriceGap)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* S2: Sentiment x Stage Cross-tab */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cross-tab: Sentiment × Stage (S2)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] uppercase">
                    <TableHead>Stage</TableHead>
                    {Object.keys(SENTIMENT_LABELS).map(s => (
                      <TableHead key={s} className="text-center">{SENTIMENT_LABELS[s]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sentimentStages.map(stage => (
                    <TableRow key={stage}>
                      <TableCell className="text-xs font-medium capitalize py-2">
                        {STAGE_LABELS[stage] || stage}
                      </TableCell>
                      {Object.keys(SENTIMENT_LABELS).map(s => {
                        const count = sentiment?.crossTab?.[stage]?.[s] || 0
                        return (
                          <TableCell key={s} className="text-center py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${count > 0 ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-muted-foreground opacity-20'}`}>
                              {count || '—'}
                            </span>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Convergence Speed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price Convergence Speed (D11)</CardTitle>
          <CardDescription>Số vòng đàm phán để chênh lệch giá ≤ 5%</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Chốt trong 1 vòng</span>
              <span className="font-medium">{quality.convergenceRounds?.round1 || 0} ({Math.round(((quality.convergenceRounds?.round1 || 0) / convTotal) * 100)}%)</span>
            </div>
            <Progress value={((quality.convergenceRounds?.round1 || 0) / convTotal) * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Chốt trong 2 vòng</span>
              <span className="font-medium">{quality.convergenceRounds?.round2 || 0} ({Math.round(((quality.convergenceRounds?.round2 || 0) / convTotal) * 100)}%)</span>
            </div>
            <Progress value={((quality.convergenceRounds?.round2 || 0) / convTotal) * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Cần ≥3 vòng</span>
              <span className="font-medium">{quality.convergenceRounds?.round3Plus || 0} ({Math.round(((quality.convergenceRounds?.round3Plus || 0) / convTotal) * 100)}%)</span>
            </div>
            <Progress value={((quality.convergenceRounds?.round3Plus || 0) / convTotal) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// SECTION 5: By PIC
// ============================================================================
function PicSection({ data }: { data: any }) {
  const { byPic } = data
  const [sortBy, setSortBy] = useState<string>("totalAiLeads")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortBy(col)
      setSortDir("desc")
    }
  }

  const sorted = [...(byPic || [])].sort((a: any, b: any) => {
    const mul = sortDir === "asc" ? 1 : -1
    return (a[sortBy] - b[sortBy]) * mul
  })

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-xs">{sortBy === col ? (sortDir === "desc" ? "↓" : "↑") : ""}</span>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metrics theo PIC</CardTitle>
        <CardDescription>Click cột để sort. Dữ liệu filter theo thời gian.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PIC</TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("totalAssignedLeads")}>
                Assigned Leads<SortIcon col="totalAssignedLeads" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("totalAiLeads")}>
                AI Leads<SortIcon col="totalAiLeads" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("aiUtilizationRate")}>
                AI Util %<SortIcon col="aiUtilizationRate" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("aiLeadWins")}>
                AI Wins<SortIcon col="aiLeadWins" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("aiLeadWinRate")}>
                AI Win Rate %<SortIcon col="aiLeadWinRate" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("slaInfoCollectedRate")}>
                SLA Info ≤24h<SortIcon col="slaInfoCollectedRate" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("slaInspectionBookedRate")}>
                SLA Insp ≤48h<SortIcon col="slaInspectionBookedRate" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p: any) => (
              <TableRow key={p.picId}>
                <TableCell className="font-medium max-w-[160px] truncate">{p.picName}</TableCell>
                <TableCell className="text-right font-medium text-slate-600">{p.totalAssignedLeads}</TableCell>
                <TableCell className="text-right">{p.totalAiLeads}</TableCell>
                <TableCell className="text-right">{formatPercent(p.aiUtilizationRate)}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">{p.aiLeadWins}</TableCell>
                <TableCell className="text-right">
                  <span className={p.aiLeadWinRate > 5 ? "text-emerald-500 font-bold" : ""}>
                    {formatPercent(p.aiLeadWinRate)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={p.slaInfoCollectedRate >= 80 ? "text-emerald-500" : p.slaInfoCollectedRate >= 50 ? "text-amber-500" : "text-destructive"}>
                    {formatPercent(p.slaInfoCollectedRate)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className={p.slaInspectionBookedRate >= 80 ? "text-emerald-500" : p.slaInspectionBookedRate >= 50 ? "text-amber-500" : "text-destructive"}>
                    {formatPercent(p.slaInspectionBookedRate)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Không có dữ liệu PIC
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Dashboard
// ============================================================================
export function AiFunnelDashboard({ 
  data, 
  loading = false, 
  filters, 
  onFilterChange 
}: { 
  data: any
  loading?: boolean
  filters?: { dateRange: any; picId: string }
  onFilterChange?: (newFilters: any) => void
}) {
  const picList = data?.picList || []
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold leading-none">AI Funnel Dashboard</h1>
            <p className="text-[10px] text-muted-foreground mt-1">Metrics từ AI leads pipeline</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />}
            
            <DateRangePickerWithPresets
              dateRange={filters?.dateRange}
              onDateRangeChange={(range) => onFilterChange?.({ dateRange: range })}
              className="w-[260px] h-9 text-xs"
            />

            <Select 
              value={filters?.picId || "all"} 
              onValueChange={(val) => onFilterChange?.({ picId: val })}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Chọn PIC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả PIC</SelectItem>
                {picList.map((pic: any) => (
                  <SelectItem key={pic.id} value={pic.id}>
                    {pic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 relative">
        {loading && data && (
          <div className="absolute inset-x-0 top-0 z-10 h-1 bg-primary/20 overflow-hidden">
            <div className="h-full bg-primary animate-progress-indeterminate" />
          </div>
        )}
        
        <Tabs defaultValue="volume">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="volume" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Volume
            </TabsTrigger>
            <TabsTrigger value="conversion" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Conversion
            </TabsTrigger>
            <TabsTrigger value="sla" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              SLA & Speed
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              AI Quality
            </TabsTrigger>
            <TabsTrigger value="pic" className="gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              Theo PIC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="volume" className="mt-6">
            <VolumeSection data={data} />
          </TabsContent>

          <TabsContent value="conversion" className="mt-6">
            <ConversionSection data={data} />
          </TabsContent>

          <TabsContent value="sla" className="mt-6">
            <SlaSection data={data} />
          </TabsContent>

          <TabsContent value="quality" className="mt-6">
            <QualitySection data={data} />
          </TabsContent>

          <TabsContent value="pic" className="mt-6">
            <PicSection data={data} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
