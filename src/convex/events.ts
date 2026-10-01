import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Server-side coordinate validation. The browser is the only legitimate
 * source, but never trust that: garbage coordinates would poison map links,
 * the live-share page, and contact emails.
 */
function validateCoords(
  latitude: number | undefined,
  longitude: number | undefined,
  accuracy: number | undefined,
): { latitude: number; longitude: number; accuracy: number | undefined } {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid coordinates");
  }
  if (accuracy !== undefined && (accuracy < 0 || accuracy > 100_000)) {
    throw new Error("Invalid accuracy");
  }
  return { latitude, longitude, accuracy };
}

// ---------------------------------------------------------------------------
// Emergency events: creation, location, closure, pings
// ---------------------------------------------------------------------------

export const activeEvent = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("emergencyEvents"),
      status: v.string(),
      locationStatus: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      liveSharing: v.boolean(),
      shareToken: v.optional(v.string()),
      notificationStatus: v.string(),
      notificationsAttemptedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    // A live event is either ACTIVE (location captured) or CREATED
    // (recorded, still waiting on the location prompt outcome).
    const rows = await ctx.db
      .query("emergencyEvents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "ACTIVE"),
      )
      .order("desc")
      .take(1);
    if (rows.length > 0) return rows[0];
    const created = await ctx.db
      .query("emergencyEvents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "CREATED"),
      )
      .order("desc")
      .take(1);
    return created[0] ?? null;
  },
});

export const listEvents = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("emergencyEvents"),
      status: v.string(),
      locationStatus: v.string(),
      notificationStatus: v.string(),
      liveSharing: v.boolean(),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolutionReason: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("emergencyEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 100));
  },
});

