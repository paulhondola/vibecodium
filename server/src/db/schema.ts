import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

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
    updatedAt: integer("updated_at"),
}, (t) => ({
    unq: unique().on(t.projectId, t.path)
}));

export const snapshots = sqliteTable("snapshots", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    path: text("path").notNull(),
    content: text("content"),
    timestamp: integer("timestamp").notNull(),
});

export const sessions = sqliteTable("sessions", {
    token:     text("token").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdBy: text("created_by").notNull(),
    label:     text("label"),
});

export const users = sqliteTable("users", {
    auth0Id: text("auth0_id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    picture: text("picture"),
    bio: text("bio"),
    language: text("language"),
    location: text("location"),
    createdAt: integer("created_at").notNull(),
});

export const user_tokens = sqliteTable("user_tokens", {
    auth0Id: text("auth0_id").primaryKey().references(() => users.auth0Id),
    githubToken: text("github_token"),
    vercelToken: text("vercel_token"),
});
