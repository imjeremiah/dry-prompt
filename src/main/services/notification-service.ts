/**
 * @file Notification service for displaying AI-generated suggestions to users with editing capabilities
 * @module notification-service
 */

import { Notification } from 'electron';
import * as supabaseService from './supabase-service';
import { createEditDialog } from './edit-dialog-window';

// Interface for suggestion data
interface SuggestionData {
  trigger: string;
  replacement: string;
  sourceTexts: string[];
  confidence: number;
  suggestionId?: string; // Supabase record ID for tracking user feedback
}

// Enhanced interface for notification callbacks including edit actions
interface NotificationCallbacks {
  onAccepted?: (suggestion: SuggestionData) => void;
  onRejected?: (suggestion: SuggestionData) => void;
  onEdit?: (suggestion: SuggestionData) => void;
}



/**
 * Shows a native macOS notification for a text replacement suggestion
 * @param suggestion - The suggestion data to display
 * @param callbacks - Optional callbacks for user actions
 * @returns Promise resolving when notification is shown
 */
export async function showSuggestionNotification(
  suggestion: SuggestionData,
  callbacks: NotificationCallbacks = {}
): Promise<void> {
  if (!suggestion || !suggestion.trigger || !suggestion.replacement) {
    throw new Error('Invalid suggestion data provided');
  }

  const clusterInfo = suggestion.sourceTexts ? `Found ${suggestion.sourceTexts.length} similar prompts` : '';

  const notification = new Notification({
    title: 'DryPrompt - New Shortcut Suggestion',
    body: `${clusterInfo}\nSuggested: "${suggestion.trigger}" → "${truncateText(suggestion.replacement, 60)}"`,
    hasReply: false,
    actions: [
      {
        type: 'button',
        text: 'Open Editor'
      }
    ],
    closeButtonText: 'Dismiss'
  });

  // Handle user clicking action buttons
  notification.on('action', async (event, index) => {
    if (index === 0) { // Open Editor button
      console.log(`User wants to review suggestion: ${suggestion.trigger}`);
      await handleOpenEditor(suggestion, callbacks);
    }
  });

  // Handle notification being closed without action (dismiss)
  notification.on('close', async () => {
    console.log(`Notification dismissed for suggestion: ${suggestion.trigger}`);
    await handleDismiss(suggestion, callbacks);
  });

  // Handle notification click - open editor instead of dismiss
  notification.on('click', async () => {
    console.log(`Notification clicked for suggestion: ${suggestion.trigger} - opening editor`);
    await handleOpenEditor(suggestion, callbacks);
  });

  // Show the notification
  notification.show();
  console.log(`✅ Shown suggestion notification: ${suggestion.trigger}`);
}

/**
 * Handles opening the editor for review and manual copy/paste
 * @param suggestion - The suggestion data
 * @param callbacks - Notification callbacks
 */
async function handleOpenEditor(suggestion: SuggestionData, callbacks: NotificationCallbacks): Promise<void> {
  try {
    console.log(`Opening edit dialog for suggestion: ${suggestion.trigger}`);
    
    // Open the edit dialog with the AI suggestion and cluster data
    await createEditDialog(suggestion, {
      onConfirm: async (editedSuggestion) => {
        console.log(`User confirmed suggestion for manual copy/paste: ${editedSuggestion.trigger}`);
        
        // Show instructions for manual copy/paste
        showManualCopyInstructions(editedSuggestion.trigger, editedSuggestion.replacement);
        
        // Update status in Supabase
        if (suggestion.suggestionId) {
          await supabaseService.updateSuggestionStatus(suggestion.suggestionId, 'accepted');
        }
        
        callbacks.onAccepted?.(editedSuggestion);
      },
      onCancel: () => {
        console.log(`User cancelled review for: ${suggestion.trigger}`);
        // Treat cancel as a rejection
        callbacks.onRejected?.(suggestion);
      }
    });
    
    callbacks.onEdit?.(suggestion);
    
  } catch (error) {
    console.error('Error opening edit dialog:', error);
    showErrorNotification('Error opening editor. Please try again.');
  }
}

