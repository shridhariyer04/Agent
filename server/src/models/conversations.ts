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



export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),

  title: text("title"),

  isArchived: boolean("is_archived").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});