/**
 * @file Edit dialog window service for allowing users to customize AI-generated suggestions
 * @module edit-dialog-window
 */

import { BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import * as applescriptService from './applescript-service';
import { isValidTrigger, hasLikelyConflicts } from '../utils/trigger-generator';

// Declare Vite global variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Interface for suggestion data
interface SuggestionData {
  trigger: string;
  replacement: string;
  sourceTexts: string[];
  confidence: number;
  suggestionId?: string;
}

// Interface for edit dialog callbacks
interface EditDialogCallbacks {
  onConfirm: (editedSuggestion: SuggestionData) => void;
  onCancel: () => void;
}

// Interface for validation results
interface ValidationResult {
  isValid: boolean;
  message?: string;
  type?: 'error' | 'warning' | 'success';
}

let currentEditWindow: BrowserWindow | null = null;
let ipcHandlersRegistered = false;

/**
 * Creates and displays an edit dialog for customizing a suggestion
 * @param suggestion - The AI-generated suggestion to edit (optional - null for manual creation)
 * @param callbacks - Callbacks for user actions
 * @returns Promise resolving when dialog is created
 */
export async function createEditDialog(
  suggestion: SuggestionData | null, 
  callbacks: EditDialogCallbacks
): Promise<void> {
  // Force cleanup of any existing edit dialog and handlers
  if (currentEditWindow && !currentEditWindow.isDestroyed()) {
    console.log('Closing existing edit dialog window');
    currentEditWindow.close();
    currentEditWindow = null;
  }
  
  // Force cleanup of IPC handlers
  cleanupEditDialogIpcHandlers();
  
  // Wait a moment for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  const isManualCreation = suggestion === null;
  const windowTitle = isManualCreation ? 'Create Shortcut - DryPrompt' : 'Edit Shortcut - DryPrompt';

  currentEditWindow = new BrowserWindow({
    width: 520,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    title: windowTitle,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Set up IPC handlers for this dialog (clean up first to prevent conflicts)
  setupEditDialogIpcHandlers(suggestion, callbacks);

  // Load the edit dialog - use same URL pattern as config window with a hash
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log(`Loading edit dialog from dev server: ${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#edit-dialog`);
    await currentEditWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#edit-dialog`);
  } else {
    const htmlPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log(`Loading edit dialog from file: ${htmlPath} with hash #edit-dialog`);
    await currentEditWindow.loadFile(htmlPath, { hash: '#edit-dialog' });
  }

  // Add debugging for loading events
  currentEditWindow.webContents.on('did-start-loading', () => {
    console.log('Edit dialog started loading');
  });

  currentEditWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Edit dialog failed to load:', errorCode, errorDescription);
  });

  currentEditWindow.webContents.on('dom-ready', () => {
    console.log('Edit dialog DOM ready - populating form immediately');
    if (suggestion) {
      populateFormWithSuggestion(suggestion);
    }
  });

  // Send the initial suggestion data to the renderer
  currentEditWindow.webContents.once('did-finish-load', () => {
    console.log('Edit dialog finished loading - sending suggestion data');
    if (suggestion) {
      populateFormWithSuggestion(suggestion);
    }
  });

  // Backup method - populate after a delay regardless of events
  setTimeout(() => {
    if (suggestion) {
      console.log('Backup timer - force populating form after 1 second');
      populateFormWithSuggestion(suggestion);
    }
  }, 1000);

  // Clean up when window is closed
  currentEditWindow.on('closed', () => {
    cleanupEditDialogIpcHandlers();
    currentEditWindow = null;
  });

  // Prevent new window creation
  currentEditWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  console.log(`Edit dialog created for ${isManualCreation ? 'manual creation' : 'suggestion: ' + suggestion!.trigger}`);

  // Only enable DevTools in development mode when explicitly debugging
  // Removed automatic DevTools opening to prevent console from appearing
  // if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  //   console.log('Opening DevTools for edit dialog debugging');
  //   currentEditWindow.webContents.openDevTools();
  // }
}

/**
 * Sets up IPC handlers specific to the edit dialog
 * @param originalSuggestion - The original AI suggestion
 * @param callbacks - Dialog callbacks
 */
