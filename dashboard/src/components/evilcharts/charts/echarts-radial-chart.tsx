"use client";

import { PieChart, type PieSeriesOption } from "echarts/charts";
import { TooltipComponent, type TooltipComponentOption } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { Banknote } from "lucide-react";
import { useEffect, useId, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import * as echarts from "echarts/core";
import { buildChartCss, normalizeColor, type ChartConfig } from "@/components/evilcharts/ui/echarts-chart";
import { Skeleton } from "@/components/ui/skeleton";

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

type EChartsOption = ComposeOption<PieSeriesOption | TooltipComponentOption>;

export type EChartsRadialDatum = {
  name: string;
  value: number;
  maxValue?: number;
  detail?: string;
};

export interface EChartsRadialChartProps {
  data: EChartsRadialDatum[];
  config: ChartConfig;
  className?: string;
  valueLabel?: string;
  variant?: "full" | "semi";
  isLoading?: boolean;
}

function resolveColor(container: HTMLElement, value: string) {
  const computed = getComputedStyle(container);
  let resolved = value.trim();
  const seen = new Set<string>();

  while (resolved.startsWith("var(")) {
    const variable = resolved.match(/^var\((--[^,)]+)(?:,[^)]+)?\)$/)?.[1];
    if (!variable || seen.has(variable)) break;
    seen.add(variable);
    resolved = computed.getPropertyValue(variable).trim();
  }

  return normalizeColor(resolved);
}

function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function EChartsRadialChart({
  data,
  config,
  className,
  valueLabel = "deals",
  variant = "semi",
  isLoading = false,
}: EChartsRadialChartProps) {
  const chartId = useId().replaceAll(":", "");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const total = useMemo(() => data.reduce((sum, item) => sum + Math.max(0, item.value), 0), [data]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (isLoading || !mount || !data.length) return;

    const chart = echarts.init(mount);
    chartRef.current = chart;
    const resizeObserver = new ResizeObserver(() => chart.resize());

    const colors = data.map((item) => {
      const itemConfig = config[item.name];
      const authored = itemConfig?.colors?.light?.[0] ?? "var(--primary)";
      return resolveColor(mount, authored);
    });
    const muted = resolveColor(mount, "var(--border)");
    const seriesCount = data.length;
    const isSemi = variant === "semi";
    const outerRadius = isSemi ? Math.min(150, Math.max(92, mount.clientWidth * 0.46)) : 92;
    const innerRadius = Math.max(24, outerRadius - seriesCount * 14);
    const ringWidth = Math.max(7, Math.min(11, (outerRadius - innerRadius) / seriesCount - 3));
    const ringGap = 7;

    const option: EChartsOption = {
      animation: !shouldReduceMotion,
      animationDuration: shouldReduceMotion ? 0 : 850,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          if (!item || item.dataIndex !== 0) return "";
          if (typeof item.seriesIndex !== "number") return "";
          const row = data[item.seriesIndex];
          if (!row) return "";
          const maxValue = row.maxValue ?? total;
          const percentage = maxValue ? Math.round(row.value / maxValue * 100) : 0;
          return `<div style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--popover);color:var(--popover-foreground);font:12px Inter Variable,Inter,sans-serif"><strong>${labelFor(row.name)}</strong><br>${row.value.toLocaleString()} ${valueLabel} · ${percentage}%</div>`;
        },
      },
      series: data.map((item, index) => {
        const radius = outerRadius - index * (ringWidth + ringGap);
        const value = Math.max(0, item.value);
        return {
          type: "pie",
          center: isSemi ? ["50%", "100%"] : ["50%", "50%"],
          radius: isSemi ? [radius - ringWidth, radius] : [`${radius - ringWidth}%`, `${radius}%`],
          startAngle: isSemi ? 180 : 90,
          endAngle: isSemi ? 0 : "auto",
          clockwise: true,
          silent: false,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: true, scaleSize: 2, itemStyle: { shadowBlur: 14, shadowColor: colors[index] } },
          data: [
            { name: item.name, value, itemStyle: { color: colors[index], borderRadius: 8 } },
            { name: `${item.name}-remainder`, value: Math.max(0, (item.maxValue ?? total) - value), itemStyle: { color: muted, borderRadius: 8 } },
          ],
        } satisfies PieSeriesOption;
      }),
    };

    chart.setOption(option);
    resizeObserver.observe(mount);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [config, data, isLoading, shouldReduceMotion, total, valueLabel, variant]);

  if (isLoading) {
    return <RadialChartSkeleton className={className} variant={variant} />;
  }

  if (!data.length) {
    return <div className={`grid min-h-64 place-items-center text-sm text-muted-foreground ${className ?? ""}`}>No pipeline activity was captured.</div>;
  }

  return <div className={`w-full ${className ?? ""}`} data-chart={chartId}>
    <style>{buildChartCss(chartId, config)}</style>
    <div className="grid items-center gap-x-6 gap-y-4 sm:grid-cols-[minmax(15rem,1.15fr)_minmax(13rem,0.85fr)]">
      <div ref={mountRef} className={`w-full ${variant === "semi" ? "h-56" : "aspect-square min-h-64"}`} role="img" aria-label={`${data.length} ${valueLabel} by status`} />
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 self-center">
        {data.map((item) => <div key={item.name} className="min-w-0"><p className="truncate text-xs text-muted-foreground">{labelFor(item.name)}</p><p className="mt-1 font-mono text-lg font-semibold tracking-tight">{item.value.toLocaleString()}</p></div>)}
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border pt-3 sm:grid-cols-3">
      {data.map((item) => { const maxValue = item.maxValue ?? total; const percentage = maxValue ? Math.round(item.value / maxValue * 100) : 0; const color = config[item.name]?.colors?.light?.[0] ?? "var(--primary)"; return <div key={item.name} className="min-w-0"><p className="flex items-center gap-1.5 truncate text-xs font-medium"><span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />{labelFor(item.name)}<span className="opacity-60" style={{ color }}>({percentage}%)</span></p>{item.detail && <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><Banknote className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{item.detail}</span></p>}</div> })}
    </div>
  </div>;
}

