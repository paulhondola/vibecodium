import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

// Will create the db file in the server root
const sqlite = new Database("vibecodium.db");
export const db = drizzle(sqlite, { schema });

// Minimal migration for rapid prototyping
sqlite.exec(`
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
`);
