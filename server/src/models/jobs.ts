import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { conversations } from "./conversations";



export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),

  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),

  url: text("url").notNull(),

  status: text("status").default("pending"), // pending | processing | completed | failed

  extractedContent: jsonb("extracted_content"),

  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),

  modelUsed: text("model_used"),

  processingTimeMs: integer("processing_time_ms"),

  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});