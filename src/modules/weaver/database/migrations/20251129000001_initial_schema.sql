-- Initial database schema

-- Schema version tracking
CREATE TABLE IF NOT EXISTS _schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,
    description TEXT NOT NULL
);

-- Track schema version
INSERT INTO _schema_version (version, applied_at, description) 
VALUES (1, datetime('now'), 'Initial schema creation');

-- Adopted repositories
CREATE TABLE IF NOT EXISTS adopted_repos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_url TEXT NOT NULL UNIQUE,
    git_ref TEXT NOT NULL,
    adopted_at TEXT NOT NULL,
    metadata TEXT NOT NULL,
    status TEXT NOT NULL,
    health TEXT NOT NULL
);

-- Repository categories
CREATE TABLE IF NOT EXISTS repo_categories (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    category_name TEXT NOT NULL,
    team_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(repo_id) REFERENCES adopted_repos(id)
);

-- Voice aliases for repository commands
CREATE TABLE IF NOT EXISTS voice_aliases (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    alias TEXT NOT NULL UNIQUE,
    command_pattern TEXT NOT NULL,
    parameters TEXT NOT NULL,
    last_used TEXT NOT NULL,
    FOREIGN KEY(repo_id) REFERENCES adopted_repos(id)
);

-- Runtime configurations
CREATE TABLE IF NOT EXISTS runtime_configs (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    runtime_type TEXT NOT NULL,
    config TEXT NOT NULL,
    container_id TEXT,
    wasm_module TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(repo_id) REFERENCES adopted_repos(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_repos_status ON adopted_repos(status);
CREATE INDEX IF NOT EXISTS idx_repos_health ON adopted_repos(health);
CREATE INDEX IF NOT EXISTS idx_categories_team ON repo_categories(team_type);
CREATE INDEX IF NOT EXISTS idx_aliases_lookup ON voice_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_runtime_type ON runtime_configs(runtime_type);