import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";
import {conversations} from './conversations'


export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),

  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" }),

  role: text("role").notNull(), // user | assistant | system

  content: text("content").notNull(),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").defaultNow()
});