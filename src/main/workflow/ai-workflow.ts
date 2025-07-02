/**
 * @file Main AI workflow orchestration for analyzing text patterns and generating suggestions
 * @module ai-workflow
 */

import { StateGraph, MemorySaver, START, END } from '@langchain/langgraph';
import { OpenAI } from '@langchain/openai';
import * as keychainService from '../services/keychain-service';
import * as loggingService from '../services/logging-service';
import * as supabaseService from '../services/supabase-service';
import { embedTexts } from './embedding-node';
import { clusterEmbeddings } from './clustering-node';
import { synthesizeSuggestions } from './synthesis-node';
import { generateShortcutTrigger } from '../utils/trigger-generator';

// Define the state interface for the workflow
interface WorkflowState {
  logEntries?: Array<{
    timestamp: string;
    text: string;
    windowTitle?: string;
    processName?: string;
  }>;
  embeddings?: Array<{
    text: string;
    embedding: number[];
    index: number;
  }>;
  clusters?: Array<{
    texts: string[];
    centroid: number[];
    size: number;
  }>;
  suggestions?: Array<{
    trigger: string;
    replacement: string;
    sourceTexts: string[];
    confidence: number;
    suggestionId?: string; // Supabase record ID
  }>;
  errors?: string[];
  stepResults?: Record<string, any>;
  startTime?: number;
  supabaseInitialized?: boolean;
}

/**
 * Initializes Supabase connection and sets up start time tracking
 * @param state - Current workflow state
 * @returns Updated state with Supabase initialization status
 */
async function initializeWorkflowNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Initializing AI workflow...');
  
  const startTime = Date.now();
  
  try {
    // Initialize Supabase connection
    const supabaseInitialized = await supabaseService.initializeSupabase();
    
    if (supabaseInitialized) {
      console.log('Supabase connection established for this analysis');
    } else {
      console.log('Supabase not available, analysis will continue without persistence');
    }
    
    return {
      ...state,
      startTime,
      supabaseInitialized,
      stepResults: {
        ...state.stepResults,
        initialization: { 
          supabaseAvailable: supabaseInitialized,
          startTime
        }
      }
    };
    
  } catch (error) {
    console.error('Error initializing workflow:', error);
    return {
      ...state,
      startTime,
      supabaseInitialized: false,
      errors: [...(state.errors || []), `Failed to initialize workflow: ${error}`]
    };
  }
}

/**
 * Loads log entries from the local storage
 * @param state - Current workflow state
 * @returns Updated state with log entries
 */
async function loadLogEntriesNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Loading log entries...');
  
  try {
    const logEntries = await loggingService.getLogEntries();
    
    if (logEntries.length === 0) {
      console.log('No log entries found');
      return {
        ...state,
        logEntries: [],
        errors: [...(state.errors || []), 'No log entries found for analysis']
      };
    }
    
    console.log(`Loaded ${logEntries.length} log entries`);
    
    return {
      ...state,
      logEntries,
      stepResults: {
        ...state.stepResults,
        loadLogEntries: { count: logEntries.length }
      }
    };
    
  } catch (error) {
    console.error('Error loading log entries:', error);
    return {
      ...state,
      errors: [...(state.errors || []), `Failed to load log entries: ${error}`]
    };
  }
}

/**
 * Embeds the text entries using OpenAI embeddings
 * @param state - Current workflow state
 * @returns Updated state with embeddings
 */
async function embeddingNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Generating embeddings...');
  
  if (!state.logEntries || state.logEntries.length === 0) {
    return {
      ...state,
      errors: [...(state.errors || []), 'No log entries to embed']
    };
  }
  
  try {
    const apiKey = await keychainService.getApiKey();
    
    if (!apiKey) {
      return {
        ...state,
        errors: [...(state.errors || []), 'No OpenAI API key found']
      };
    }
    
    const embeddings = await embedTexts(state.logEntries, apiKey);
    
    console.log(`Generated ${embeddings.length} embeddings`);
    
    return {
      ...state,
      embeddings,
      stepResults: {
        ...state.stepResults,
        embedding: { count: embeddings.length }
      }
    };
    
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return {
      ...state,
      errors: [...(state.errors || []), `Failed to generate embeddings: ${error}`]
    };
  }
}

