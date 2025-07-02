-- DryPrompt Database Schema
-- This script creates the required tables for storing analysis results and user interactions

-- Table for storing AI-generated suggestions
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trigger TEXT NOT NULL,
    replacement TEXT NOT NULL,
    source_texts TEXT[] NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing analysis results and performance metrics
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_prompts INTEGER NOT NULL CHECK (total_prompts >= 0),
    clusters_found INTEGER NOT NULL CHECK (clusters_found >= 0),
    suggestions_generated INTEGER NOT NULL CHECK (suggestions_generated >= 0),
    analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    processing_time_ms INTEGER NOT NULL CHECK (processing_time_ms >= 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON suggestions(created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_trigger ON suggestions(trigger);

CREATE INDEX IF NOT EXISTS idx_analysis_results_timestamp ON analysis_results(analysis_timestamp);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on suggestions table
DROP TRIGGER IF EXISTS update_suggestions_updated_at ON suggestions;
CREATE TRIGGER update_suggestions_updated_at
    BEFORE UPDATE ON suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for enhanced security
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies to allow authenticated users to access their data
-- Note: These are basic policies - adjust based on your security requirements
CREATE POLICY "Allow all operations for authenticated users" ON suggestions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON analysis_results
    FOR ALL USING (auth.role() = 'authenticated');

-- Grant necessary permissions to the anon role for the application
GRANT SELECT, INSERT, UPDATE ON suggestions TO anon;
GRANT SELECT, INSERT ON analysis_results TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon; 