function RadialChartSkeleton({ className, variant }: { className?: string; variant: "full" | "semi" }) {
  if (variant === "full") return <div className={`grid min-h-64 place-items-center ${className ?? ""}`} aria-busy="true"><Skeleton className="size-56 rounded-full" /></div>;

  return <div className={`w-full ${className ?? ""}`} aria-busy="true">
    <div className="grid items-center gap-x-6 gap-y-4 sm:grid-cols-[minmax(15rem,1.15fr)_minmax(13rem,0.85fr)]">
      <div className="relative h-56 overflow-hidden"><Skeleton className="absolute bottom-0 left-1/2 h-48 w-80 -translate-x-1/2 rounded-t-full" /><div className="absolute bottom-0 left-1/2 h-36 w-64 -translate-x-1/2 rounded-t-full bg-card" /><Skeleton className="absolute bottom-0 left-1/2 h-32 w-56 -translate-x-1/2 rounded-t-full" /><div className="absolute bottom-0 left-1/2 h-24 w-44 -translate-x-1/2 rounded-t-full bg-card" /><Skeleton className="absolute bottom-0 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-full" /></div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 self-center">{Array.from({ length: 4 }, (_, index) => <div key={index}><Skeleton className="h-3 w-16" /><Skeleton className="mt-2 h-6 w-20" /></div>)}</div>
    </div>
    <div className="mt-4 border-t border-border pt-3"><div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">{Array.from({ length: 4 }, (_, index) => <div key={index}><Skeleton className="h-3.5 w-24" /><Skeleton className="mt-2 h-3 w-20" /></div>)}</div></div>
  </div>;
}
