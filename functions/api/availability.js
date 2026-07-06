import { availabilityFrom, getSignups, json } from "../_utils.js";

export async function onRequestGet({ env }) {
  const signups = await getSignups(env);
  return json({ weeks: availabilityFrom(signups) });
}

