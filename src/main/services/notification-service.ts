/**
 * @file Notification service for displaying AI-generated suggestions to users with editing capabilities
 * @module notification-service
 */

import { Notification } from 'electron';
import * as applescriptService from './applescript-service';
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
 * Shows a native macOS notification for a text replacement suggestion with three action options
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

  // Check if shortcut already exists before showing notification
  try {
    const exists = await applescriptService.checkShortcutExists(suggestion.trigger);
    if (exists) {
      console.log(`Shortcut ${suggestion.trigger} already exists, skipping notification`);
      return;
    }
  } catch (error) {
    console.warn('Could not check shortcut existence, showing notification anyway:', error);
  }

  const notification = new Notification({
    title: 'DryPrompt - New Shortcut Suggestion',
    body: `Suggested shortcut: "${suggestion.trigger}"\nFor: "${truncateText(suggestion.replacement, 60)}"`,
    hasReply: false,
    actions: [
      {
        type: 'button',
        text: 'Create As-Is'
      },
      {
        type: 'button',
        text: 'Edit First'
      }
    ],
    closeButtonText: 'Dismiss'
  });

  // Handle user clicking action buttons
  notification.on('action', async (event, index) => {
    if (index === 0) { // Create As-Is button
      console.log(`User accepted suggestion as-is: ${suggestion.trigger}`);
      await handleCreateAsIs(suggestion, callbacks);
    } else if (index === 1) { // Edit First button
      console.log(`User wants to edit suggestion: ${suggestion.trigger}`);
      await handleEditFirst(suggestion, callbacks);
    }
  });

  // Handle notification being closed without action (dismiss)
  notification.on('close', async () => {
    console.log(`Notification dismissed for suggestion: ${suggestion.trigger}`);
    await handleDismiss(suggestion, callbacks);
  });

  // Handle notification click (treat as dismiss)
  notification.on('click', async () => {
    console.log(`Notification clicked for suggestion: ${suggestion.trigger}`);
    await handleDismiss(suggestion, callbacks);
  });

  // Show the notification
  notification.show();
  console.log(`✅ Shown enhanced suggestion notification: ${suggestion.trigger}`);
}

/**
 * Handles the "Create As-Is" action
 * @param suggestion - The suggestion data
 * @param callbacks - Notification callbacks
 */
async function handleCreateAsIs(suggestion: SuggestionData, callbacks: NotificationCallbacks): Promise<void> {
  try {
    const success = await applescriptService.createTextReplacement(
      suggestion.trigger, 
      suggestion.replacement
    );
    
    if (success) {
      showConfirmationNotification(suggestion.trigger);
      
      // Update status in Supabase if suggestionId is available
      if (suggestion.suggestionId) {
        await supabaseService.updateSuggestionStatus(suggestion.suggestionId, 'accepted');
      }
      
      callbacks.onAccepted?.(suggestion);
    } else {
      showErrorNotification('Failed to create shortcut. Please try manually.');
    }
  } catch (error) {
    console.error('Error creating text replacement:', error);
    showErrorNotification('Error creating shortcut. Please check permissions.');
  }
}

/**
 * Handles the "Edit First" action by opening the edit dialog
 * @param suggestion - The suggestion data
 * @param callbacks - Notification callbacks
 */
async function handleEditFirst(suggestion: SuggestionData, callbacks: NotificationCallbacks): Promise<void> {
  try {
    console.log(`Opening edit dialog for suggestion: ${suggestion.trigger}`);
    
    // Open the edit dialog with the AI suggestion as starting point
    await createEditDialog(suggestion, {
      onConfirm: async (editedSuggestion) => {
        console.log(`User confirmed edited suggestion: ${editedSuggestion.trigger}`);
        
        // Create the shortcut with user's edited values
        const success = await applescriptService.createTextReplacement(
          editedSuggestion.trigger,
          editedSuggestion.replacement
        );
        
        if (success) {
          showConfirmationNotification(editedSuggestion.trigger);
          
          // Update status in Supabase with edited flag
          if (suggestion.suggestionId) {
            await supabaseService.updateSuggestionStatus(suggestion.suggestionId, 'accepted');
          }
          
          callbacks.onAccepted?.(editedSuggestion);
        } else {
          showErrorNotification('Failed to create edited shortcut. Please try manually.');
        }
      },
      onCancel: () => {
        console.log(`User cancelled edit dialog for: ${suggestion.trigger}`);
        // Treat cancel as a rejection
        callbacks.onRejected?.(suggestion);
      }
    });
    
    callbacks.onEdit?.(suggestion);
    
  } catch (error) {
    console.error('Error opening edit dialog:', error);
    showErrorNotification('Error opening edit dialog. Please try again.');
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
 * Shows a confirmation notification when a shortcut is successfully created
 * @param trigger - The trigger that was created
 */
function showConfirmationNotification(trigger: string): void {
  const confirmation = new Notification({
    title: 'DryPrompt - Shortcut Created',
    body: `Shortcut "${trigger}" is now active! You can use it in any text field.`,
    hasReply: false
  });

  confirmation.show();
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    confirmation.close();
  }, 3000);
}

/**
 * Shows an error notification when something goes wrong
 * @param message - The error message to display
 */
function showErrorNotification(message: string): void {
  const error = new Notification({
    title: 'DryPrompt - Error',
    body: message,
    hasReply: false
  });

  error.show();
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    error.close();
  }, 5000);
}

/**
 * Shows multiple suggestions in sequence with delays
 * @param suggestions - Array of suggestions to show
 * @param callbacks - Optional callbacks for user actions
 * @param delayMs - Delay between notifications in milliseconds
 */
export async function showMultipleSuggestions(
  suggestions: SuggestionData[],
  callbacks: NotificationCallbacks = {},
  delayMs: number = 2000
): Promise<void> {
  if (!suggestions || suggestions.length === 0) {
    console.log('No suggestions to show');
    return;
  }

  console.log(`Showing ${suggestions.length} suggestion notifications`);

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i];
    
    try {
      await showSuggestionNotification(suggestion, callbacks);
      
      // Add delay between notifications (except for the last one)
      if (i < suggestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Error showing suggestion ${i + 1}:`, error);
      // Continue with other suggestions
    }
  }
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