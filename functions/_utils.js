export const coachEmail = "michael.berglund@heatbaseballclub.com";

export const weeks = [
  { id: "week-1", label: "Week 1", range: "June 29-July 3", capacity: 4 },
  { id: "week-2", label: "Week 2", range: "July 6-10", capacity: 4 },
  { id: "week-3", label: "Week 3", range: "July 13-17 - OFF", capacity: 0 },
  { id: "week-4", label: "Week 4", range: "July 20-23", capacity: 4 }
];

export const scheduleDays = {
  "2026-06-29": { date: "2026-06-29", start: "15:30", end: "17:00" },
  "2026-06-30": { date: "2026-06-30", start: "16:00", end: "17:30" },
  "2026-07-01": { date: "2026-07-01", start: "15:00", end: "16:30" },
  "2026-07-02": { date: "2026-07-02", start: "16:00", end: "17:30" },
  "2026-07-03": { date: "2026-07-03", start: null, end: null },
  "2026-07-06": { date: "2026-07-06", start: "15:30", end: "17:00" },
  "2026-07-07": { date: "2026-07-07", start: "16:00", end: "17:30" },
  "2026-07-08": { date: "2026-07-08", start: "15:00", end: "16:30" },
  "2026-07-09": { date: "2026-07-09", start: "16:00", end: "17:30" },
  "2026-07-10": { date: "2026-07-10", start: "15:30", end: "17:00" },
  "2026-07-20": { date: "2026-07-20", start: "15:30", end: "17:00" },
  "2026-07-21": { date: "2026-07-21", start: "16:00", end: "17:30" },
  "2026-07-22": { date: "2026-07-22", start: "15:00", end: "16:30" },
  "2026-07-23": { date: "2026-07-23", start: "16:00", end: "17:30" }
};

export function weeklyRate(count) {
  if (count <= 1) return 300;
  if (count === 2) return 225;
  if (count === 3) return 175;
  return 150;
}

export async function ensureSchema(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS signups (id TEXT PRIMARY KEY, parent_name TEXT NOT NULL, player_name TEXT NOT NULL, phone TEXT NOT NULL, signup_type TEXT NOT NULL, selected_day_ids TEXT NOT NULL, week_ids TEXT NOT NULL, selected_dates TEXT NOT NULL, submitted_at TEXT NOT NULL)").run();
}

export async function getSignups(env) {
  await ensureSchema(env);
  const { results } = await env.DB.prepare("SELECT * FROM signups ORDER BY submitted_at DESC").all();
  return results.map(rowToSignup);
}

export function rowToSignup(row) {
  return {
    id: row.id,
    parentName: row.parent_name,
    playerName: row.player_name,
    phone: row.phone,
    signupType: row.signup_type,
    selectedDayIds: JSON.parse(row.selected_day_ids || "[]"),
    weekIds: JSON.parse(row.week_ids || "[]"),
    selectedDates: JSON.parse(row.selected_dates || "[]"),
    submittedAt: row.submitted_at
  };
}

export function availabilityFrom(signups) {
  return weeks.map((week) => {
    const fullWeekSignups = signups.filter((signup) =>
      signup.signupType === "full-week" && signup.weekIds.includes(week.id)
    );
    const confirmed = fullWeekSignups.length;
    const spotsOpen = Math.max(week.capacity - confirmed, 0);
    const nextCount = week.capacity ? Math.min(confirmed + 1, week.capacity) : 0;

    return {
      ...week,
      confirmed,
      spotsOpen,
      status: week.capacity === 0 ? "off" : spotsOpen > 0 ? "open" : "full",
      currentRate: week.capacity ? weeklyRate(Math.max(confirmed, 1)) : null,
      nextPlayerRate: week.capacity && spotsOpen > 0 ? weeklyRate(nextCount) : null
    };
  });
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeIcs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

export function formatIcsDateTime(date, time) {
  const [year, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

export function formatIcsDate(date) {
  return date.replaceAll("-", "");
}

export function nextDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
