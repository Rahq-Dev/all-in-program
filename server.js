const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const SIGNUPS_FILE = path.join(DATA_DIR, "signups.json");
const COACH_EMAIL = "michael.berglund@heatbaseballclub.com";

const weeks = [
  { id: "week-1", label: "Week 1", range: "June 29-July 3", capacity: 4 },
  { id: "week-2", label: "Week 2", range: "July 6-10", capacity: 4 },
  { id: "week-3", label: "Week 3", range: "July 13-17 - OFF", capacity: 0 },
  { id: "week-4", label: "Week 4", range: "July 20-23", capacity: 4 }
];

const scheduleDays = {
  "2026-06-29": { date: "2026-06-29", label: "Mon Jun 29", start: "15:30", end: "17:00" },
  "2026-06-30": { date: "2026-06-30", label: "Tue Jun 30", start: "16:00", end: "17:30" },
  "2026-07-01": { date: "2026-07-01", label: "Wed Jul 1", start: "15:00", end: "16:30" },
  "2026-07-02": { date: "2026-07-02", label: "Thu Jul 2", start: "16:00", end: "17:30" },
  "2026-07-03": { date: "2026-07-03", label: "Fri Jul 3", start: null, end: null },
  "2026-07-06": { date: "2026-07-06", label: "Mon Jul 6", start: "15:30", end: "17:00" },
  "2026-07-07": { date: "2026-07-07", label: "Tue Jul 7", start: "16:00", end: "17:30" },
  "2026-07-08": { date: "2026-07-08", label: "Wed Jul 8", start: "15:00", end: "16:30" },
  "2026-07-09": { date: "2026-07-09", label: "Thu Jul 9", start: "16:00", end: "17:30" },
  "2026-07-10": { date: "2026-07-10", label: "Fri Jul 10", start: "15:30", end: "17:00" },
  "2026-07-20": { date: "2026-07-20", label: "Mon Jul 20", start: "15:30", end: "17:00" },
  "2026-07-21": { date: "2026-07-21", label: "Tue Jul 21", start: "16:00", end: "17:30" },
  "2026-07-22": { date: "2026-07-22", label: "Wed Jul 22", start: "15:00", end: "16:30" },
  "2026-07-23": { date: "2026-07-23", label: "Thu Jul 23", start: "16:00", end: "17:30" }
};

function weeklyRate(count) {
  if (count <= 1) return 300;
  if (count === 2) return 225;
  if (count === 3) return 175;
  return 150;
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SIGNUPS_FILE);
  } catch {
    await fs.writeFile(SIGNUPS_FILE, "[]\n", "utf8");
  }
}

