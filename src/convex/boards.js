// boards.js — the shared homework board, keyed by the sync code the user
// types on each device. The board is small and saved as a single document,
// which keeps sync dead simple. The code is a shared secret: anyone who
// knows it can read and write the board (the client treats it like a
// password and generates long random codes).
import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";

const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 64;

function assertCode(code) {
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
    throw new Error("Invalid sync code");
  }
}

export const get = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    assertCode(code);
    const doc = await ctx.db
      .query("boards")
      .withIndex("by_code", (q) => q.eq("code", code))
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
    code: v.string(),
    tasks: v.array(v.any()),
    subjects: v.array(v.any()),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    assertCode(args.code);
    const existing = await ctx.db
      .query("boards")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    const doc = {
      code: args.code,
      tasks: args.tasks,
      subjects: args.subjects,
      settings: args.settings,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.replace(existing._id, doc);
    else await ctx.db.insert("boards", doc);
  },
});
