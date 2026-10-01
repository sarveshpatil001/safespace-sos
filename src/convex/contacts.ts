import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d{7,15}$/.test(digits)) return null;
  return plus ? `+${digits}` : digits;
}

function validEmail(email: string): boolean {
  const t = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && t.length <= 254;
}

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const patch: { name?: string; phone?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim().replace(/\s+/g, " ").slice(0, 80);
      if (!name) throw new Error("Name can't be empty");
      patch.name = name;
    }
    if (args.phone !== undefined) {
      const digits = args.phone.replace(/[\s\-().]/g, "").replace(/^\+/, "");
      if (digits && !/^\d{7,15}$/.test(digits)) {
        throw new Error("Enter a valid phone number (7-15 digits, optional +)");
      }
      patch.phone = args.phone.trim() || undefined;
    }
    await ctx.db.patch(userId, patch);
    return null;
  },
});

export const listContacts = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("trustedContacts"),
      _creationTime: v.number(),
      name: v.string(),
      relationship: v.optional(v.string()),
      phone: v.string(),
      email: v.optional(v.string()),
      active: v.boolean(),
      notifySms: v.boolean(),
      notifyEmail: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("trustedContacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createContact = mutation({
  args: {
    name: v.string(),
    relationship: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    active: v.boolean(),
    notifySms: v.boolean(),
    notifyEmail: v.boolean(),
  },
  returns: v.id("trustedContacts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const name = args.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) throw new Error("Contact name is required");
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error("Enter a valid phone number: 7-15 digits, optionally starting with +");
    }
    if (args.email?.trim() && !validEmail(args.email)) {
      throw new Error("Enter a valid email address");
    }
    const now = Date.now();
    return await ctx.db.insert("trustedContacts", {
      userId,
      name,
      relationship: args.relationship?.trim().slice(0, 60) || undefined,
      phone,
      email: args.email?.trim() || undefined,
      active: args.active,
      notifySms: args.notifySms,
      notifyEmail: args.notifyEmail,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateContact = mutation({
  args: {
    id: v.id("trustedContacts"),
    name: v.string(),
    relationship: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    active: v.boolean(),
    notifySms: v.boolean(),
    notifyEmail: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Contact not found");
    }
    const name = args.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) throw new Error("Contact name is required");
    const phone = normalizePhone(args.phone);
    if (!phone) {
      throw new Error("Enter a valid phone number: 7-15 digits, optionally starting with +");
    }
    if (args.email?.trim() && !validEmail(args.email)) {
      throw new Error("Enter a valid email address");
    }
    await ctx.db.patch(args.id, {
      name,
      relationship: args.relationship?.trim().slice(0, 60) || undefined,
      phone,
      email: args.email?.trim() || undefined,
      active: args.active,
      notifySms: args.notifySms,
      notifyEmail: args.notifyEmail,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const setContactActive = mutation({
  args: { id: v.id("trustedContacts"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Contact not found");
    }
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
    return null;
  },
});

export const deleteContact = mutation({
  args: { id: v.id("trustedContacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Contact not found");
    }
    await ctx.db.delete(args.id);
    return null;
  },
});
