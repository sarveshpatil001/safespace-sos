// SafeSpace security regression suite (defensive).
// Covers: two-user isolation, admin gating, unauthenticated access, input
// validation, SOS lifecycle, notification dedup, share-token model, abuse caps.
// Run: bun sec-audit.mjs   (uses synthetic anonymous guest test users only)
import { ConvexHttpClient } from "convex/browser";

const URL = "https://sincere-eel-229.convex.cloud";

const R = { hard: [], facts: {} };
function pass(name, detail) { R.hard.push({ name, ok: true, detail }); }
function fail(name, detail) { R.hard.push({ name, ok: false, detail }); }
function fact(k, v) { R.facts[k] = v; }

async function outcome(fn) {
  try { return { ok: true, value: await fn() }; }
  catch (e) { return { ok: false, error: String(e?.message ?? e) }; }
}

async function expectError(name, fn, pattern) {
  const r = await outcome(fn);
  if (!r.ok && pattern.test(r.error)) pass(name, r.error.slice(0, 80));
  else if (!r.ok) fail(name, `wrong error: ${r.error.slice(0, 120)}`);
  else fail(name, `expected rejection, got success: ${JSON.stringify(r.value).slice(0, 80)}`);
}
async function expectOk(name, fn) {
  const r = await outcome(fn);
  if (r.ok) pass(name, "ok");
  else fail(name, r.error.slice(0, 120));
  return r;
}

async function guest() {
  const c = new ConvexHttpClient(URL);
  const res = await c.action("auth:signIn", { provider: "anonymous", params: {} });
  if (!res?.tokens?.token) throw new Error("guest sign-in failed: " + JSON.stringify(res).slice(0, 100));
  c.setAuth(res.tokens.token);
  return c;
}

const anon = new ConvexHttpClient(URL); // never authenticated

console.log("== minting guest test users A and B ==");
const A = await guest();
const B = await guest();

// --- identity sanity -----------------------------------------------------
const meA = await A.query("users:currentUser");
const meB = await B.query("users:currentUser");
(meA._id !== meB._id) ? pass("identities distinct", "A != B") : fail("identities distinct", "same user!");

// --- A: provision synthetic data -----------------------------------------
const contact = await A.mutation("contacts:createContact", {
  name: "SecAudit Contact", relationship: "audit", phone: "+351910000001",
  email: "sec-audit@example.com", active: true, notifyEmail: true, notifySms: true,
});
pass("A createContact (own)", "created");

const { eventId } = await A.mutation("events:createEvent", {});
pass("A createEvent (own)", "created");

await expectOk("A setLocation AVAILABLE valid coords", () =>
  A.mutation("events:setLocation", { eventId, status: "AVAILABLE", latitude: 38.7223, longitude: -9.1393, accuracy: 30 }));
const ev = await A.query("events:getEvent", { id: eventId });
(ev.status === "ACTIVE" && ev.liveSharing === true && typeof ev.shareToken === "string" && ev.shareToken.length === 48)
  ? pass("event ACTIVE + share token 48 hex chars", `status=${ev.status} tokenLen=${ev.shareToken?.length}`)
  : fail("event ACTIVE + share token", JSON.stringify(ev).slice(0, 120));

// notification dedup facts (baseline vs hardened): growth must STOP after repeat calls
const n1 = await A.mutation("notifications:notifyContacts", { eventId });
const attempts1 = await A.query("notifications:listAttempts", { eventId });
const n2 = await A.mutation("notifications:notifyContacts", { eventId });
const attempts2 = await A.query("notifications:listAttempts", { eventId });
await A.mutation("notifications:notifyContacts", { eventId });
await A.mutation("notifications:notifyContacts", { eventId });
const attempts4 = await A.query("notifications:listAttempts", { eventId });
fact("notify1", n1); fact("notify2", n2);
fact("attemptRowsAfterFirst", attempts1.length);
fact("attemptRowsAfterSecondCall", attempts2.length);
fact("attemptRowsAfterFourthCall", attempts4.length);
fact("attemptRowGrowthCalls2to4", attempts4.length - attempts2.length);

// ping cadence facts
const pings1 = await A.query("events:listPings", { eventId });
await expectOk("A pingLocation valid", () => A.mutation("events:pingLocation", { eventId, latitude: 38.7224, longitude: -9.1394, accuracy: 25 }));
await A.mutation("events:pingLocation", { eventId, latitude: 38.7225, longitude: -9.1395, accuracy: 25 }).catch(() => {});
await A.mutation("events:pingLocation", { eventId, latitude: 38.7226, longitude: -9.1396, accuracy: 25 }).catch(() => {});
const pings2 = await A.query("events:listPings", { eventId });
fact("pingRowsAfter3RapidPings", pings2.length - pings1.length);