/**
 * Handles opening the multi-suggestion editor for reviewing multiple suggestions
 * @param suggestions - Array of suggestions to review
 * @param callbacks - Notification callbacks
 */
async function handleOpenMultiSuggestionEditor(suggestions: SuggestionData[], callbacks: NotificationCallbacks): Promise<void> {
  try {
    console.log(`Opening multi-suggestion edit dialog for ${suggestions.length} suggestions`);
    
    // Import the multi-suggestion edit dialog
    const { createMultiSuggestionEditDialog } = await import('./edit-dialog-window');
    
    // Open the multi-suggestion edit dialog
    await createMultiSuggestionEditDialog(suggestions, {
      onConfirm: async (editedSuggestion, suggestionIndex) => {
        console.log(`User confirmed suggestion ${suggestionIndex + 1}: ${editedSuggestion.trigger}`);
        
        // Show instructions for manual copy/paste
        showManualCopyInstructions(editedSuggestion.trigger, editedSuggestion.replacement);
        
        // Update status in Supabase
        const originalSuggestion = suggestions[suggestionIndex];
        if (originalSuggestion.suggestionId) {
          await supabaseService.updateSuggestionStatus(originalSuggestion.suggestionId, 'accepted');
        }
        
        callbacks.onAccepted?.(editedSuggestion);
      },
      onReject: async (suggestionIndex) => {
        const rejectedSuggestion = suggestions[suggestionIndex];
        console.log(`User rejected suggestion ${suggestionIndex + 1}: ${rejectedSuggestion.trigger}`);
        
        // Update status in Supabase
        if (rejectedSuggestion.suggestionId) {
          await supabaseService.updateSuggestionStatus(rejectedSuggestion.suggestionId, 'rejected');
        }
        
        callbacks.onRejected?.(rejectedSuggestion);
      },
      onCancel: () => {
        console.log(`User cancelled review for ${suggestions.length} suggestions`);
        // Mark all as rejected
        suggestions.forEach(suggestion => callbacks.onRejected?.(suggestion));
      }
    });
    
    // Notify that multi-edit was opened
    suggestions.forEach(suggestion => callbacks.onEdit?.(suggestion));
    
  } catch (error) {
    console.error('Error opening multi-suggestion edit dialog:', error);
    showErrorNotification('Error opening multi-suggestion editor. Please try again.');
  }
}

/**
 * Handles the "Dismiss" action
 * @param suggestion - The suggestion data
 * @param callbacks - Notification callbacks
 */
async function handleDismiss(suggestion: SuggestionData, callbacks: NotificationCallbacks): Promise<void> {
  // Update status in Supabase if suggestionId is available
  if (suggestion.suggestionId) {
    await supabaseService.updateSuggestionStatus(suggestion.suggestionId, 'rejected');
  }
  
  callbacks.onRejected?.(suggestion);
}

/**
 * Shows instructions for manual copy/paste to system text replacements
 * @param trigger - The trigger that was created
 * @param replacement - The replacement text
 */
function showManualCopyInstructions(trigger: string, replacement: string): void {
  const notification = new Notification({
    title: 'DryPrompt - Ready to Copy',
    body: `Trigger: "${trigger}"\nReplacement: "${truncateText(replacement, 50)}"\n\nOpening Text Replacements settings...`,
    hasReply: false
  });

  notification.show();
  
  // Automatically open Text Replacements settings window
  setTimeout(async () => {
    try {
      const applescriptService = await import('./applescript-service');
      await applescriptService.openTextReplacementsOnly();
      console.log('Automatically opened Text Replacements settings for user');
    } catch (error) {
      console.error('Failed to auto-open Text Replacements settings:', error);
      
      // Show a follow-up notification if automatic opening fails
      const fallbackNotification = new Notification({
        title: 'DryPrompt - Manual Setup',
        body: 'Please open System Settings > Keyboard > Text Replacements manually',
        hasReply: false
      });
      fallbackNotification.show();
    }
  }, 1000); // Small delay to let the first notification be seen
  
  // Auto-close after 6 seconds (reduced since settings will be opening)
  setTimeout(() => {
    notification.close();
  }, 6000);
}