export const getEvent = query({
  args: { id: v.id("emergencyEvents") },
  returns: v.union(
    v.object({
      _id: v.id("emergencyEvents"),
      userId: v.id("users"),
      status: v.string(),
      locationStatus: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      liveSharing: v.boolean(),
      shareToken: v.optional(v.string()),
      notificationStatus: v.string(),
      createdAt: v.number(),
      resolvedAt: v.optional(v.number()),
      resolutionReason: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const ev = await ctx.db.get(args.id);
    if (!ev || ev.userId !== userId) return null;
    return ev;
  },
});

export const createEvent = mutation({
  args: {},
  returns: v.object({ eventId: v.id("emergencyEvents") }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Reuse an existing live event instead of creating duplicates.
    const existing = await ctx.db
      .query("emergencyEvents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "ACTIVE"),
      )
      .first();
    if (existing) return { eventId: existing._id };

    // Also reuse a stuck CREATED event (e.g. the location prompt never
    // resolved) rather than stacking duplicates.
    const stuck = await ctx.db
      .query("emergencyEvents")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "CREATED"),
      )
      .first();
    if (stuck) return { eventId: stuck._id };

    const now = Date.now();
    const shareToken = generateToken();
    const eventId = await ctx.db.insert("emergencyEvents", {
      userId,
      status: "CREATED",
      locationStatus: "PENDING",
      liveSharing: false,
      shareToken,
      notificationStatus: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.audit.logInternal, {
      userId,
      actorType: "user",
      action: "emergency.created",
      resource: eventId,
      result: "SUCCESS",
    });

    return { eventId };
  },
});

export const setLocation = mutation({
  args: {
    eventId: v.id("emergencyEvents"),
    status: v.union(
      v.literal("AVAILABLE"),
      v.literal("DENIED"),
      v.literal("TIMEOUT"),
      v.literal("UNAVAILABLE"),
      v.literal("UNSUPPORTED"),
    ),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    accuracy: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) throw new Error("Event not found");
    if (ev.status === "RESOLVED" || ev.status === "CANCELLED") return null;

    const now = Date.now();
    if (args.status === "AVAILABLE") {
      const coords = validateCoords(args.latitude, args.longitude, args.accuracy);
      await ctx.db.patch(args.eventId, {
        status: ev.status === "CREATED" ? "ACTIVE" : ev.status,
        locationStatus: "AVAILABLE",
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        locationCapturedAt: now,
        liveSharing: true,
        shareToken: ev.shareToken ?? generateToken(),
        updatedAt: now,
      });
      await ctx.db.insert("locationPings", {
        eventId: args.eventId,
        userId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        capturedAt: now,
        createdAt: now,
      });
    } else {
      await ctx.db.patch(args.eventId, {
        status: ev.status === "CREATED" ? "ACTIVE" : ev.status,
        locationStatus: args.status,
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Resolve or cancel an event. Closing never claims to cancel a 112 call. */
export const closeEvent = mutation({
  args: {
    eventId: v.id("emergencyEvents"),
    resolution: v.union(v.literal("RESOLVED"), v.literal("CANCELLED")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) throw new Error("Event not found");
    if (ev.status === "RESOLVED" || ev.status === "CANCELLED") return null;

    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      status: args.resolution,
      resolvedAt: now,
      resolutionReason:
        args.resolution === "CANCELLED"
          ? "Marked as false alarm by user"
          : "Marked as handled by user",
      liveSharing: false,
      shareRevokedAt: ev.shareRevokedAt ?? now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.audit.logInternal, {
      userId,
      actorType: "user",
      action:
        args.resolution === "CANCELLED"
          ? "emergency.cancelled"
          : "emergency.resolved",
      resource: args.eventId,
      result: "SUCCESS",
    });
    return null;
  },
});

export const pingLocation = mutation({
  args: {
    eventId: v.id("emergencyEvents"),
    latitude: v.number(),
    longitude: v.number(),
    accuracy: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) throw new Error("Event not found");
    if (ev.status === "RESOLVED" || ev.status === "CANCELLED") return null;

    const coords = validateCoords(args.latitude, args.longitude, args.accuracy);
    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      lastPingAt: now,
      lastLatitude: coords.latitude,
      lastLongitude: coords.longitude,
      lastAccuracy: coords.accuracy,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      locationStatus: "AVAILABLE",
      locationCapturedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("locationPings", {
      eventId: args.eventId,
      userId,
      latitude: args.latitude,
      longitude: args.longitude,
      accuracy: args.accuracy,
      capturedAt: now,
      createdAt: now,
    });
    return null;
  },
});

export const listPings = query({
  args: { eventId: v.id("emergencyEvents") },
  returns: v.array(
    v.object({
      _id: v.id("locationPings"),
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
      capturedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) return [];
    return await ctx.db
      .query("locationPings")
      .withIndex("by_event_captured", (q) => q.eq("eventId", args.eventId))
      .order("desc")
      .take(200);
  },
});

// ---------------------------------------------------------------------------
// Share link (token-scoped, no auth)
// ---------------------------------------------------------------------------

export const shareByToken = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      userName: v.optional(v.string()),
      status: v.string(),
      locationStatus: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      lastPingAt: v.optional(v.number()),
      startedAt: v.number(),
      liveSharing: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ev = await ctx.db
      .query("emergencyEvents")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .first();
    if (!ev) return null;
    if (!ev.liveSharing || ev.shareRevokedAt) return null;
    if (ev.status === "RESOLVED" || ev.status === "CANCELLED") return null;
    const user = await ctx.db.get(ev.userId);
    // Minimum disclosure: no internal event ID, no notification details.
    return {
      userName: user?.name,
      status: ev.status,
      locationStatus: ev.locationStatus,
      latitude: ev.lastLatitude ?? ev.latitude,
      longitude: ev.lastLongitude ?? ev.longitude,
      accuracy: ev.lastAccuracy ?? ev.accuracy,
      lastPingAt: ev.lastPingAt,
      startedAt: ev.createdAt,
      liveSharing: ev.liveSharing,
    };
  },
});

export const revokeShare = mutation({
  args: { eventId: v.id("emergencyEvents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const ev = await ctx.db.get(args.eventId);
    if (!ev || ev.userId !== userId) throw new Error("Event not found");
    await ctx.db.patch(args.eventId, {
      liveSharing: false,
      shareRevokedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