/**
 * Clusters the embeddings to find similar texts
 * @param state - Current workflow state
 * @returns Updated state with clusters
 */
async function clusteringNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Clustering embeddings...');
  
  if (!state.embeddings || state.embeddings.length === 0) {
    return {
      ...state,
      errors: [...(state.errors || []), 'No embeddings to cluster']
    };
  }
  
  try {
    const clusters = await clusterEmbeddings(state.embeddings);
    
    console.log(`Found ${clusters.length} clusters`);
    
    return {
      ...state,
      clusters,
      stepResults: {
        ...state.stepResults,
        clustering: { clusterCount: clusters.length }
      }
    };
    
  } catch (error) {
    console.error('Error clustering embeddings:', error);
    return {
      ...state,
      errors: [...(state.errors || []), `Failed to cluster embeddings: ${error}`]
    };
  }
}

/**
 * Synthesizes suggestions from clusters using GPT and stores them in Supabase
 * @param state - Current workflow state
 * @returns Updated state with suggestions
 */
async function synthesisNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Synthesizing suggestions...');
  
  if (!state.clusters || state.clusters.length === 0) {
    return {
      ...state,
      errors: [...(state.errors || []), 'No clusters to synthesize']
    };
  }
  
  try {
    const apiKey = await keychainService.getApiKey();
    
    if (!apiKey) {
      return {
        ...state,
        errors: [...(state.errors || []), 'No OpenAI API key found']
      };
    }
    
    const rawSuggestions = await synthesizeSuggestions(state.clusters, apiKey);
    
    // Generate triggers for each suggestion and store in Supabase
    const suggestions = [];
    
    for (const rawSuggestion of rawSuggestions) {
      const suggestion = {
        ...rawSuggestion,
        trigger: generateShortcutTrigger(rawSuggestion.replacement)
      };
      
      // Store in Supabase if available
      let suggestionId: string | undefined;
      if (state.supabaseInitialized) {
        suggestionId = await supabaseService.storeSuggestion({
          trigger: suggestion.trigger,
          replacement: suggestion.replacement,
          sourceTexts: suggestion.sourceTexts,
          confidence: suggestion.confidence
        }) || undefined;
      }
      
      suggestions.push({
        ...suggestion,
        suggestionId
      });
    }
    
    console.log(`Generated ${suggestions.length} suggestions`);
    
    return {
      ...state,
      suggestions,
      stepResults: {
        ...state.stepResults,
        synthesis: { 
          suggestionCount: suggestions.length,
          storedInSupabase: suggestions.filter(s => s.suggestionId).length
        }
      }
    };
    
  } catch (error) {
    console.error('Error synthesizing suggestions:', error);
    return {
      ...state,
      errors: [...(state.errors || []), `Failed to synthesize suggestions: ${error}`]
    };
  }
}

/**
 * Stores final analysis results in Supabase and completes the workflow
 * @param state - Current workflow state
 * @returns Updated state with final results
 */