// --- input validation (must reject in BOTH runs) --------------------------
await expectError("setLocation lat=999 rejected", () =>
  A.mutation("events:setLocation", { eventId, status: "AVAILABLE", latitude: 999, longitude: 0 }), /Invalid coordinates/i);
await expectError("setLocation lng=-999 rejected", () =>
  A.mutation("events:setLocation", { eventId, status: "AVAILABLE", latitude: 0, longitude: -999 }), /Invalid coordinates/i);
await expectError("pingLocation lat=95 rejected", () =>
  A.mutation("events:pingLocation", { eventId, latitude: 95, longitude: 0 }), /Invalid coordinates/i);
await expectError("pingLocation negative accuracy rejected", () =>
  A.mutation("events:pingLocation", { eventId, latitude: 0, longitude: 0, accuracy: -5 }), /Invalid accuracy/i);
await expectError("contact id used as eventId rejected", () =>
  A.mutation("events:closeEvent", { eventId: contact, resolution: "RESOLVED" }), /[Ii]nvalid|Uncaught|does not exist|not found|ArgumentValidation/i);
await expectError("event id used as contactId rejected", () =>
  A.mutation("contacts:setContactActive", { id: eventId, active: false }), /[Ii]nvalid|not found|ArgumentValidation/i);

// --- two-user isolation (must hold in BOTH runs) --------------------------
(await B.query("events:getEvent", { id: eventId })) === null ? pass("B getEvent(A) -> null", "denied") : fail("B getEvent(A)", "LEAK");
(await B.query("events:listPings", { eventId })).length === 0 ? pass("B listPings(A) -> []", "denied") : fail("B listPings(A)", "LEAK");
(await B.query("notifications:listAttempts", { eventId })).length === 0 ? pass("B listAttempts(A) -> []", "denied") : fail("B listAttempts(A)", "LEAK");
(await B.query("events:activeEvent", {})) === null ? pass("B activeEvent -> null (no events of B)", "ok") : fail("B activeEvent", "unexpected");
await expectError("B setLocation(A.event) denied", () =>
  B.mutation("events:setLocation", { eventId, status: "AVAILABLE", latitude: 1, longitude: 2 }), /Event not found/i);
await expectError("B pingLocation(A.event) denied", () =>
  B.mutation("events:pingLocation", { eventId, latitude: 1, longitude: 2 }), /Event not found/i);
await expectError("B closeEvent(A.event) denied", () =>
  B.mutation("events:closeEvent", { eventId, resolution: "RESOLVED" }), /Event not found/i);
await expectError("B revokeShare(A.event) denied", () =>
  B.mutation("events:revokeShare", { eventId }), /Event not found/i);
await expectError("B notifyContacts(A.event) denied", () =>
  B.mutation("notifications:notifyContacts", { eventId }), /Event not found/i);
await expectError("B updateContact(A.contact) denied", () =>
  B.mutation("contacts:updateContact", { id: contact, name: "Hacked", phone: "+351910000002", active: true, notifyEmail: true, notifySms: true }), /Contact not found/i);
await expectError("B setContactActive(A.contact) denied", () =>
  B.mutation("contacts:setContactActive", { id: contact, active: false }), /Contact not found/i);
await expectError("B deleteContact(A.contact) denied", () =>
  B.mutation("contacts:deleteContact", { id: contact }), /Contact not found/i);
const auditB = await B.query("audit:listMine", {});
auditB.every((a) => a.resource !== eventId) ? pass("B audit.listMine has no A entries", "clean") : fail("B audit.listMine", "LEAK");

// positive control: B can manage OWN contact
const bContact = await B.mutation("contacts:createContact", {
  name: "B Own Contact", phone: "+351910000003", active: true, notifyEmail: false, notifySms: false,
});
await expectOk("B updateContact(B own) allowed", () =>
  B.mutation("contacts:setContactActive", { id: bContact, active: false }));
await expectOk("B deleteContact(B own) allowed", () => B.mutation("contacts:deleteContact", { id: bContact }));

// --- admin gating (must hold in BOTH runs) --------------------------------
(await B.query("admin:adminListUsers", {})).length === 0 ? pass("B adminListUsers -> []", "gated") : fail("B adminListUsers", "LEAK");
(await B.query("admin:adminListEvents", {})).length === 0 ? pass("B adminListEvents -> []", "gated") : fail("B adminListEvents", "LEAK");
(await B.query("admin:adminListAudit", {})).length === 0 ? pass("B adminListAudit -> []", "gated") : fail("B adminListAudit", "LEAK");
const st = await B.query("admin:adminStats", {});
(st.totalUsers === 0 && st.totalEvents === 0 && st.activeEvents === 0 && st.totalContacts === 0)
  ? pass("B adminStats -> zeros", "gated") : fail("B adminStats", JSON.stringify(st));

