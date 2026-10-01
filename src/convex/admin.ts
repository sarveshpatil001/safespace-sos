import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Admin area: role-gated, org-wide views. Non-admins get empty/default data.
// ---------------------------------------------------------------------------

export const adminStats = query({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    totalEvents: v.number(),
    activeEvents: v.number(),
    totalContacts: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { totalUsers: 0, totalEvents: 0, activeEvents: 0, totalContacts: 0 };
    }
    const admin = await ctx.db.get(userId);
    if (admin?.role !== "admin") {
      return { totalUsers: 0, totalEvents: 0, activeEvents: 0, totalContacts: 0 };
    }
    const users = await ctx.db.query("users").collect();
    const events = await ctx.db.query("emergencyEvents").collect();
    const contacts = await ctx.db.query("trustedContacts").collect();
    return {
      totalUsers: users.length,
      totalEvents: events.length,
      activeEvents: events.filter((e) => e.status === "ACTIVE").length,
      totalContacts: contacts.length,
    };
  },
});

export const adminListUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      isAnonymous: v.optional(v.boolean()),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const admin = await ctx.db.get(userId);
    if (admin?.role !== "admin") return [];
    const rows = await ctx.db.query("users").order("desc").take(200);
    // Explicit projection matching the return validator — never raw documents.
    return rows.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isAnonymous: u.isAnonymous,
      _creationTime: u._creationTime,
    }));
  },
});

export const adminListEvents = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("emergencyEvents"),
      userId: v.id("users"),
      status: v.string(),
      locationStatus: v.string(),
      notificationStatus: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const admin = await ctx.db.get(userId);
    if (admin?.role !== "admin") return [];
    const rows = await ctx.db.query("emergencyEvents").order("desc").take(100);
    // Explicit projection matching the return validator — never raw documents.
    // userId is intentionally included: the admin table shows a user badge.
    return rows.map((e) => ({
      _id: e._id,
      userId: e.userId,
      status: e.status,
      locationStatus: e.locationStatus,
      notificationStatus: e.notificationStatus,
      createdAt: e.createdAt,
    }));
  },
});

export const adminListAudit = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      userId: v.optional(v.id("users")),
      action: v.string(),
      result: v.optional(
        v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("DENIED")),
      ),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const admin = await ctx.db.get(userId);
    if (admin?.role !== "admin") return [];
    const rows = await ctx.db.query("auditLogs").order("desc").take(100);
    // Explicit projection matching the return validator — never raw documents.
    return rows.map((a) => ({
      _id: a._id,
      userId: a.userId,
      action: a.action,
      result: a.result,
      createdAt: a.createdAt,
    }));
  },
});
