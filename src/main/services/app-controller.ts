/**
 * @file Application state controller for managing global app state and automated workflows
 * @module app-controller
 */

import * as keychainService from './keychain-service';
import * as permissionService from './permission-service';
import * as monitoringService from './monitoring-service';
import * as notificationService from './notification-service';
import { runAnalysisWorkflow } from '../workflow/ai-workflow';

// Application states
export type AppState = 
  | 'starting'           // Initial startup
  | 'configuration-needed' // No API key
  | 'permission-needed'  // No accessibility permission  
  | 'idle'              // Ready and monitoring
  | 'analyzing'         // AI analysis in progress
  | 'error';            // Error state

// Analysis scheduling configuration
const ANALYSIS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MIN_LOG_ENTRIES_FOR_ANALYSIS = 5; // Minimum entries before analysis

// Global application state
interface ApplicationState {
  currentState: AppState;
  isAnalyzing: boolean;
  analysisTimer?: NodeJS.Timeout;
  lastAnalysisTime?: Date;
  permissionMonitor?: () => void;
}

let appState: ApplicationState = {
  currentState: 'starting',
  isAnalyzing: false
};

// State change callbacks
const stateChangeCallbacks: Array<(state: AppState) => void> = [];

/**
 * Gets the current application state
 * @returns Current app state
 */
export function getCurrentState(): AppState {
  return appState.currentState;
}

/**
 * Gets detailed application status
 * @returns Detailed status information
 */
export function getDetailedStatus(): {
  state: AppState;
  isAnalyzing: boolean;
  lastAnalysisTime?: Date;
  nextAnalysisTime?: Date;
  monitoringActive: boolean;
} {
  const monitoringStatus = monitoringService.getMonitoringStatus();
  const nextAnalysisTime = appState.analysisTimer && appState.lastAnalysisTime 
    ? new Date(appState.lastAnalysisTime.getTime() + ANALYSIS_INTERVAL_MS)
    : undefined;

  return {
    state: appState.currentState,
    isAnalyzing: appState.isAnalyzing,
    lastAnalysisTime: appState.lastAnalysisTime,
    nextAnalysisTime,
    monitoringActive: monitoringStatus.isRunning
  };
}

/**
 * Registers a callback for state changes
 * @param callback - Function to call when state changes
 * @returns Function to unregister the callback
 */
export function onStateChange(callback: (state: AppState) => void): () => void {
  stateChangeCallbacks.push(callback);
  
  // Return cleanup function
  return () => {
    const index = stateChangeCallbacks.indexOf(callback);
    if (index > -1) {
      stateChangeCallbacks.splice(index, 1);
    }
  };
}

/**
 * Updates the application state and notifies listeners
 * @param newState - The new state to set
 */
