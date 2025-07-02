/**
 * @file Supabase service for managing persistent storage of analysis results and user interactions
 * @module supabase-service
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Interface for suggestion data stored in database
interface SuggestionRecord {
  id?: string;
  trigger: string;
  replacement: string;
  source_texts: string[];
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

// Interface for analysis results
interface AnalysisRecord {
  id?: string;
  total_prompts: number;
  clusters_found: number;
  suggestions_generated: number;
  analysis_timestamp: string;
  processing_time_ms: number;
}

let supabaseClient: SupabaseClient | null = null;
let isConnectionValid = false;

/**
 * Initializes the Supabase client with environment variables
 * @returns Promise resolving to success status
 */
export async function initializeSupabase(): Promise<boolean> {
  try {
    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found in environment variables. Please check your .env file.');
      return false;
    }
    
    // Initialize Supabase client
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Test connection
    const { error } = await supabaseClient.from('suggestions').select('count').limit(1);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.warn('Supabase database tables not set up yet. See SUPABASE_SETUP.md for instructions.');
      } else {
        console.warn('Supabase connection test failed:', error.message);
      }
      isConnectionValid = false;
      return false;
    }
    
    isConnectionValid = true;
    console.log('Supabase service initialized successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    isConnectionValid = false;
    return false;
  }
}

/**
 * Checks if Supabase is available and connected
 * @returns Whether Supabase is ready for use
 */
export function isSupabaseAvailable(): boolean {
  return supabaseClient !== null && isConnectionValid;
}

/**
 * Stores a suggestion in the database
 * @param suggestion - The suggestion data to store
 * @returns Promise resolving to the stored record ID or null if failed
 */
export async function storeSuggestion(suggestion: {
  trigger: string;
  replacement: string;
  sourceTexts: string[];
  confidence: number;
}): Promise<string | null> {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping suggestion storage');
    return null;
  }
  
  try {
    const record: SuggestionRecord = {
      trigger: suggestion.trigger,
      replacement: suggestion.replacement,
      source_texts: suggestion.sourceTexts,
      confidence: suggestion.confidence,
      status: 'pending'
    };
    
    const { data, error } = await supabaseClient!
      .from('suggestions')
      .insert([record])
      .select('id')
      .single();
    
    if (error) {
      console.error('Failed to store suggestion:', error);
      return null;
    }
    
    console.log(`Stored suggestion: ${suggestion.trigger} (ID: ${data.id})`);
    return data.id;
    
  } catch (error) {
    console.error('Error storing suggestion:', error);
    return null;
  }
}

/**
 * Updates a suggestion's status when user takes action
 * @param suggestionId - The ID of the suggestion to update
 * @param status - The new status ('accepted' or 'rejected')
 * @returns Promise resolving to success status
 */
export async function updateSuggestionStatus(
  suggestionId: string, 
  status: 'accepted' | 'rejected'
): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping status update');
    return false;
  }
  
  try {
    const { error } = await supabaseClient!
      .from('suggestions')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', suggestionId);
    
    if (error) {
      console.error('Failed to update suggestion status:', error);
      return false;
    }
    
    console.log(`Updated suggestion ${suggestionId} status to: ${status}`);
    return true;
    
  } catch (error) {
    console.error('Error updating suggestion status:', error);
    return false;
  }
}

/**
 * Stores analysis results in the database
 * @param analysisData - The analysis results to store
 * @returns Promise resolving to success status
 */
export async function storeAnalysisResult(analysisData: {
  totalPrompts: number;
  clustersFound: number;
  suggestionsGenerated: number;
  processingTimeMs: number;
}): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    console.log('Supabase not available, skipping analysis storage');
    return false;
  }
  
  try {
    const record: AnalysisRecord = {
      total_prompts: analysisData.totalPrompts,
      clusters_found: analysisData.clustersFound,
      suggestions_generated: analysisData.suggestionsGenerated,
      analysis_timestamp: new Date().toISOString(),
      processing_time_ms: analysisData.processingTimeMs
    };
    
    const { error } = await supabaseClient!
      .from('analysis_results')
      .insert([record]);
    
    if (error) {
      console.error('Failed to store analysis result:', error);
      return false;
    }
    
    console.log('Stored analysis result successfully');
    return true;
    
  } catch (error) {
    console.error('Error storing analysis result:', error);
    return false;
  }
}

/**
 * Retrieves suggestion statistics for analytics
 * @returns Promise resolving to suggestion statistics
 */
export async function getSuggestionStats(): Promise<{
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
} | null> {
  if (!isSupabaseAvailable()) {
    return null;
  }
  
  try {
    const { data, error } = await supabaseClient!
      .from('suggestions')
      .select('status');
    
    if (error) {
      console.error('Failed to get suggestion stats:', error);
      return null;
    }
    
    const stats = {
      total: data.length,
      accepted: data.filter(s => s.status === 'accepted').length,
      rejected: data.filter(s => s.status === 'rejected').length,
      pending: data.filter(s => s.status === 'pending').length
    };
    
    return stats;
    
  } catch (error) {
    console.error('Error getting suggestion stats:', error);
    return null;
  }
}

/**
 * Gets recent analysis results for monitoring
 * @param limit - Maximum number of results to return
 * @returns Promise resolving to array of recent analysis results
 */
export async function getRecentAnalyses(limit: number = 10): Promise<AnalysisRecord[]> {
  if (!isSupabaseAvailable()) {
    return [];
  }
  
  try {
    const { data, error } = await supabaseClient!
      .from('analysis_results')
      .select('*')
      .order('analysis_timestamp', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to get recent analyses:', error);
      return [];
    }
    
    return data || [];
    
  } catch (error) {
    console.error('Error getting recent analyses:', error);
    return [];
  }
}

/**
 * Gracefully handles network errors or loss of internet connection
 * @returns Promise resolving to connection status
 */
export async function checkConnection(): Promise<boolean> {
  if (!supabaseClient) {
    return false;
  }
  
  try {
    const { error } = await supabaseClient
      .from('suggestions')
      .select('count')
      .limit(1);
    
    isConnectionValid = !error;
    return isConnectionValid;
    
  } catch (error) {
    console.warn('Supabase connection check failed:', error);
    isConnectionValid = false;
    return false;
  }
} 