function setupEditDialogIpcHandlers(
  originalSuggestion: SuggestionData | null, 
  callbacks: EditDialogCallbacks
): void {
  // Clean up any existing handlers first to prevent registration conflicts
  if (ipcHandlersRegistered) {
    cleanupEditDialogIpcHandlers();
  }

  try {
    // Handle trigger validation
    ipcMain.handle('validate-trigger', async (event, trigger: string): Promise<ValidationResult> => {
      return await validateTrigger(trigger);
    });

    // Handle replacement text validation
    ipcMain.handle('validate-replacement', async (event, replacement: string): Promise<ValidationResult> => {
      return validateReplacementText(replacement);
    });

    // Handle dialog confirmation
    ipcMain.handle('confirm-edit', async (event, editedData: { trigger: string; replacement: string }) => {
      try {
        // Create the edited suggestion object
        const editedSuggestion: SuggestionData = {
          trigger: editedData.trigger.trim(),
          replacement: editedData.replacement.trim(),
          sourceTexts: originalSuggestion?.sourceTexts || [],
          confidence: originalSuggestion?.confidence || 1.0,
          suggestionId: originalSuggestion?.suggestionId
        };

        console.log(`User confirmed edit: ${editedSuggestion.trigger}`);
        callbacks.onConfirm(editedSuggestion);
        
        // Keep the dialog open so user can copy from it while Text Replacements window is open
        // User can close it manually when done
        console.log('Edit dialog kept open for copying - user can close manually when done');

        return { success: true };
      } catch (error) {
        console.error('Error confirming edit:', error);
        return { success: false, error: 'Failed to process edit' };
      }
    });

    // Handle dialog cancellation
    ipcMain.handle('cancel-edit', async () => {
      try {
        console.log(`User cancelled edit for: ${originalSuggestion?.trigger}`);
        callbacks.onCancel();
        
        // Close the dialog
        if (currentEditWindow && !currentEditWindow.isDestroyed()) {
          currentEditWindow.close();
        }

        return { success: true };
      } catch (error) {
        console.error('Error cancelling edit:', error);
        return { success: false, error: 'Failed to cancel edit' };
      }
    });

    ipcHandlersRegistered = true;
    console.log('Edit dialog IPC handlers registered successfully');
    
  } catch (error) {
    console.error('Error setting up edit dialog IPC handlers:', error);
    throw error;
  }
}

/**
 * Cleans up IPC handlers when dialog is closed
 */
function cleanupEditDialogIpcHandlers(): void {
  if (ipcHandlersRegistered) {
    try {
      // Use removeHandler instead of removeAllListeners for specific handlers
      ipcMain.removeHandler('validate-trigger');
      ipcMain.removeHandler('validate-replacement');
      ipcMain.removeHandler('confirm-edit');
      ipcMain.removeHandler('cancel-edit');
      ipcHandlersRegistered = false;
      console.log('Edit dialog IPC handlers cleaned up');
    } catch (error) {
      console.error('Error cleaning up IPC handlers:', error);
      // Force reset the flag even if cleanup fails
      ipcHandlersRegistered = false;
    }
  }
}

/**
 * Validates a trigger text
 * @param trigger - The trigger text to validate
 * @returns Validation result with feedback
 */
async function validateTrigger(trigger: string): Promise<ValidationResult> {
  if (!trigger) {
    return {
      isValid: false,
      message: 'Trigger cannot be empty',
      type: 'error'
    };
  }

  if (!trigger.startsWith('-') && !trigger.startsWith(';') && !trigger.startsWith('_')) {
    return {
      isValid: false,
      message: 'Trigger must start with a dash (-), semicolon (;), or underscore (_)',
      type: 'error'
    };
  }

  if (trigger.length < 3) {
    return {
      isValid: false,
      message: 'Trigger must be at least 3 characters long',
      type: 'error'
    };
  }

  if (trigger.length > 20) {
    return {
      isValid: false,
      message: 'Trigger cannot be longer than 20 characters',
      type: 'error'
    };
  }

  if (!isValidTrigger(trigger)) {
    return {
      isValid: false,
      message: 'Trigger can only contain letters and valid prefix characters',
      type: 'error'
    };
  }

  if (hasLikelyConflicts(trigger)) {
    return {
      isValid: true,
      message: 'This trigger might conflict with common shortcuts',
      type: 'warning'
    };
  }

  return {
    isValid: true,
    message: 'Trigger looks good!',
    type: 'success'
  };
}

/**
 * Validates replacement text
 * @param replacement - The replacement text to validate
 * @returns Validation result with feedback
 */
