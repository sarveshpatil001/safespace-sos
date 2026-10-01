import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---------------------------------------------------------------------------
// SafeSpace domain enums
// ---------------------------------------------------------------------------

/** Event lifecycle state machine: CREATED -> ACTIVE -> RESOLVED | CANCELLED. */
export const eventStatusValidator = v.union(
  v.literal("CREATED"),
  v.literal("ACTIVE"),
  v.literal("RESOLVED"),
  v.literal("CANCELLED"),
);

/**
 * Location capture status. Orthogonal to event status so an event is never in
 * a contradictory state (e.g. "resolved but location pending").
 */
export const locationStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("AVAILABLE"),
  v.literal("DENIED"),
  v.literal("TIMEOUT"),
  v.literal("UNAVAILABLE"),
  v.literal("UNSUPPORTED"),
);

/**
 * Notification outcome across all contacts. Never claims delivery beyond what
 * the provider actually reports.
 */
export const notificationStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("SENT"),
  v.literal("PARTIAL"),
  v.literal("FAILED"),
  v.literal("NOT_CONFIGURED"),
  v.literal("NO_CHANNELS"),
);

/** Per-attempt outcome, restricted to what we can honestly know. */
export const attemptStatusValidator = v.union(
  v.literal("SENT"),
  v.literal("FAILED"),
  v.literal("NOT_CONFIGURED"),
  v.literal("SKIPPED"),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // SafeSpace profile additions
      phone: v.optional(v.string()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // -------------------------------------------------------------------------
    // SafeSpace tables
    // -------------------------------------------------------------------------

    trustedContacts: defineTable({
      userId: v.id("users"),
      name: v.string(),
      relationship: v.optional(v.string()),
      phone: v.string(),
      email: v.optional(v.string()),
      active: v.boolean(),
      notifyEmail: v.boolean(),
      notifySms: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_active", ["userId", "active"]),

    emergencyEvents: defineTable({
      userId: v.id("users"),
      status: eventStatusValidator,

      // Location (orthogonal to status)
      locationStatus: locationStatusValidator,
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      locationCapturedAt: v.optional(v.number()),

      // Live location sharing (v1 must-have)
      liveSharing: v.boolean(),
      shareToken: v.optional(v.string()),
      shareRevokedAt: v.optional(v.number()),

      // Notifications (orthogonal to status)
      notificationStatus: notificationStatusValidator,
      notificationsAttemptedAt: v.optional(v.number()),

      // Latest ping, denormalized for cheap public share queries
      lastPingAt: v.optional(v.number()),
      lastLatitude: v.optional(v.number()),
      lastLongitude: v.optional(v.number()),
      lastAccuracy: v.optional(v.number()),

      resolvedAt: v.optional(v.number()),
      resolutionReason: v.optional(v.string()),

      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_status", ["userId", "status"])
      .index("by_share_token", ["shareToken"])
      .index("by_status", ["status"]),

    locationPings: defineTable({
      eventId: v.id("emergencyEvents"),
      userId: v.id("users"),
      latitude: v.number(),
      longitude: v.number(),
      accuracy: v.optional(v.number()),
      capturedAt: v.number(),
      createdAt: v.number(),
    }).index("by_event_captured", ["eventId", "capturedAt"]),

    notificationAttempts: defineTable({
      eventId: v.id("emergencyEvents"),
      userId: v.id("users"),
      contactId: v.optional(v.id("trustedContacts")),
      contactName: v.string(),
      channel: v.union(v.literal("email"), v.literal("sms")),
      status: attemptStatusValidator,
      // Provider-reported message id when available. Never more than the
      // provider itself confirmed.
      providerMessageId: v.optional(v.string()),
      detail: v.optional(v.string()),
      attemptedAt: v.number(),
    }).index("by_event", ["eventId"]),

    auditLogs: defineTable({
      userId: v.optional(v.id("users")),
      actorType: v.union(v.literal("user"), v.literal("system")),
      action: v.string(),
      resource: v.optional(v.string()),
      result: v.optional(
        v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("DENIED")),
      ),
      metadata: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: true,
  },
);

export default schema;
