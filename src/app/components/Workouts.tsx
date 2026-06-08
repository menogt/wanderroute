import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, Dumbbell, Timer, Flame } from "lucide-react";
import { workouts, Workout } from "./data";

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

const filters = ["All", "Strength", "Cardio", "HIIT", "Flexibility"];

function WorkoutCard({ workout }: { workout: Workout }) {
  const [expanded, setExpanded] = useState(false);
  const color = typeColors[workout.type];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-white/15 transition-colors">
      <div
        className="flex items-center gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-1.5 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                backgroundColor: color + "20",
                color,
                fontFamily: "var(--font-mono)",
              }}
            >
              {typeLabels[workout.type]}
            </span>
            <span className="text-muted-foreground text-xs" style={{ fontFamily: "var(--font-mono)" }}>
              {workout.date}
            </span>
          </div>
          <p className="text-foreground font-semibold text-lg" style={{ fontFamily: "var(--font-display)", lineHeight: 1.2 }}>
            {workout.name}
          </p>
        </div>
        <div className="flex gap-5 text-right items-center">
          <div>
            <p className="text-foreground font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{workout.duration}m</p>
            <p className="text-muted-foreground text-xs">duration</p>
          </div>
          <div>
            <p className="text-foreground font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#ff6b35" }}>{workout.calories}</p>
            <p className="text-muted-foreground text-xs">kcal</p>
          </div>
          <div>
            {expanded ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <p className="text-muted-foreground text-xs mb-3" style={{ fontFamily: "var(--font-mono)" }}>
            EXERCISES ({workout.exercises.length})
          </p>
          <div className="space-y-2">
            {workout.exercises.map((ex, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-3 rounded-lg"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <span className="text-foreground text-sm">{ex.name}</span>
                <span className="text-muted-foreground text-xs" style={{ fontFamily: "var(--font-mono)" }}>
                  {ex.sets && ex.reps && `${ex.sets} × ${ex.reps}`}
                  {ex.weight && ` @ ${ex.weight}lbs`}
                  {ex.distance && `${ex.distance}km`}
                  {ex.duration && !ex.sets && `${ex.duration}s`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type NewWorkoutForm = {
  name: string;
  type: Workout["type"];
  duration: string;
  calories: string;
};

export function Workouts() {
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewWorkoutForm>({ name: "", type: "strength", duration: "", calories: "" });
  const [allWorkouts, setAllWorkouts] = useState(workouts);

  const filtered = allWorkouts.filter(
    (w) => filter === "All" || typeLabels[w.type] === filter
  );

  const handleAdd = () => {
    if (!form.name || !form.duration) return;
    const newW: Workout = {
      id: String(Date.now()),
      name: form.name,
      type: form.type,
      date: "2026-06-07",
      duration: Number(form.duration),
      calories: Number(form.calories) || 0,
      exercises: [],
    };
    setAllWorkouts([newW, ...allWorkouts]);
    setShowForm(false);
    setForm({ name: "", type: "strength", duration: "", calories: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{ fontFamily: "var(--font-display)", fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--foreground)" }}
          >
            Workouts
          </h1>
          <p className="text-muted-foreground mt-1">{allWorkouts.length} sessions logged</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "var(--font-body)" }}
        >
          <Plus size={16} />
          Log Workout
        </button>
      </div>

      {/* Quick log form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-foreground font-semibold" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Log New Workout</h3>
            <button onClick={() => setShowForm(false)}>
              <X size={16} className="text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-muted-foreground text-xs mb-1.5 block" style={{ fontFamily: "var(--font-mono)" }}>WORKOUT NAME</label>
              <input
                className="w-full rounded-lg px-4 py-3 text-foreground text-sm border border-border focus:outline-none focus:border-primary transition-colors"
                style={{ backgroundColor: "var(--input-background)", fontFamily: "var(--font-body)" }}
                placeholder="e.g. Morning Run"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1.5 block" style={{ fontFamily: "var(--font-mono)" }}>TYPE</label>
              <select
                className="w-full rounded-lg px-4 py-3 text-foreground text-sm border border-border focus:outline-none focus:border-primary transition-colors appearance-none"
                style={{ backgroundColor: "var(--input-background)", fontFamily: "var(--font-body)" }}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Workout["type"] })}
              >
                <option value="strength">Strength</option>
                <option value="cardio">Cardio</option>
                <option value="hiit">HIIT</option>
                <option value="flexibility">Flexibility</option>
              </select>
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1.5 block" style={{ fontFamily: "var(--font-mono)" }}>DURATION (min)</label>
              <input
                type="number"
                className="w-full rounded-lg px-4 py-3 text-foreground text-sm border border-border focus:outline-none focus:border-primary transition-colors"
                style={{ backgroundColor: "var(--input-background)", fontFamily: "var(--font-mono)" }}
                placeholder="45"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs mb-1.5 block" style={{ fontFamily: "var(--font-mono)" }}>CALORIES</label>
              <input
                type="number"
                className="w-full rounded-lg px-4 py-3 text-foreground text-sm border border-border focus:outline-none focus:border-primary transition-colors"
                style={{ backgroundColor: "var(--input-background)", fontFamily: "var(--font-mono)" }}
                placeholder="350"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name || !form.duration}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Save Workout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={
              filter === f
                ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                : { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* Workout list */}
      <div className="space-y-3">
        {filtered.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Dumbbell size={32} className="mx-auto mb-3 opacity-30" />
            <p>No {filter.toLowerCase()} workouts logged yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
