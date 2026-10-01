import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Honest notification pipeline.
 *
 * Convex mutations cannot await actions, so the flow is:
 *   1. `notifyContacts` (mutation) records every attempt that requires no
 *      provider (not-configured / no-address) immediately, and *schedules* one
 *      action per real email send.
 *   2. `safeSpaceActions.sendEmail` (action) talks to the provider and calls
 *      `recordAttempt` with exactly what the provider reported.
 *   3. Aggregate status is recomputed after every attempt.
 *
 * The UI subscribes reactively, so statuses move PENDING -> SENT/FAILED as
 * provider responses land. Nothing is ever marked sent without a provider
 * confirmation.
 */

type AttemptRow = {
  status: string;
  channel: string;
  contactId?: string;
};

async function computeStatus(
  ctx: { db: any },
  eventId: string,
): Promise<string> {
  const attempts: AttemptRow[] = await ctx.db
    .query("notificationAttempts")
    .withIndex("by_event", (q: { eq: (f: string, v: string) => unknown }) =>
      q.eq("eventId", eventId),
    )
    .collect();
  const anySent = attempts.some((a: { status: string }) => a.status === "SENT");
  const anyFailed = attempts.some(
    (a: { status: string }) => a.status === "FAILED",
  );
  const anyNotConfigured = attempts.some(
    (a: { status: string }) => a.status === "NOT_CONFIGURED",
  );
  if (attempts.length === 0) return "PENDING";
  if (anySent && (anyFailed || anyNotConfigured)) return "PARTIAL";
  if (anySent) return "SENT";
  if (anyFailed) return "FAILED";
  if (anyNotConfigured) return "NOT_CONFIGURED";
  return "NO_CHANNELS";
}

export const notifyContacts = mutation({
  args: { eventId: v.id("emergencyEvents") },
  returns: v.object({
    status: v.string(),
    scheduled: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) throw new Error("Event not found");
    if (ev.status === "RESOLVED" || ev.status === "CANCELLED") {
      throw new Error("Event is closed");
    }

    const user = await ctx.db.get(userId);
    const contacts = await ctx.db
      .query("trustedContacts")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("active", true),
      )
      .collect();

    const emailConfigured = !!process.env.VLY_INTEGRATION_KEY;
    // No SMS provider is connected in this deployment. When one is added,
    // schedule real sends here the same way email is handled.
    const smsConfigured = false;

    // Abuse cap: at most one scheduled email attempt per contact per event.
    // Without this, calling notifyContacts in a loop would stack scheduler
    // runs and blast the real email provider repeatedly.
    const existingAttempts = await ctx.db
      .query("notificationAttempts")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    const alreadyScheduled = new Set(
      existingAttempts
        .filter((a) => a.channel === "email")
        .map((a) => a.contactId),
    );

    const now = Date.now();
    let scheduled = 0;
    let skipped = 0;

    for (const contact of contacts) {
      const channels: ("email" | "sms")[] = [];
      if (contact.notifyEmail) channels.push("email");
      if (contact.notifySms) channels.push("sms");

      for (const channel of channels) {
        if (channel === "email") {
          if (!alreadyScheduled.has(contact._id) && contact.email && emailConfigured) {
            scheduled++;
            alreadyScheduled.add(contact._id);
            await ctx.scheduler.runAfter(
              0,
              internal.safeSpaceActions.sendEmail,
              {
                eventId: args.eventId,
                contactId: contact._id,
                contactName: contact.name,
                to: contact.email,
                userName: user?.name ?? "Someone you trust",
                userPhone: user?.phone,
                latitude: ev.latitude,
                longitude: ev.longitude,
                liveSharing: ev.liveSharing,
                shareToken: ev.shareToken,
                startedAt: ev.createdAt,
              },
            );
          } else {
            skipped++;
            await ctx.db.insert("notificationAttempts", {
              eventId: args.eventId,
              userId,
              contactId: contact._id,
              contactName: contact.name,
              channel: "email",
              status: "NOT_CONFIGURED",
              detail: !contact.email
                ? "Contact has no email address on file"
                : "Email provider not configured",
              attemptedAt: now,
            });
          }
        } else if (channel === "sms") {
          if (smsConfigured) {
            // Real SMS provider scheduling would go here.
          } else {
            skipped++;
            await ctx.db.insert("notificationAttempts", {
              eventId: args.eventId,
              userId,
              contactId: contact._id,
              contactName: contact.name,
              channel: "sms",
              status: "NOT_CONFIGURED",
              detail:
                "SMS is prepared but no SMS provider is connected yet — no message was sent. Enable email notifications for this contact, or connect an SMS provider.",
              attemptedAt: now,
            });
          }
        }
      }
    }

    if (contacts.length === 0 || (scheduled === 0 && skipped === 0)) {
      await ctx.db.patch(args.eventId, {
        notificationStatus: "NO_CHANNELS",
        notificationsAttemptedAt: now,
        updatedAt: now,
      });
      return { status: "NO_CHANNELS", scheduled, skipped };
    }

    const status = await computeStatus(ctx, args.eventId);
    await ctx.db.patch(args.eventId, {
      notificationStatus: status as never,
      notificationsAttemptedAt: now,
      updatedAt: now,
    });

    return { status, scheduled, skipped };
  },
});

/** Called by the email action with exactly what the provider reported. */
export const recordAttempt = internalMutation({
  args: {
    eventId: v.id("emergencyEvents"),
    contactId: v.optional(v.id("trustedContacts")),
    contactName: v.string(),
    channel: v.union(v.literal("email"), v.literal("sms")),
    status: v.union(v.literal("SENT"), v.literal("FAILED")),
    providerMessageId: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ev = await ctx.db.get(args.eventId);
    if (!ev) return null;
    await ctx.db.insert("notificationAttempts", {
      eventId: args.eventId,
      userId: ev.userId,
      contactId: args.contactId,
      contactName: args.contactName,
      channel: args.channel,
      status: args.status,
      providerMessageId: args.providerMessageId,
      detail: args.detail,
      attemptedAt: Date.now(),
    });
    const status = await computeStatus(ctx, args.eventId);
    await ctx.db.patch(args.eventId, {
      notificationStatus: status as never,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listAttempts = query({
  args: { eventId: v.id("emergencyEvents") },
  returns: v.array(
    v.object({
      _id: v.id("notificationAttempts"),
      contactName: v.string(),
      channel: v.string(),
      status: v.string(),
      providerMessageId: v.optional(v.string()),
      detail: v.optional(v.string()),
      attemptedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) return [];
    return await ctx.db
      .query("notificationAttempts")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .collect();
  },
});
