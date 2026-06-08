export type Workout = {
  id: string;
  name: string;
  type: "strength" | "cardio" | "hiit" | "flexibility";
  date: string;
  duration: number; // minutes
  calories: number;
  exercises: Exercise[];
};

export type Exercise = {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
};

export type Goal = {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  type: "weight" | "reps" | "distance" | "frequency";
};

export const workouts: Workout[] = [
  {
    id: "1",
    name: "Upper Body Blast",
    type: "strength",
    date: "2026-06-07",
    duration: 55,
    calories: 380,
    exercises: [
      { name: "Bench Press", sets: 4, reps: 8, weight: 95 },
      { name: "Pull-ups", sets: 4, reps: 10 },
      { name: "Overhead Press", sets: 3, reps: 10, weight: 60 },
      { name: "Cable Rows", sets: 3, reps: 12, weight: 70 },
      { name: "Tricep Dips", sets: 3, reps: 15 },
    ],
  },
  {
    id: "2",
    name: "5K Morning Run",
    type: "cardio",
    date: "2026-06-06",
    duration: 28,
    calories: 310,
    exercises: [{ name: "Running", distance: 5, duration: 28 }],
  },
  {
    id: "3",
    name: "Leg Day",
    type: "strength",
    date: "2026-06-05",
    duration: 65,
    calories: 450,
    exercises: [
      { name: "Back Squat", sets: 5, reps: 5, weight: 135 },
      { name: "Romanian Deadlift", sets: 4, reps: 8, weight: 115 },
      { name: "Leg Press", sets: 3, reps: 12, weight: 240 },
      { name: "Walking Lunges", sets: 3, reps: 20 },
      { name: "Calf Raises", sets: 4, reps: 20, weight: 80 },
    ],
  },
  {
    id: "4",
    name: "HIIT Circuit",
    type: "hiit",
    date: "2026-06-04",
    duration: 30,
    calories: 420,
    exercises: [
      { name: "Burpees", sets: 4, reps: 15 },
      { name: "Jump Squats", sets: 4, reps: 20 },
      { name: "Mountain Climbers", sets: 4, duration: 45 },
      { name: "Box Jumps", sets: 4, reps: 12 },
    ],
  },
  {
    id: "5",
    name: "Core & Mobility",
    type: "flexibility",
    date: "2026-06-03",
    duration: 40,
    calories: 180,
    exercises: [
      { name: "Plank Hold", sets: 3, duration: 60 },
      { name: "Dead Bug", sets: 3, reps: 12 },
      { name: "Hip Flexor Stretch", duration: 120 },
      { name: "Yoga Flow", duration: 20 },
    ],
  },
  {
    id: "6",
    name: "Push Day",
    type: "strength",
    date: "2026-06-02",
    duration: 50,
    calories: 360,
    exercises: [
      { name: "Incline Bench", sets: 4, reps: 8, weight: 85 },
      { name: "Arnold Press", sets: 3, reps: 10, weight: 40 },
      { name: "Lateral Raises", sets: 4, reps: 15, weight: 20 },
      { name: "Tricep Pushdown", sets: 3, reps: 12, weight: 50 },
    ],
  },
];

export const goals: Goal[] = [
  {
    id: "1",
    title: "Bench Press 225 lbs",
    target: 225,
    current: 185,
    unit: "lbs",
    deadline: "2026-08-01",
    type: "weight",
  },
  {
    id: "2",
    title: "Run 10K under 50 min",
    target: 50,
    current: 58,
    unit: "min",
    deadline: "2026-07-15",
    type: "distance",
  },
  {
    id: "3",
    title: "20 Pull-ups in a row",
    target: 20,
    current: 13,
    unit: "reps",
    deadline: "2026-09-01",
    type: "reps",
  },
  {
    id: "4",
    title: "Work out 5x per week",
    target: 5,
    current: 4,
    unit: "days/week",
    deadline: "2026-06-30",
    type: "frequency",
  },
];

export const weeklyActivity = [
  { day: "Mon", duration: 55, calories: 380 },
  { day: "Tue", duration: 28, calories: 310 },
  { day: "Wed", duration: 65, calories: 450 },
  { day: "Thu", duration: 30, calories: 420 },
  { day: "Fri", duration: 40, calories: 180 },
  { day: "Sat", duration: 50, calories: 360 },
  { day: "Sun", duration: 0, calories: 0 },
];

export const strengthProgress = [
  { date: "Jan", benchPress: 135, squat: 185, deadlift: 225 },
  { date: "Feb", benchPress: 145, squat: 195, deadlift: 245 },
  { date: "Mar", benchPress: 155, squat: 205, deadlift: 260 },
  { date: "Apr", benchPress: 165, squat: 220, deadlift: 275 },
  { date: "May", benchPress: 175, squat: 235, deadlift: 295 },
  { date: "Jun", benchPress: 185, squat: 245, deadlift: 315 },
];

export const bodyMetrics = [
  { date: "Jan", weight: 192, bodyFat: 18.5 },
  { date: "Feb", weight: 190, bodyFat: 17.8 },
  { date: "Mar", weight: 188, bodyFat: 17.1 },
  { date: "Apr", weight: 186, bodyFat: 16.4 },
  { date: "May", weight: 184, bodyFat: 15.9 },
  { date: "Jun", weight: 182, bodyFat: 15.2 },
];
