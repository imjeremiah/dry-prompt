/**
 * @file Notification service for displaying AI-generated suggestions to users with editing capabilities
 * @module notification-service
 */

import { Notification } from 'electron';
import * as supabaseService from './supabase-service';
import { createEditDialog } from './edit-dialog-window';
import { createThreeLineIcon } from '../utils/icon-generator';

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

// Cache for the notification icon
let notificationIcon: Electron.NativeImage | null = null;

/**
 * Gets the branded icon for notifications, creating it if needed
 * @returns The notification icon
 */
function getNotificationIcon(): Electron.NativeImage {
  if (!notificationIcon) {
    try {
      notificationIcon = createThreeLineIcon(64);
      console.log('Created notification icon successfully');
    } catch (error) {
      console.error('Failed to create notification icon:', error);
      // Create a fallback icon if the main creation fails
      notificationIcon = createThreeLineIcon(32);
    }
  }
  return notificationIcon;
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

  // Get the branded icon for the notification
  const icon = getNotificationIcon();

  const clusterInfo = suggestion.sourceTexts ? `Found ${suggestion.sourceTexts.length} similar prompts` : '';

  const notification = new Notification({
    title: 'DryPrompt - New Shortcut Suggestion',
    body: `${clusterInfo}\nSuggested: "${suggestion.trigger}" → "${truncateText(suggestion.replacement, 60)}"`,
    icon, // Use the branded DryPrompt icon
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
  getNotificationIcon();
  const notification = new Notification({
    title: 'DryPrompt - Ready to Copy',
    body: `Trigger: "${trigger}"\nReplacement: "${truncateText(replacement, 50)}"\n\nOpening Text Replacements settings...`,
    icon: notificationIcon, // Use the branded DryPrompt icon
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
        icon: notificationIcon,
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
  getNotificationIcon();
  const notification = new Notification({
    title: 'DryPrompt - Error',
    body: message,
    icon: notificationIcon, // Use the branded DryPrompt icon
    hasReply: false
  });

  notification.show();
  
  // Auto-close after 5 seconds
  setTimeout(() => {
    notification.close();
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

  getNotificationIcon();
  const notification = new Notification({
    title: 'DryPrompt - Analysis Complete',
    body: message,
    icon: notificationIcon, // Use the branded DryPrompt icon
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
  
  getNotificationIcon();
  const notification = new Notification({
    title: 'DryPrompt - Monitoring Active',
    body,
    icon: notificationIcon, // Use the branded DryPrompt icon
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