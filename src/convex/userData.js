// userData.js — the user's homework board in the cloud: one document per
// Google account, read reactively and saved whole (the board is tiny, so a
// single document is simpler than per-row tables).
import { query, mutation } from "./_generated/server.js";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const doc = await ctx.db
      .query("userData")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!doc) return null;
    return {
      tasks: doc.tasks,
      subjects: doc.subjects,
      settings: doc.settings,
      updatedAt: doc.updatedAt,
    };
  },
});

export const save = mutation({
  args: {
    tasks: v.array(v.any()),
    subjects: v.array(v.any()),
    settings: v.any(),
  },
  handler: async (ctx, { tasks, subjects, settings }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("userData")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const doc = { userId, tasks, subjects, settings, updatedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("userData", doc);
  },
});
