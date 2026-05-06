import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),

  name: text("name"),
  avatarUrl: text("avatar_url"),

  role: text("role").default("user"),

  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),

  lastLoginAt: timestamp("last_login_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});