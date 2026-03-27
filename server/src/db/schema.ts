import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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