// --- unauthenticated access (must hold in BOTH runs) ----------------------
await expectError("anon createEvent denied", () => anon.mutation("events:createEvent", {}), /Not authenticated/i);
(await anon.query("events:activeEvent", {})) === null ? pass("anon activeEvent -> null", "ok") : fail("anon activeEvent", "LEAK");
(await anon.query("contacts:listContacts", {})).length === 0 ? pass("anon listContacts -> []", "ok") : fail("anon listContacts", "LEAK");
(await anon.query("events:getEvent", { id: eventId })) === null ? pass("anon getEvent -> null", "ok") : fail("anon getEvent", "LEAK");
(await anon.query("admin:adminListUsers", {})).length === 0 ? pass("anon adminListUsers -> []", "ok") : fail("anon adminListUsers", "LEAK");

// --- share model (public by token; must hold in BOTH runs) ----------------
const shareClient = new ConvexHttpClient(URL);
const share = await shareClient.query("events:shareByToken", { token: ev.shareToken });
const shareKeys = share ? Object.keys(share).sort() : [];
const expectedKeys = ["accuracy", "lastPingAt", "latitude", "liveSharing", "locationStatus", "longitude", "startedAt", "status", "userName"];
const forbidden = ["_id", "_creationTime", "userId", "shareToken", "shareRevokedAt", "email", "phone", "resolutionReason"];
const allowedShare = shareKeys.every((k) => expectedKeys.includes(k));
const noForbidden = shareKeys.every((k) => !forbidden.includes(k));
allowedShare && noForbidden
  ? pass("share returns ONLY intended public fields", shareKeys.join(","))
  : fail("share fields", JSON.stringify(shareKeys));
(!share || (!("_id" in share) && !("userId" in share) && !("shareToken" in share))) ? pass("share leaks no internal ids", "ok") : fail("share leaks", JSON.stringify(share).slice(0, 100));
(await shareClient.query("events:shareByToken", { token: "deadbeef".repeat(6) })) === null ? pass("garbage token -> null", "ok") : fail("garbage token", "returned data!");

await expectOk("A revokeShare(own)", () => A.mutation("events:revokeShare", { eventId }));
(await shareClient.query("events:shareByToken", { token: ev.shareToken })) === null ? pass("revoked token -> null", "ok") : fail("revoked token", "still public!");
await expectOk("A closeEvent(own, RESOLVED)", () => A.mutation("events:closeEvent", { eventId, resolution: "RESOLVED" }));
(await shareClient.query("events:shareByToken", { token: ev.shareToken })) === null ? pass("closed event token -> null", "ok") : fail("closed event token", "still public!");

// closed-event no-op semantics
const before = await A.query("events:getEvent", { id: eventId });
await A.mutation("events:setLocation", { eventId, status: "AVAILABLE", latitude: 38.7, longitude: -9.1 }).catch((e) => fail("setLocation on closed", String(e)));
const after = await A.query("events:getEvent", { id: eventId });
after.status === "RESOLVED" && after.locationStatus === before.locationStatus ? pass("closed event setLocation is a no-op", "unchanged") : fail("closed event setLocation", "state changed!");
await expectError("notifyContacts on closed event rejected", () =>
  A.mutation("notifications:notifyContacts", { eventId }), /Event is closed/i);
await expectOk("closeEvent idempotent", () => A.mutation("events:closeEvent", { eventId, resolution: "RESOLVED" }));

// --- SOS creation rate cap (fact: baseline none, hardened caps at 20/h) -----
let created = 0, capped = false, capMsg = "";
for (let i = 0; i < 25; i++) {
  const r = await outcome(async () => {
    const { eventId: e2 } = await B.mutation("events:createEvent", {});
    await B.mutation("events:closeEvent", { eventId: e2, resolution: "RESOLVED" });
    return e2;
  });
  if (r.ok) created++;
  else { capped = true; capMsg = r.error.slice(0, 110); break; }
}
fact("sosCreateSuccessesBeforeCap", created);
fact("sosCreateCapHit", capped);
fact("sosCreateCapMessage", capMsg);

// --- report ---------------------------------------------------------------
console.log("\n=== HARD ASSERTIONS (must hold before AND after hardening) ===");
let failures = 0;
for (const x of R.hard) { if (!x.ok) failures++; console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.detail ? "  — " + x.detail : ""}`); }
console.log(`\n${R.hard.length - failures}/${R.hard.length} passed`);
console.log("\n=== FACTS (compare baseline vs hardened) ===");
console.log(JSON.stringify(R.facts, null, 2));
process.exit(failures === 0 ? 0 : 1);
