import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";
import { jobs } from "./jobs";



// add to src/db.ts alongside the other tables
export const revisions = pgTable("revisions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  platform:    text("platform").notNull(),
  version:     integer("version").notNull().default(1),
  content:     text("content").notNull(),     // JSON-stringified PlatformPost
  instruction: text("instruction"),           // user's refinement instruction
  createdAt:   timestamp("created_at").defaultNow(),
});