async function readSignups() {
  await ensureDataFile();
  const raw = await fs.readFile(SIGNUPS_FILE, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeSignups(signups) {
  await ensureDataFile();
  await fs.writeFile(SIGNUPS_FILE, `${JSON.stringify(signups, null, 2)}\n`, "utf8");
}

function availabilityFrom(signups) {
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

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readRequestBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body too large");
  }
  return body ? JSON.parse(body) : {};
}

function adminPage(signups, availability) {
  const rows = signups.map((signup) => `
    <tr>
      <td>${new Date(signup.submittedAt).toLocaleString()}</td>
      <td>${escapeHtml(signup.parentName)}</td>
      <td>${escapeHtml(signup.playerName)}</td>
      <td>${escapeHtml(signup.phone)}</td>
      <td>${escapeHtml(signup.signupType === "full-week" ? "Full week" : "Day pass")}</td>
      <td>${escapeHtml(signup.selectedDates.join("; "))}</td>
    </tr>
  `).join("");

  const cards = availability.map((week) => `
    <div class="card">
      <strong>${escapeHtml(week.label)}</strong>
      <span>${escapeHtml(week.range)}</span>
      <b>${week.status === "off" ? "OFF" : `${week.confirmed} of ${week.capacity} confirmed`}</b>
      <span>${week.status === "open" ? `${week.spotsOpen} spots open` : week.status.toUpperCase()}</span>
    </div>
  `).join("");

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ALL IN Signups</title>
    <style>
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #fbf7f0; color: #181818; }
      header { padding: 20px 28px; background: #0c0c0d; color: white; border-bottom: 4px solid #f37021; }
      main { padding: 24px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
      .card { display: grid; gap: 6px; padding: 14px; background: white; border: 1px solid #ded8cf; border-radius: 8px; }
      .card b { color: #f37021; }
      table { width: 100%; border-collapse: collapse; background: white; }
      th, td { padding: 10px; border: 1px solid #ded8cf; text-align: left; vertical-align: top; }
      th { background: #111; color: white; }
    </style>
  </head>
  <body>
    <header><h1>ALL IN Signups</h1></header>
    <main>
      <section class="grid">${cards}</section>
      <table>
        <thead>
          <tr><th>Submitted</th><th>Parent</th><th>Player</th><th>Phone</th><th>Type</th><th>Dates</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='6'>No signups yet.</td></tr>"}</tbody>
      </table>
    </main>
  </body>
  </html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeIcs(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function formatIcsDateTime(date, time) {
  const [year, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

function formatIcsDate(date) {
  return date.replaceAll("-", "");
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function calendarFeed(signups) {
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
        `ORGANIZER;CN=Coach:mailto:${COACH_EMAIL}`
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

  return [
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
}

async function serveStatic(res, pathname) {
  const filePath = pathname === "/" ? path.join(ROOT, "summer-program-signup.html") : path.join(ROOT, pathname);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    const type = ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (process.env.REDIRECT_URL) {
      const target = new URL(req.url, process.env.REDIRECT_URL);
      res.writeHead(302, { location: target.toString() });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/availability") {
      const signups = await readSignups();
      json(res, 200, { weeks: availabilityFrom(signups) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin") {
      const signups = await readSignups();
      res.writeHead(200, { "content-type": "text/html" });
      res.end(adminPage(signups, availabilityFrom(signups)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/calendar.ics") {
      const signups = await readSignups();
      res.writeHead(200, {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'inline; filename="all-in-summer-program.ics"'
      });
      res.end(calendarFeed(signups));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/signup") {
      const body = await readRequestBody(req);
      const required = ["parentName", "playerName", "phone", "signupType", "selectedDates"];
      const missing = required.filter((field) => !body[field]);

      if (missing.length) {
        json(res, 400, { error: `Missing required fields: ${missing.join(", ")}` });
        return;
      }

      const selectedDayIds = Array.isArray(body.selectedDayIds) ? body.selectedDayIds : [];
      const weekIds = Array.isArray(body.weekIds) ? body.weekIds.filter((id) => id !== "week-3") : [];
      const selectedDates = Array.isArray(body.selectedDates) ? body.selectedDates : [String(body.selectedDates)];
      const signups = await readSignups();
      const availability = availabilityFrom(signups);

      if (body.signupType === "full-week") {
        const fullWeeks = availability.filter((week) => weekIds.includes(week.id));
        const full = fullWeeks.find((week) => week.status === "full" || week.status === "off");

        if (full) {
          json(res, 409, { error: `${full.label} is not available for full-week signup.` });
          return;
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

      signups.push(signup);
      await writeSignups(signups);

      const updatedAvailability = availabilityFrom(signups);
      const estimates = weekIds.map((weekId) => {
        const week = updatedAvailability.find((item) => item.id === weekId);
        return week && week.capacity ? `${week.label}: $${weeklyRate(week.confirmed)} per player/week` : null;
      }).filter(Boolean);

      json(res, 201, { signup, weeks: updatedAvailability, estimates });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(res, url.pathname);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`ALL IN signup site running at http://localhost:${PORT}`);
  console.log(`Coach dashboard: http://localhost:${PORT}/admin`);
  console.log(`Calendar feed: http://localhost:${PORT}/calendar.ics`);
});
