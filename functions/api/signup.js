import { availabilityFrom, ensureSchema, getSignups, json, weeklyRate } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  await ensureSchema(env);

  const body = await request.json();
  const required = ["parentName", "playerName", "phone", "signupType", "selectedDates"];
  const missing = required.filter((field) => !body[field]);

  if (missing.length) {
    return json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
  }

  const selectedDayIds = Array.isArray(body.selectedDayIds) ? body.selectedDayIds : [];
  const weekIds = Array.isArray(body.weekIds) ? body.weekIds.filter((id) => id !== "week-3") : [];
  const selectedDates = Array.isArray(body.selectedDates) ? body.selectedDates : [String(body.selectedDates)];
  const signups = await getSignups(env);
  const availability = availabilityFrom(signups);

  if (body.signupType === "full-week") {
    const fullWeeks = availability.filter((week) => weekIds.includes(week.id));
    const full = fullWeeks.find((week) => week.status === "full" || week.status === "off");

    if (full) {
      return json({ error: `${full.label} is not available for full-week signup.` }, 409);
    }
  }

  const signup = {
    id: crypto.randomUUID(),
    parentName: String(body.parentName).trim(),
    playerName: String(body.playerName).trim(),
    phone: String(body.phone).trim(),
    signupType: body.signupType === "day-pass" ? "day-pass" : "full-week",
    selectedDayIds,
    weekIds,
    selectedDates,
    submittedAt: new Date().toISOString()
  };

  await env.DB.prepare(`INSERT INTO signups (
    id, parent_name, player_name, phone, signup_type, selected_day_ids, week_ids, selected_dates, submitted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      signup.id,
      signup.parentName,
      signup.playerName,
      signup.phone,
      signup.signupType,
      JSON.stringify(signup.selectedDayIds),
      JSON.stringify(signup.weekIds),
      JSON.stringify(signup.selectedDates),
      signup.submittedAt
    )
    .run();

  const updatedSignups = await getSignups(env);
  const updatedAvailability = availabilityFrom(updatedSignups);
  const estimates = weekIds.map((weekId) => {
    const week = updatedAvailability.find((item) => item.id === weekId);
    return week && week.capacity ? `${week.label}: $${weeklyRate(week.confirmed)} per player/week` : null;
  }).filter(Boolean);

  return json({ signup, weeks: updatedAvailability, estimates }, 201);
}

