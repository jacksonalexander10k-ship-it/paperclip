import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Primary emerald color (matches --primary in dark mode)
const PRIMARY = "oklch(0.72 0.18 162)";
const DESTRUCTIVE = "oklch(0.637 0.237 25.331)";
const GRID_STROKE = "oklch(0.18 0.012 265)";
const TICK_FILL = "oklch(0.52 0.014 265)";

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface DailyCostChartProps {
  data: Array<{ date: string; totalCents: number }>;
}

export function DailyCostChart({ data }: DailyCostChartProps) {
  const mapped = data.map((d) => ({
    date: formatDate(d.date),
    cost: +(d.totalCents / 100).toFixed(2),
  }));

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-4">
      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-3">
        Daily Cost (14 days)
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={mapped} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.18} />
              <stop offset="95%" stopColor={PRIMARY} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: TICK_FILL, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: TICK_FILL, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]}
            labelStyle={{ color: "oklch(0.72 0.014 265)", marginBottom: 4 }}
            cursor={{ stroke: GRID_STROKE }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke={PRIMARY}
            strokeWidth={1.5}
            fill="url(#costGradient)"
            dot={false}
            activeDot={{ r: 3, fill: PRIMARY, stroke: "transparent" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DailyRunsChartProps {
  data: Array<{ date: string; total: number; succeeded: number; failed: number }>;
}

export function DailyRunsChart({ data }: DailyRunsChartProps) {
  const mapped = data.map((d) => ({
    date: formatDate(d.date),
    succeeded: d.succeeded,
    failed: d.failed,
  }));

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-4">
      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-3">
        Agent Runs (14 days)
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={mapped} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: TICK_FILL, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: TICK_FILL, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "oklch(0.72 0.014 265)", marginBottom: 4 }}
            cursor={{ fill: "oklch(0.18 0.012 265)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: TICK_FILL, paddingTop: 8 }}
            iconType="circle"
            iconSize={6}
          />
          <Bar dataKey="succeeded" name="Succeeded" stackId="runs" fill={PRIMARY} radius={[0, 0, 0, 0]} />
          <Bar dataKey="failed" name="Failed" stackId="runs" fill={DESTRUCTIVE} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