async function storeResultsNode(state: WorkflowState): Promise<WorkflowState> {
  console.log('Storing analysis results...');
  
  try {
    const endTime = Date.now();
    const processingTime = state.startTime ? endTime - state.startTime : 0;
    
    // Store analysis results if Supabase is available
    if (state.supabaseInitialized) {
      const success = await supabaseService.storeAnalysisResult({
        totalPrompts: state.logEntries?.length || 0,
        clustersFound: state.clusters?.length || 0,
        suggestionsGenerated: state.suggestions?.length || 0,
        processingTimeMs: processingTime
      });
      
      if (success) {
        console.log('Analysis results stored in Supabase successfully');
      }
    }
    
    return {
      ...state,
      stepResults: {
        ...state.stepResults,
        finalResults: {
          totalPrompts: state.logEntries?.length || 0,
          clustersFound: state.clusters?.length || 0,
          suggestionsGenerated: state.suggestions?.length || 0,
          processingTimeMs: processingTime,
          storedInSupabase: state.supabaseInitialized
        }
      }
    };
    
  } catch (error) {
    console.error('Error storing analysis results:', error);
    return {
      ...state,
      errors: [...(state.errors || []), `Failed to store analysis results: ${error}`]
    };
  }
}

/**
 * Checks if the workflow should continue to the next step
 * @param state - Current workflow state
 * @returns Next step name or END
 */
function routeWorkflow(state: WorkflowState): string {
  // If there are critical errors, end the workflow
  if (state.errors && state.errors.length > 0) {
    const hasCriticalError = state.errors.some(error => 
      error.includes('No OpenAI API key') ||
      error.includes('No log entries found')
    );
    
    if (hasCriticalError) {
      return 'storeResults'; // Still store what we can before ending
    }
  }
  
  // Continue based on what data we have
  if (!state.startTime) return 'initializeWorkflow';
  if (!state.logEntries) return 'loadLogEntries';
  if (!state.embeddings) return 'embedding';
  if (!state.clusters) return 'clustering';
  if (!state.suggestions) return 'synthesis';
  if (!state.stepResults?.finalResults) return 'storeResults';
  
  return END;
}

/**
 * Creates and configures the AI workflow graph
 * @returns Configured StateGraph ready for execution
 */
export function createWorkflowGraph(): StateGraph<WorkflowState> {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      logEntries: null,
      embeddings: null,
      clusters: null,
      suggestions: null,
      errors: null,
      stepResults: null,
      startTime: null,
      supabaseInitialized: null,
    }
  });
  
  // Add nodes to the workflow
  workflow.addNode('initializeWorkflow', initializeWorkflowNode);
  workflow.addNode('loadLogEntries', loadLogEntriesNode);
  workflow.addNode('embedding', embeddingNode);
  workflow.addNode('clustering', clusteringNode);
  workflow.addNode('synthesis', synthesisNode);
  workflow.addNode('storeResults', storeResultsNode);
  
  // Define the workflow edges
  workflow.addEdge(START, 'initializeWorkflow');
  workflow.addConditionalEdges('initializeWorkflow', routeWorkflow);
  workflow.addConditionalEdges('loadLogEntries', routeWorkflow);
  workflow.addConditionalEdges('embedding', routeWorkflow);
  workflow.addConditionalEdges('clustering', routeWorkflow);
  workflow.addConditionalEdges('synthesis', routeWorkflow);
  workflow.addConditionalEdges('storeResults', routeWorkflow);
  
  return workflow;
}

/**
 * Executes the complete AI analysis workflow
 * @returns Promise resolving to the final workflow state
 */
export async function runAnalysisWorkflow(): Promise<WorkflowState> {
  console.log('Starting AI analysis workflow...');
  
  try {
    const workflow = createWorkflowGraph();
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });
    
    // Run the workflow
    const result = await app.invoke(
      { 
        errors: [],
        stepResults: {}
      },
      { 
        configurable: { 
          thread_id: `analysis-${Date.now()}` 
        } 
      }
    );
    
    console.log('AI analysis workflow completed');
    console.log('Results:', {
      logEntries: result.logEntries?.length || 0,
      embeddings: result.embeddings?.length || 0,
      clusters: result.clusters?.length || 0,
      suggestions: result.suggestions?.length || 0,
      errors: result.errors?.length || 0
    });
    
    return result;
    
  } catch (error) {
    console.error('Error running AI analysis workflow:', error);
    return {
      errors: [`Workflow execution failed: ${error}`],
      stepResults: {}
    };
  }
} 