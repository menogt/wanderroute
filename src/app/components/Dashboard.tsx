import { Flame, Clock, Zap, TrendingUp, Calendar, Award } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { workouts, weeklyActivity } from "./data";

const statCards = [
  { label: "Calories Burned", value: "2,100", unit: "this week", icon: Flame, color: "#ff6b35" },
  { label: "Active Minutes", value: "268", unit: "this week", icon: Clock, color: "#c8f135" },
  { label: "Workouts Done", value: "6", unit: "this week", icon: Zap, color: "#3de0c8" },
  { label: "Current Streak", value: "12", unit: "days", icon: Award, color: "#a855f7" },
];

const typeColors: Record<string, string> = {
  strength: "#c8f135",
  cardio: "#3de0c8",
  hiit: "#ff6b35",
  flexibility: "#a855f7",
};

const typeLabels: Record<string, string> = {
  strength: "Strength",
  cardio: "Cardio",
  hiit: "HIIT",
  flexibility: "Flexibility",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl">
        <p className="text-muted-foreground text-xs mb-1" style={{ fontFamily: "var(--font-mono)" }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {p.name}: <span className="font-semibold">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function Dashboard() {
  const recentWorkouts = workouts.slice(0, 4);
  const todayCalories = weeklyActivity.reduce((s, d) => s + d.calories, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-muted-foreground text-sm mb-1" style={{ fontFamily: "var(--font-mono)" }}>
          Sunday, June 7, 2026
        </p>
        <h1
          className="text-foreground"
          style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}
        >
          Good morning,{" "}
          <span style={{ color: "var(--primary)" }}>Alex</span>
        </h1>
        <p className="text-muted-foreground mt-2">You're on a 12-day streak — keep it going!</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-white/15 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: card.color + "20" }}
            >
              <card.icon size={18} style={{ color: card.color }} />
            </div>
            <div>
              <p
                className="text-foreground"
                style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 800, lineHeight: 1 }}
              >
                {card.value}
              </p>
              <p className="text-muted-foreground text-xs mt-1">{card.label}</p>
              <p className="text-xs mt-0.5" style={{ color: card.color, fontFamily: "var(--font-mono)" }}>
                {card.unit}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weekly activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-foreground" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.01em" }}>
              Weekly Activity
            </h2>
            <div className="flex gap-3 text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#c8f135" }} />
                Duration
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#ff6b35" }} />
                Calories
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyActivity} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#6b6b80", fontSize: 12, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="duration" name="Min" fill="#c8f135" radius={[4, 4, 0, 0]} />
              <Bar dataKey="calories" name="Cal" fill="#ff6b35" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ring summary */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between">
          <h2 className="text-foreground" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>
            Today's Goal
          </h2>
          <div className="flex items-center justify-center py-6">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="#c8f135" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42 * 0.74} ${2 * Math.PI * 42 * 0.26}`}
                  className="transition-all duration-1000"
                />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                <circle
                  cx="50" cy="50" r="30" fill="none"
                  stroke="#3de0c8" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30 * 0.62} ${2 * Math.PI * 30 * 0.38}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 800, color: "#c8f135", lineHeight: 1 }}>74%</span>
                <span className="text-muted-foreground text-xs mt-1">complete</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Calories</span>
              <span className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>1,480 / 2,000</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active min</span>
              <span className="text-foreground" style={{ fontFamily: "var(--font-mono)" }}>37 / 60</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent workouts */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-foreground" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>
            Recent Workouts
          </h2>
          <TrendingUp size={16} className="text-muted-foreground" />
        </div>
        <div className="space-y-3">
          {recentWorkouts.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-border hover:border-white/15 transition-colors group"
              style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              <div
                className="w-2 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: typeColors[w.type] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold truncate">{w.name}</p>
                <p className="text-muted-foreground text-xs">{w.date}</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-foreground text-sm" style={{ fontFamily: "var(--font-mono)" }}>{w.duration}m</p>
                  <p className="text-muted-foreground text-xs">duration</p>
                </div>
                <div>
                  <p className="text-foreground text-sm" style={{ fontFamily: "var(--font-mono)" }}>{w.calories}</p>
                  <p className="text-muted-foreground text-xs">kcal</p>
                </div>
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-semibold self-center"
                  style={{
                    backgroundColor: typeColors[w.type] + "20",
                    color: typeColors[w.type],
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {typeLabels[w.type]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
