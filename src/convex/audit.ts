import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_LOGS = 50;

export const logInternal = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system")),
    action: v.string(),
    resource: v.optional(v.string()),
    result: v.optional(
      v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("DENIED")),
    ),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** Recent audit entries for the signed-in user (own actions only). */
export const listMine = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      action: v.string(),
      resource: v.optional(v.string()),
      result: v.optional(
        v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("DENIED")),
      ),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(args.limit ?? MAX_LOGS, MAX_LOGS));
  },
});
