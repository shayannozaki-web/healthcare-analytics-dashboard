import { redirect } from "next/navigation";

import { isSeeded } from "./seed";

/**
 * Server-component guard. Call at the top of any data-fetching page; if the
 * Turso database isn't seeded yet, send the user to /setup to seed it.
 */
export async function requireSeeded() {
  if (!(await isSeeded())) redirect("/setup");
}
