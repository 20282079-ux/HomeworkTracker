// schema.js — Convex Auth's tables plus one document per user holding their
// whole homework board (tasks, subjects, settings). The board is small and
// saved as a single document, which keeps sync dead simple.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  userData: defineTable({
    userId: v.string(),
    tasks: v.array(v.any()),
    subjects: v.array(v.any()),
    settings: v.any(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
