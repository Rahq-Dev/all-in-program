import { availabilityFrom, escapeHtml, getSignups } from "./_utils.js";

export async function onRequestGet({ env }) {
  const signups = await getSignups(env);
  const availability = availabilityFrom(signups);
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

  return new Response(`<!doctype html>
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
  </html>`, { headers: { "content-type": "text/html" } });
}