function validateReplacementText(replacement: string): ValidationResult {
  if (!replacement) {
    return {
      isValid: false,
      message: 'Replacement text cannot be empty',
      type: 'error'
    };
  }

  if (replacement.length < 5) {
    return {
      isValid: false,
      message: 'Replacement text should be at least 5 characters long',
      type: 'error'
    };
  }

  if (replacement.length > 500) {
    return {
      isValid: false,
      message: 'Replacement text cannot be longer than 500 characters',
      type: 'error'
    };
  }

  const charCount = replacement.length;
  if (charCount > 200) {
    return {
      isValid: true,
      message: `${charCount} characters (quite long, consider shortening)`,
      type: 'warning'
    };
  }

  return {
    isValid: true,
    message: `${charCount} characters`,
    type: 'success'
  };
}

/**
 * Populates the edit dialog form with suggestion data using multiple methods
 * @param suggestion - The suggestion data to populate
 */
function populateFormWithSuggestion(suggestion: SuggestionData): void {
  if (!currentEditWindow || currentEditWindow.isDestroyed()) {
    console.error('Cannot populate form - edit window not available');
    return;
  }

  console.log('Populating form with suggestion:', {
    trigger: suggestion.trigger,
    replacement: suggestion.replacement,
    confidence: suggestion.confidence
  });

  // Method 1: Send IPC message (for proper renderer script)
  try {
    currentEditWindow.webContents.send('load-suggestion', suggestion);
    console.log('Sent load-suggestion IPC message');
  } catch (error) {
    console.error('Error sending load-suggestion IPC:', error);
  }

  // Method 2: Direct JavaScript execution (backup method)
  const escapedReplacement = suggestion.replacement.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  
  const populationScript = `
    console.log('Direct JavaScript execution - populating form');
    console.log('Target trigger: ${suggestion.trigger}');
    console.log('Target replacement: ${suggestion.replacement}');
    
    // Wait for DOM to be ready
    function populateForm() {
      const triggerInput = document.getElementById('trigger-input');
      const replacementInput = document.getElementById('replacement-input');
      const characterCount = document.getElementById('character-count');
      const previewDemo = document.getElementById('preview-demo');
      
      console.log('Form elements found:', {
        triggerInput: !!triggerInput,
        replacementInput: !!replacementInput,
        characterCount: !!characterCount,
        previewDemo: !!previewDemo
      });
      
      if (triggerInput) {
        triggerInput.value = '${suggestion.trigger}';
        triggerInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Set trigger input to: ${suggestion.trigger}');
      } else {
        console.error('Trigger input element not found');
      }
      
      if (replacementInput) {
        replacementInput.value = '${escapedReplacement}';
        replacementInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('Set replacement input, length:', replacementInput.value.length);
      } else {
        console.error('Replacement input element not found');
      }
      
      if (characterCount) {
        characterCount.textContent = '${suggestion.replacement.length} characters';
        console.log('Updated character count');
      }
      
             if (previewDemo) {
         previewDemo.innerHTML = 'Type <strong>${suggestion.trigger}</strong> <span class="preview-arrow">→</span> Get "${suggestion.replacement}"';
         console.log('Updated preview');
       }
      
      // Enable create button if both fields have content
      const createBtn = document.getElementById('create-btn');
      if (createBtn && triggerInput && replacementInput && triggerInput.value && replacementInput.value) {
        createBtn.disabled = false;
        console.log('Enabled create button');
      }
      
      console.log('Form population completed via direct JavaScript');
    }
    
    // Try immediately
    populateForm();
    
    // Try again after 100ms in case DOM isn't ready
    setTimeout(populateForm, 100);
    
    // Try again after 500ms as final backup
    setTimeout(populateForm, 500);
  `;

  currentEditWindow.webContents.executeJavaScript(populationScript).catch(error => {
    console.error('Error executing form population script:', error);
  });
}

/**
 * Gets the current edit window instance (for advanced usage)
 * @returns Current edit window or null
 */
export function getCurrentEditWindow(): BrowserWindow | null {
  return currentEditWindow;
}

/**
 * Closes the current edit dialog if open
 */
export function closeCurrentEditDialog(): void {
  if (currentEditWindow && !currentEditWindow.isDestroyed()) {
    currentEditWindow.close();
  }
}

/**
 * Global cleanup function to call on app startup to ensure no stale IPC handlers
 */
export function globalCleanupEditDialogHandlers(): void {
  try {
    ipcMain.removeHandler('validate-trigger');
    ipcMain.removeHandler('validate-replacement'); 
    ipcMain.removeHandler('confirm-edit');
    ipcMain.removeHandler('cancel-edit');
    ipcHandlersRegistered = false;
    console.log('Global cleanup of edit dialog IPC handlers completed');
  } catch (error) {
    // Ignore errors during startup cleanup
    console.log('Global cleanup completed (some handlers may not have existed)');
  }
} 