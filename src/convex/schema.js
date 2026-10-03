// schema.js — one document per sync code holding the shared homework board
// (tasks, subjects, settings). No accounts: devices that enter the same
// private sync code read and write the same board.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  boards: defineTable({
    code: v.string(),
    tasks: v.array(v.any()),
    subjects: v.array(v.any()),
    settings: v.any(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),
});
