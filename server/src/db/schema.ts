import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    repoUrl: text("repo_url").notNull(),
    createdAt: text("created_at").notNull()
});

export const files = sqliteTable("files", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    path: text("path").notNull(),
    content: text("content"),
});

export const sessions = sqliteTable("sessions", {
    token:     text("token").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdBy: text("created_by").notNull(),
    label:     text("label"),
});
