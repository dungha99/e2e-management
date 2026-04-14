"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
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
  BarChart3, Shield, UserCheck, Loader2, MessageSquare, Filter
} from "lucide-react"
import { DateRangePickerWithPresets } from "@/components/e2e/common/DateRangePickerWithPresets"
import { DrilldownPanel } from "./DrilldownPanel"
import { BotAtRiskCard } from "./BotAtRiskCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Check, ChevronDown, X, Info } from "lucide-react"
import { TooltipProvider, Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Colors
const STAGE_COLORS: Record<string, string> = {
  totalAi: "#94a3b8",
  summary: "#94a3b8",
  contacted: "#60a5fa",
  CONTACTED: "#60a5fa",
  qualified: "#3b82f6",
  negotiation: "#fbbf24",
  NEGOTIATION: "#fbbf24",
  inspection: "#a78bfa",
  INSPECTION: "#a78bfa",
  completed: "#34d399",
  COMPLETED: "#34d399",
  deposited: "#2dd4bf",
  DEPOSIT_PAID: "#2dd4bf",
  closed: "#10b981",
  failed: "#f87171",
  FAILED: "#f87171",
  unknown: "#94a3b8",
  UNKNOWN: "#94a3b8",
  UNDEFINED: "#94a3b8",
  CANNOT_CONTACT: "#f87171",
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
  summary: "Có AI Summary",
  contacted: "Contacted",
  CONTACTED: "Contacted",
  qualified: "Strong Qualified",
  negotiation: "Negotiation",
  NEGOTIATION: "Negotiation",
  inspection: "Inspection",
  INSPECTION: "Inspection",
  completed: "Completed",
  COMPLETED: "Completed",
  deposited: "Deposited",
  DEPOSIT_PAID: "Deposited",
  closed: "Closed (CRM)",
  failed: "Failed",
  FAILED: "Failed",
  unknown: "Unknown",
  UNKNOWN: "Unknown",
  UNDEFINED: "Undefined",
  CANNOT_CONTACT: "Cannot Contact",
}

const STAGE_LOGIC: Record<string, string> = {
  totalAssigned: "Tổng số leads được marketing chuyển vào CRM (baseline).",
  totalAi: "Unique leads đã bắt đầu vào AI Workflow ít nhất 1 lần.",
  summary: "Leads AI đã xử lý và tạo được Profile/Summary đầu tiên.",
  contacted: "Leads đã có tương tác thật sự (Contacted stage trong snapshots).",
  qualified: "Leads đã gửi ảnh xe thực tế (Had Car Image) trong snapshot.",
  negotiation: "Leads đã bắt đầu đàm phán giá (có Price Customer hoặc Negotiation stage).",
  inspection: "Leads đã hẹn lịch xem xe/kiểm định (có Inspection stage hoặc Inspection Date).",
  closed: "Leads đã hoàn thành giao dịch (Win) trên hệ thống CRM (Completed/Deposited).",
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

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary", onClick }: {
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  color?: string
  onClick?: () => void
}) {
  return (
    <Card 
      className={cn("py-4 transition-all", onClick && "cursor-pointer hover:border-blue-400 hover:shadow-md group")}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4">
        {Icon && (
          <div className={cn("rounded-lg bg-primary/10 p-2.5 transition-colors", color, onClick && "group-hover:bg-blue-500/10")}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate group-hover:text-blue-500 transition-colors">{title}</p>
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
function VolumeSection({ data, onDrilldown }: { data: any, onDrilldown: (title: string, ids: string[]) => void }) {
  const { volume } = data
  const stageData = (volume.stageDistribution || [])
    .sort((a: any, b: any) => b.count - a.count)
    .map((s: any) => ({
      ...s,
      label: STAGE_LABELS[s.stage] || s.stage,
      fill: STAGE_COLORS[s.stage] || "#94a3b8",
    }))

  const qualifiedData = [
    { name: "Strong Qualified", value: volume.qualifiedDistribution?.strongQualified || 0, carIds: volume.qualifiedDistribution?.strongQualifiedIds || [] },
    { name: "Weak Qualified", value: volume.qualifiedDistribution?.weakQualified || 0, carIds: volume.qualifiedDistribution?.weakQualifiedIds || [] },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Tổng AI Leads" value={formatNumber(volume.totalAiLeads)} icon={Users} subtitle="Từ workflow" onClick={() => onDrilldown("Tổng AI Leads", volume.totalAiLeadsIds || [])} />
        <StatCard title="Có Summary" value={formatNumber(volume.aiLeadsWithSummary)} icon={BarChart3} subtitle={`${volume.totalAiLeads > 0 ? Math.round(volume.aiLeadsWithSummary / volume.totalAiLeads * 100) : 0}% tổng`} onClick={() => onDrilldown("Có Summary", volume.aiLeadsWithSummaryIds || [])} />
        <StatCard title="Đang Active" value={formatNumber(volume.active)} icon={TrendingUp} color="text-emerald-500" subtitle="contacted / negotiation / inspection" onClick={() => onDrilldown("Đang Active", volume.activeIds || [])} />
        <StatCard title="Closed (CRM)" value={formatNumber(volume.closed)} icon={CheckCircle2} color="text-blue-500" subtitle="COMPLETED + DEPOSIT_PAID" onClick={() => onDrilldown("Closed (CRM)", volume.closedIds || [])} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Volume Chart */}
        <div className="space-y-4">
          <TrendChart 
            data={data.weeklyTrends} 
            dataKey="totalLeads" 
            title="Tăng trưởng Volume" 
            subtitle="Số lượng AI leads theo tuần" 
            color="#6366f1"
          />
        </div>

        {/* Qualified Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qualified</CardTitle>
            <CardDescription>Phân loại theo ảnh xe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualifiedData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
                <span className="text-xs font-semibold">Strong ({formatPercent(volume.qualifiedDistribution?.strongQualifiedRate)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[1] }} />
                <span className="text-xs font-semibold">Weak ({formatPercent(volume.qualifiedDistribution?.weakQualifiedRate)})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// SECTION 2: Funnel Conversion
// ============================================================================
function ConversionSection({ data, onDrilldown }: { data: any, onDrilldown: (title: string, ids: string[]) => void }) {
  const { conversion } = data
  const { stageReachRates, stageToStage, negotiationAnalysis } = conversion

  const funnelData = (stageReachRates || [])
    .filter((s: any) => s.stage !== 'failed' && s.stage !== 'zaloSuccess')
    .map((s: any) => ({
      ...s,
      name: STAGE_LABELS[s.stage] || s.stage,
      value: s.count,
      rate: s.rate,
      fill: STAGE_COLORS[s.stage] || "#94a3b8",
      logic: STAGE_LOGIC[s.stage] || "",
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
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number, _: any, props: any) => {
                    const logic = props.payload.logic
                    return [
                      <div className="space-y-1">
                        <div className="font-bold">{value} leads ({props.payload.rate}%)</div>
                        {logic && <div className="text-[10px] text-muted-foreground italic font-normal max-w-[200px] whitespace-normal leading-relaxed">{logic}</div>}
                      </div>,
                      "Reach"
                    ]
                  }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[4, 4, 0, 0]} 
                  className="cursor-pointer"
                  onClick={(data) => onDrilldown(`Reached ${data.name}`, data.carIds || [])}
                >
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
                  <TableRow key={s.stage} className="group cursor-pointer hover:bg-muted/50" onClick={() => onDrilldown(`Reached ${STAGE_LABELS[s.stage] || s.stage}`, s.carIds || [])}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage] || "#94a3b8" }} />
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                                {STAGE_LABELS[s.stage] || s.stage}
                                <Info className="h-3 w-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[200px]">{STAGE_LOGIC[s.stage] || "Calculation logic not defined"}</p>
                            </TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
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
  const { milestones } = sla

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
function QualitySection({ data, onDrilldown, filters }: { data: any, onDrilldown: (title: string, ids: string[]) => void, filters?: any }) {
  const { quality, volume } = data
  const { sentiment } = quality

  const mainMetrics: { label: string; value: string; desc: string; highlight?: string; carIds?: string[] }[] = [
    { label: "Strong Qualified Rate (D1)", value: formatPercent(quality.strongQualifiedRate), desc: "% leads có ảnh xe", carIds: volume.qualifiedDistribution?.strongQualifiedIds },
    { label: "Avg Negotiation Rounds (D2)", value: quality.avgNegotiationRounds?.toString() || "0", desc: "Leads ở negotiation/inspection", carIds: Array.from(new Set([...(data.conversion.stageReachRates.find((s: any) => s.stage === 'negotiation')?.carIds || []), ...(data.conversion.stageReachRates.find((s: any) => s.stage === 'inspection')?.carIds || [])])) },
    { 
      label: "Giảm Giá Thành Công (D3)", 
      value: `${quality.leadsWithPriceReduction} (${formatPercent(quality.avgPriceReductionPercent)})`, 
      desc: "price_customer giảm qua ≥2 snapshots",
      carIds: [] 
    },
  ]

  const convTotal = quality.convergenceTotal || 1
  const sentimentStages = ['contacted', 'negotiation', 'inspection', 'failed', 'completed', 'deposited']

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {mainMetrics.map((m, idx) => (
          <Card 
            key={idx} 
            className={cn("py-2 transition-all", m.carIds && m.carIds.length > 0 && "cursor-pointer hover:border-blue-400 hover:shadow-md group")}
            onClick={() => m.carIds && m.carIds.length > 0 && onDrilldown(m.label, m.carIds)}
          >
            <CardContent className="pt-4 pb-2">
              <p className="text-xs text-muted-foreground font-medium group-hover:text-blue-600 transition-colors">{m.label}</p>
              <p className={`text-2xl font-bold mt-1 ${m.highlight || ""}`}>{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold">Seller Sentiment & Escalation</h3>
        </div>

        <div className="space-y-4">
          <BotAtRiskCard filters={filters} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card 
              className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-all h-full"
              onClick={() => onDrilldown("Escalation Risk Leads", [...(sentiment?.escalation?.angryIds || []), ...(sentiment?.escalation?.wantHumanIds || []), ...(sentiment?.escalation?.botDetectedIds || [])])}
            >
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium">Escalation Rate</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold">{sentiment?.escalation?.rate}%</p>
                  <p className="text-xs text-red-500 mb-1 font-medium">Target &lt; 5%</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">N = {sentiment?.escalation?.total} leads có sentiment</p>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => onDrilldown("Angry Leads", sentiment?.escalation?.angryIds || [])}
            >
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium">Angry Count</p>
                <p className="text-2xl font-bold text-red-600">{sentiment?.escalation?.angry}</p>
                <Progress value={(sentiment?.escalation?.angry / (sentiment?.escalation?.total || 1)) * 100} className="h-1 mt-2" />
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => onDrilldown("Want Human Leads", sentiment?.escalation?.wantHumanIds || [])}
            >
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium">Want Human</p>
                <p className="text-2xl font-bold text-indigo-600">{sentiment?.escalation?.wantHuman}</p>
                <Progress value={(sentiment?.escalation?.wantHuman / (sentiment?.escalation?.total || 1)) * 100} className="h-1 mt-2" />
              </CardContent>
            </Card>
            <Card className="bg-gray-50/50">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium">Ghosting Proxy</p>
                <p className="text-2xl font-bold text-slate-600">{sentiment?.ghostingProxy?.rate}%</p>
                <p className="text-[10px] text-muted-foreground mt-1">{sentiment?.ghostingProxy?.count} active leads &gt; 48h im lặng</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Metrics theo PIC</CardTitle>
        <CardDescription>Click cột để sort. Dữ liệu filter theo thời gian.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("picName")}>PIC Name {sortBy === "picName" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("totalAssignedLeads")}>Assigned (D0) {sortBy === "totalAssignedLeads" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("totalQualifiedLeads")}>Qualified {sortBy === "totalQualifiedLeads" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("totalAiLeads")}>AI Leads {sortBy === "totalAiLeads" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("aiUtilizationRate")}>Utl % (D0) {sortBy === "aiUtilizationRate" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("aiUtlOverQualifiedRate")}>Utl % (Qual) {sortBy === "aiUtlOverQualifiedRate" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("aiLeadWins")}>AI Wins {sortBy === "aiLeadWins" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("aiLeadWinRate")}>AI Win % {sortBy === "aiLeadWinRate" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("slaInfoCollectedRate")}>Info % {sortBy === "slaInfoCollectedRate" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => handleSort("slaInspectionBookedRate")}>Insp % {sortBy === "slaInspectionBookedRate" && (sortDir === "desc" ? "↓" : "↑")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p: any) => (
                <TableRow key={p.picId}>
                  <TableCell className="font-medium whitespace-nowrap">{p.picName}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.totalAssignedLeads)}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.totalQualifiedLeads)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatNumber(p.totalAiLeads)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="font-mono text-[10px]">{formatPercent(p.aiUtilizationRate)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200">{formatPercent(p.aiUtlOverQualifiedRate)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(p.aiLeadWins)}</TableCell>
                  <TableCell className="text-right">{formatPercent(p.aiLeadWinRate)}</TableCell>
                  <TableCell className="text-right">{formatPercent(p.slaInfoCollectedRate)}</TableCell>
                  <TableCell className="text-right">{formatPercent(p.slaInspectionBookedRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SECTION 6: User Context (Feedback)
// ============================================================================
function FeedbackSection({ data, onDrilldown }: { data: any, onDrilldown: (title: string, ids: string[]) => void }) {
  const { feedback } = data
  if (!feedback) return null

  const distributionData = (feedback.distribution || []).map((s: any) => ({
    ...s,
    label: STAGE_LABELS[s.stage] || s.stage,
    fill: STAGE_COLORS[s.stage] || "#94a3b8",
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard 
          title="Tổng Feedback Records" 
          value={formatNumber(feedback.metrics?.totalRecords)} 
          icon={MessageSquare} 
          subtitle="Loại system-generated bị loại bỏ"
        />
        <StatCard 
          title="Tổng xe có Feedback" 
          value={formatNumber(feedback.metrics?.totalCars)} 
          icon={CheckCircle2} 
          color="text-emerald-500"
          subtitle="Distinct car_id"
        />
      </div>

      {/* Feedback Details - New Vertical List UI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết Feedback mới nhất</CardTitle>
          <CardDescription>Danh sách thực tế từ các xe đang chăm sóc</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto px-6 pb-6 space-y-4 pt-4">
            {(feedback.details || []).map((item: any, idx: number) => (
              <div 
                key={idx} 
                className="p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer group"
                onClick={() => onDrilldown(`Feedback: ${item.carId}`, [item.carId])}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                      style={{ 
                        backgroundColor: `${STAGE_COLORS[item.stage]}15`, 
                        color: STAGE_COLORS[item.stage],
                        borderColor: `${STAGE_COLORS[item.stage]}40`
                      }}
                    >
                      {STAGE_LABELS[item.stage] || item.stage}
                    </Badge>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className="text-[11px] font-medium text-muted-foreground">{item.picName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString('vi-VN', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="relative">
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {item.feedback}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">ID: {item.carId.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
            
            {(!feedback.details || feedback.details.length === 0) && (
              <div className="py-20 text-center opacity-30 text-sm">
                Chưa có dữ liệu feedback trong khoảng thời gian này
              </div>
            )}
          </div>
          {feedback.details?.length > 0 && (
            <div className="p-4 border-t bg-muted/10 text-center">
              <p className="text-[10px] text-muted-foreground italic">
                Đang hiển thị {feedback.details.length} feedback records mới nhất
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function AiFunnelDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [filterPicIds, setFilterPicIds] = useState<string[]>([])
  const [filterSource, setFilterSource] = useState<string>("all")
  const [drilldown, setDrilldown] = useState<{ title: string, ids: string[] } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        picId: filterPicIds.length > 0 ? filterPicIds.join(',') : 'all',
        source: filterSource,
      })
      const res = await fetch(`/api/ai-funnel/dashboard?${params}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error("Fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [dateRange, filterPicIds, filterSource])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDrilldown = (title: string, ids: string[]) => {
    if (ids.length > 0) setDrilldown({ title, ids })
  }

  const filters = {
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
    picIds: filterPicIds,
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
        <div className="flex flex-1 items-center gap-4">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 px-3 py-1">
            <TrendingUp className="h-4 w-4" />
            <span className="font-bold tracking-tight uppercase text-[10px]">AI Performance Dashboard v2</span>
          </Badge>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <h1 className="text-lg font-semibold tracking-tight">Analytics & Intelligence</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Source Filter */}
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {data?.sourceList?.map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PIC Filter (Multi-select) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-[200px] justify-between text-xs font-medium"
              >
                <div className="flex items-center gap-2 truncate">
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  {filterPicIds.length === 0 ? "Tất cả PIC" : 
                   filterPicIds.length === 1 ? (data?.picList?.find((p:any) => p.id === filterPicIds[0])?.name || "1 PIC selected") :
                   `${filterPicIds.length} PICs selected`}
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search PIC..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>No PIC found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => setFilterPicIds([])}
                      className="text-xs"
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        filterPicIds.length === 0 ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                      )}>
                        <Check className="h-3 w-3" />
                      </div>
                      Tất cả PIC
                    </CommandItem>
                    {data?.picList?.map((pic: any) => (
                      <CommandItem
                        key={pic.id}
                        onSelect={() => {
                          setFilterPicIds(prev => 
                            prev.includes(pic.id) 
                              ? prev.filter(id => id !== pic.id)
                              : [...prev, pic.id]
                          )
                        }}
                        className="text-xs"
                      >
                        <div className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          filterPicIds.includes(pic.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                        )}>
                          <Check className="h-3 w-3" />
                        </div>
                        {pic.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <DateRangePickerWithPresets
            dateRange={{ from: dateRange.from, to: dateRange.to }}
            onDateRangeChange={(d: any) => d?.from && d?.to && setDateRange({ from: d.from, to: d.to })}
          />
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        {drilldown && (
          <DrilldownPanel
            isOpen={!!drilldown}
            title={drilldown.title}
            carIds={drilldown.ids}
            onClose={() => setDrilldown(null)}
          />
        )}

        {loading && !data ? (
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 opacity-50">No data found</div>
        ) : (
          <Tabs defaultValue="quality" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 border">
               <TabsTrigger value="quality" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                AI Quality
              </TabsTrigger>
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
               <TabsTrigger value="pic" className="gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                Theo PIC
              </TabsTrigger>
              <TabsTrigger value="feedback" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                User Context
              </TabsTrigger>
            </TabsList>

            <TabsContent value="volume" className="mt-6">
              <VolumeSection data={data} onDrilldown={handleDrilldown} />
            </TabsContent>

            <TabsContent value="conversion" className="mt-6">
              <ConversionSection data={data} onDrilldown={handleDrilldown} />
            </TabsContent>

            <TabsContent value="sla" className="mt-6">
              <SlaSection data={data} />
            </TabsContent>

            <TabsContent value="quality" className="mt-6">
              <QualitySection data={data} onDrilldown={handleDrilldown} filters={filters} />
            </TabsContent>

            <TabsContent value="pic" className="mt-6">
              <PicSection data={data} />
            </TabsContent>

            <TabsContent value="feedback" className="mt-6">
              <FeedbackSection data={data} onDrilldown={handleDrilldown} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
