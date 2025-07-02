/**
 * @file Main AI workflow orchestration for analyzing text patterns and generating suggestions
 * @module ai-workflow
 */

import { StateGraph, MemorySaver, START, END } from '@langchain/langgraph';
import { OpenAI } from '@langchain/openai';
import * as keychainService from '../services/keychain-service';
import * as loggingService from '../services/logging-service';
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
  }>;
  errors?: string[];
  stepResults?: Record<string, any>;
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
 * Synthesizes suggestions from clusters using GPT
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
    
    // Generate triggers for each suggestion
    const suggestions = rawSuggestions.map(suggestion => ({
      ...suggestion,
      trigger: generateShortcutTrigger(suggestion.replacement)
    }));
    
    console.log(`Generated ${suggestions.length} suggestions`);
    
    return {
      ...state,
      suggestions,
      stepResults: {
        ...state.stepResults,
        synthesis: { suggestionCount: suggestions.length }
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
      return END;
    }
  }
  
  // Continue based on what data we have
  if (!state.logEntries) return 'loadLogEntries';
  if (!state.embeddings) return 'embedding';
  if (!state.clusters) return 'clustering';
  if (!state.suggestions) return 'synthesis';
  
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
    }
  });
  
  // Add nodes to the workflow
  workflow.addNode('loadLogEntries', loadLogEntriesNode);
  workflow.addNode('embedding', embeddingNode);
  workflow.addNode('clustering', clusteringNode);
  workflow.addNode('synthesis', synthesisNode);
  
  // Define the workflow edges
  workflow.addEdge(START, 'loadLogEntries');
  workflow.addConditionalEdges('loadLogEntries', routeWorkflow);
  workflow.addConditionalEdges('embedding', routeWorkflow);
  workflow.addConditionalEdges('clustering', routeWorkflow);
  workflow.addConditionalEdges('synthesis', routeWorkflow);
  
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