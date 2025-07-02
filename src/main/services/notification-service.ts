/**
 * @file Notification service for displaying AI-generated suggestions to users
 * @module notification-service
 */

import { Notification } from 'electron';
import * as applescriptService from './applescript-service';

// Interface for suggestion data
interface SuggestionData {
  trigger: string;
  replacement: string;
  sourceTexts: string[];
  confidence: number;
}

// Interface for notification callbacks
interface NotificationCallbacks {
  onAccepted?: (suggestion: SuggestionData) => void;
  onRejected?: (suggestion: SuggestionData) => void;
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
    body: `Create shortcut "${suggestion.trigger}" for:\n"${truncateText(suggestion.replacement, 80)}"`,
    hasReply: false,
    actions: [
      {
        type: 'button',
        text: 'Create Shortcut'
      },
      {
        type: 'button', 
        text: 'Dismiss'
      }
    ],
    closeButtonText: 'Dismiss'
  });

  // Handle user clicking "Create Shortcut"
  notification.on('action', async (event, index) => {
    if (index === 0) { // Create Shortcut button
      console.log(`User accepted suggestion: ${suggestion.trigger}`);
      
      try {
        const success = await applescriptService.createTextReplacement(
          suggestion.trigger, 
          suggestion.replacement
        );
        
        if (success) {
          showConfirmationNotification(suggestion.trigger);
          callbacks.onAccepted?.(suggestion);
        } else {
          showErrorNotification('Failed to create shortcut. Please try manually.');
        }
      } catch (error) {
        console.error('Error creating text replacement:', error);
        showErrorNotification('Error creating shortcut. Please check permissions.');
      }
    } else if (index === 1) { // Dismiss button
      console.log(`User dismissed suggestion: ${suggestion.trigger}`);
      callbacks.onRejected?.(suggestion);
    }
  });

  // Handle notification being closed without action
  notification.on('close', () => {
    console.log(`Notification closed for suggestion: ${suggestion.trigger}`);
    callbacks.onRejected?.(suggestion);
  });

  // Handle notification click (treat as dismiss)
  notification.on('click', () => {
    console.log(`Notification clicked for suggestion: ${suggestion.trigger}`);
    callbacks.onRejected?.(suggestion);
  });

  // Show the notification
  notification.show();
  console.log(`Shown suggestion notification: ${suggestion.trigger}`);
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
export function showMonitoringStartedNotification(captureMode?: 'iohook' | 'fallback' | 'disabled'): void {
  let body = 'DryPrompt is now monitoring your Cursor usage to learn your typing patterns.';
  
  if (captureMode === 'fallback') {
    body = 'DryPrompt is monitoring Cursor activity. Using fallback mode for text capture.';
  } else if (captureMode === 'iohook') {
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