/**
 * Shows an error notification when something goes wrong
 * @param message - The error message to display
 */
function showErrorNotification(message: string): void {
  const notification = new Notification({
    title: 'DryPrompt - Error',
    body: message,
    hasReply: false
  });

  notification.show();
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
}

/**
 * Shows multiple suggestions in a unified notification that opens a multi-suggestion edit dialog
 * @param suggestions - Array of suggestions to show
 * @param callbacks - Optional callbacks for user actions
 */
export async function showMultipleSuggestions(
  suggestions: SuggestionData[],
  callbacks: NotificationCallbacks = {}
): Promise<void> {
  if (!suggestions || suggestions.length === 0) {
    console.log('No suggestions to show');
    return;
  }

  if (suggestions.length === 1) {
    // For single suggestions, use the regular notification
    await showSuggestionNotification(suggestions[0], callbacks);
    return;
  }

  console.log(`Showing unified notification for ${suggestions.length} suggestions`);

  // Create summary of all suggestions
  const suggestionSummary = suggestions
    .map(s => `"${s.trigger}"`)
    .join(', ');

  const notification = new Notification({
    title: 'DryPrompt - Multiple Shortcut Suggestions',
    body: `Found ${suggestions.length} new shortcuts:\n${truncateText(suggestionSummary, 80)}\n\nClick to review all suggestions`,
    hasReply: false,
    actions: [
      {
        type: 'button',
        text: 'Review All'
      }
    ],
    closeButtonText: 'Dismiss All'
  });

  // Handle user clicking action buttons or notification
  const handleOpenMultiEditor = async () => {
    console.log(`User wants to review ${suggestions.length} suggestions`);
    await handleOpenMultiSuggestionEditor(suggestions, callbacks);
  };

  notification.on('action', async (event, index) => {
    if (index === 0) { // Review All button
      await handleOpenMultiEditor();
    }
  });

  notification.on('click', async () => {
    console.log(`Notification clicked for ${suggestions.length} suggestions - opening multi-editor`);
    await handleOpenMultiEditor();
  });

  // Handle notification being closed without action (dismiss all)
  notification.on('close', async () => {
    console.log(`Notification dismissed for ${suggestions.length} suggestions`);
    // Mark all as rejected
    for (const suggestion of suggestions) {
      await handleDismiss(suggestion, callbacks);
    }
  });

  // Show the notification
  notification.show();
  console.log(`✅ Shown unified notification for ${suggestions.length} suggestions`);
}

/**
 * Shows a notification about the analysis results
 * @param count - Number of suggestions found
 */
export function showAnalysisCompleteNotification(count: number): void {
  let message: string;
  
  if (count === 0) {
    message = 'Analysis complete. No new shortcuts suggested at this time.';
  } else if (count === 1) {
    message = 'Analysis complete. Found 1 new shortcut suggestion!';
  } else {
    message = `Analysis complete. Found ${count} new shortcut suggestions!`;
  }

  const notification = new Notification({
    title: 'DryPrompt - Analysis Complete',
    body: message,
    hasReply: false
  });

  notification.show();
  
  // Auto-close after 4 seconds
  setTimeout(() => {
    notification.close();
  }, 4000);
}

/**
 * Shows a notification when monitoring starts
 * @param captureMode - The type of capture being used
 */
export function showMonitoringStartedNotification(captureMode?: 'uiohook' | 'fallback' | 'disabled'): void {
  let body = 'DryPrompt is now monitoring your Cursor usage to learn your typing patterns.';
  
  if (captureMode === 'fallback') {
    body = 'DryPrompt is monitoring Cursor activity. Using fallback mode for text capture.';
  } else if (captureMode === 'uiohook') {
    body = 'DryPrompt is monitoring your Cursor usage with full keyboard capture enabled.';
  }
  
  const notification = new Notification({
    title: 'DryPrompt - Monitoring Active',
    body,
    hasReply: false
  });

  notification.show();
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    notification.close();
  }, 3000);
}



/**
 * Truncates text to a specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
} 