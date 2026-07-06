import {
  coachEmail,
  escapeIcs,
  formatIcsDate,
  formatIcsDateTime,
  getSignups,
  nextDate,
  scheduleDays
} from "./_utils.js";

export async function onRequestGet({ env }) {
  const signups = await getSignups(env);
  const events = [];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  signups.forEach((signup) => {
    signup.selectedDayIds.forEach((dayId) => {
      const day = scheduleDays[dayId];
      if (!day) return;

      const summary = `ALL IN - ${signup.playerName}`;
      const description = [
        `Parent: ${signup.parentName}`,
        `Player: ${signup.playerName}`,
        `Phone: ${signup.phone}`,
        `Type: ${signup.signupType === "full-week" ? "Full week" : "Day pass"}`,
        `Selected dates: ${signup.selectedDates.join("; ")}`
      ].join("\\n");

      const lines = [
        "BEGIN:VEVENT",
        `UID:${signup.id}-${dayId}@all-in-summer-program`,
        `DTSTAMP:${stamp}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        `ORGANIZER;CN=Coach:mailto:${coachEmail}`
      ];

      if (day.start && day.end) {
        lines.push(`DTSTART;TZID=America/Phoenix:${formatIcsDateTime(day.date, day.start)}`);
        lines.push(`DTEND;TZID=America/Phoenix:${formatIcsDateTime(day.date, day.end)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(day.date)}`);
        lines.push(`DTEND;VALUE=DATE:${formatIcsDate(nextDate(day.date))}`);
      }

      lines.push("END:VEVENT");
      events.push(lines.join("\r\n"));
    });
  });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ALL IN Summer Program//Signup Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ALL IN Summer Program Signups",
    "X-WR-TIMEZONE:America/Phoenix",
    "BEGIN:VTIMEZONE",
    "TZID:America/Phoenix",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0700",
    "TZNAME:MST",
    "END:STANDARD",
    "END:VTIMEZONE",
    events.join("\r\n"),
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="all-in-summer-program.ics"'
    }
  });
}