function setState(newState: AppState): void {
  if (appState.currentState !== newState) {
    console.log(`State change: ${appState.currentState} -> ${newState}`);
    appState.currentState = newState;
    
    // Notify all callbacks
    stateChangeCallbacks.forEach(callback => {
      try {
        callback(newState);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }
}

/**
 * Initializes the application and determines initial state
 * @returns Promise resolving when initialization is complete
 */
export async function initializeApp(): Promise<void> {
  console.log('Initializing application state...');
  
  try {
    // Check if API key is configured
    const hasApiKey = await keychainService.hasApiKey();
    
    if (!hasApiKey) {
      console.log('No API key found');
      setState('configuration-needed');
      return;
    }
    
    // Check for Accessibility permissions
    const hasPermission = await permissionService.hasAccessibilityPermission();
    
    if (!hasPermission) {
      console.log('Accessibility permission required');
      setState('permission-needed');
      startPermissionMonitoring();
      return;
    }
    
    // Both API key and permissions are available
    console.log('API key and permissions found, starting monitoring...');
    monitoringService.startMonitoring();
    
    // Show monitoring started notification
    const status = monitoringService.getMonitoringStatus();
    notificationService.showMonitoringStartedNotification(status.captureMode);
    
    // Start automated analysis scheduling
    startAutomatedAnalysis();
    
    setState('idle');
    
  } catch (error) {
    console.error('Error during app initialization:', error);
    setState('error');
  }
}

/**
 * Triggers a manual analysis (prevents automated analysis during execution)
 * @returns Promise resolving when analysis is complete
 */
export async function triggerManualAnalysis(): Promise<void> {
  if (appState.isAnalyzing) {
    console.log('Analysis already in progress, skipping manual trigger');
    return;
  }
  
  await runAnalysis(true);
}

/**
 * Starts automated analysis scheduling
 */
function startAutomatedAnalysis(): void {
  if (appState.analysisTimer) {
    console.log('Automated analysis already scheduled');
    return;
  }
  
  console.log(`Starting automated analysis (every ${ANALYSIS_INTERVAL_MS / 60000} minutes)`);
  
  appState.analysisTimer = setInterval(async () => {
    if (!appState.isAnalyzing && appState.currentState === 'idle') {
      await runAnalysis(false);
    }
  }, ANALYSIS_INTERVAL_MS);
  
  // Do an initial check in 1 minute if we have enough data
  setTimeout(async () => {
    if (!appState.isAnalyzing && appState.currentState === 'idle') {
      const loggingService = await import('./logging-service');
      const entries = await loggingService.getLogEntries();
      
      if (entries.length >= MIN_LOG_ENTRIES_FOR_ANALYSIS) {
        console.log(`Found ${entries.length} log entries, running initial analysis`);
        await runAnalysis(false);
      }
    }
  }, 60000); // 1 minute
}

/**
 * Stops automated analysis scheduling
 */
function stopAutomatedAnalysis(): void {
  if (appState.analysisTimer) {
    clearInterval(appState.analysisTimer);
    appState.analysisTimer = undefined;
    console.log('Stopped automated analysis scheduling');
  }
}

/**
 * Runs the AI analysis workflow with proper state management
 * @param isManual - Whether this is a manual or automated analysis
 */
async function runAnalysis(isManual: boolean): Promise<void> {
  if (appState.isAnalyzing) {
    console.log('Analysis already in progress');
    return;
  }
  
  console.log(`Starting ${isManual ? 'manual' : 'automated'} analysis...`);
  
  appState.isAnalyzing = true;
  setState('analyzing');
  
  try {
    const result = await runAnalysisWorkflow();
    appState.lastAnalysisTime = new Date();
    
    if (result.suggestions && result.suggestions.length > 0) {
      console.log(`Analysis complete: ${result.suggestions.length} suggestions generated`);
      
      // Show analysis complete notification
      notificationService.showAnalysisCompleteNotification(result.suggestions.length);
      
      // Show individual suggestion notifications
      await notificationService.showMultipleSuggestions(
        result.suggestions,
        {
          onAccepted: (suggestion) => {
            console.log(`User accepted suggestion: ${suggestion.trigger}`);
          },
          onRejected: (suggestion) => {
            console.log(`User rejected suggestion: ${suggestion.trigger}`);
          }
        }
      );
    } else {
      console.log('Analysis complete: No suggestions generated');
      
      // Show completion notification even with no suggestions
      notificationService.showAnalysisCompleteNotification(0);
    }
    
    // Archive processed logs to prevent indefinite growth
    await archiveProcessedLogs();
    
  } catch (error) {
    console.error('Analysis failed:', error);
    setState('error');
    
    // Recovery: try to return to idle state after a delay
    setTimeout(() => {
      if (appState.currentState === 'error') {
        setState('idle');
      }
    }, 30000); // 30 seconds
  } finally {
    appState.isAnalyzing = false;
    
    // Return to idle state if we're currently analyzing
    if (appState.currentState === 'analyzing') {
      setState('idle');
    }
  }
}

/**
 * Archives processed log files to prevent indefinite growth
 */
async function archiveProcessedLogs(): Promise<void> {
  try {
    const loggingService = await import('./logging-service');
    await loggingService.archiveCurrentLog();
    console.log('Successfully archived processed logs');
  } catch (error) {
    console.error('Error archiving logs:', error);
    // Don't throw - this shouldn't stop the analysis workflow
  }
}

/**
 * Starts monitoring for permission changes
 */
function startPermissionMonitoring(): void {
  if (appState.permissionMonitor) {
    return; // Already monitoring
  }
  
  console.log('Starting permission monitoring...');
  
  appState.permissionMonitor = permissionService.monitorPermissionChanges(async (hasPermission) => {
    if (hasPermission) {
      console.log('Accessibility permission granted');
      
      // Check if we also have API key
      const hasApiKey = await keychainService.hasApiKey();
      
      if (hasApiKey) {
        // Start monitoring and automated analysis
        monitoringService.startMonitoring();
        
        const status = monitoringService.getMonitoringStatus();
        notificationService.showMonitoringStartedNotification(status.captureMode);
        
        startAutomatedAnalysis();
        setState('idle');
      } else {
        setState('configuration-needed');
      }
      
      // Stop permission monitoring
      stopPermissionMonitoring();
    }
  });
}

/**
 * Stops monitoring for permission changes
 */
function stopPermissionMonitoring(): void {
  if (appState.permissionMonitor) {
    appState.permissionMonitor();
    appState.permissionMonitor = undefined;
    console.log('Stopped permission monitoring');
  }
}

/**
 * Handles API key updates
 * @param apiKey - The new API key
 */
export async function handleApiKeyUpdate(apiKey: string): Promise<void> {
  try {
    await keychainService.saveApiKey(apiKey);
    
    // Check permissions and update state accordingly
    const hasPermission = await permissionService.hasAccessibilityPermission();
    
    if (hasPermission) {
      // Start monitoring and automated analysis
      monitoringService.startMonitoring();
      
      const status = monitoringService.getMonitoringStatus();
      notificationService.showMonitoringStartedNotification(status.captureMode);
      
      startAutomatedAnalysis();
      setState('idle');
    } else {
      setState('permission-needed');
      startPermissionMonitoring();
      await permissionService.requestAccessibilityPermission();
    }
    
  } catch (error) {
    console.error('Error handling API key update:', error);
    setState('error');
  }
}

/**
 * Cleanup function to call when app is shutting down
 */
export function cleanup(): void {
  console.log('Cleaning up app controller...');
  
  // Stop automated analysis
  stopAutomatedAnalysis();
  
  // Stop permission monitoring
  stopPermissionMonitoring();
  
  // Stop monitoring service
  monitoringService.stopMonitoring();
  
  // Clear state
  appState.isAnalyzing = false;
  setState('starting');
} 