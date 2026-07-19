"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@takaki/go-design-system";
import type { ChartConfig } from "@takaki/go-design-system";

export function ReportAreaChart({
  data,
  config,
  xKey,
  yKeys,
  title,
  unit,
  height = 220,
}: {
  data: Record<string, unknown>[];
  config: ChartConfig;
  xKey: string;
  yKeys: string[];
  title: string;
  unit?: string;
  height?: number;
}) {
  return (
    <Card className="rounded-[20px] border border-[var(--color-border-default)]">
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-2">
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                {yKeys.map((key) => {
                  const color =
                    (config[key]?.color as string | undefined) ??
                    "var(--color-primary)";
                  return (
                    <linearGradient
                      key={key}
                      id={`report-fill-${key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                width={56}
                allowDecimals={false}
                unit={unit}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                }}
              />
              {yKeys.map((key) => {
                const color =
                  (config[key]?.color as string | undefined) ??
                  "var(--color-primary)";
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={config[key]?.label as string | undefined}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#report-fill-${key})`}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
