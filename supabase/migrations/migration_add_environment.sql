-- Add environment column to projects table
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'auto';
