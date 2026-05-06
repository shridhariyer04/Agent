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


export const generatedContent = pgTable("generated_content", {
  id: uuid("id").defaultRandom().primaryKey(),

  jobId: uuid("job_id")
    .references(() => jobs.id, { onDelete: "cascade" }),

  platform: text("platform").notNull(),

  content: text("content").notNull(),

  createdAt: timestamp("created_at").defaultNow()
});