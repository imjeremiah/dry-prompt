/**
 * @file AppleScript service for managing macOS keyboard shortcuts and text replacements
 * @module applescript-service
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Checks if a text replacement shortcut already exists in macOS settings
 * @param trigger - The trigger text to check (e.g., ";explain")
 * @returns Promise resolving to boolean indicating if shortcut exists
 */
export async function checkShortcutExists(trigger: string): Promise<boolean> {
  if (!trigger || typeof trigger !== 'string') {
    throw new Error('Trigger must be a non-empty string');
  }

  const script = `
    tell application "System Preferences"
      reveal pane "Keyboard"
    end tell
    
    tell application "System Events"
      tell process "System Preferences"
        try
          click button "Text" of tab group 1 of window 1
          delay 0.5
          
          -- Get the text replacement table
          set replacementTable to table 1 of scroll area 1 of tab group 1 of window 1
          
          -- Check each row for the trigger
          repeat with currentRow in rows of replacementTable
            try
              set cellValue to value of text field 1 of currentRow
              if cellValue is equal to "${trigger.replace(/"/g, '\\"')}" then
                return true
              end if
            on error
              -- Skip rows that don't have the expected structure
            end try
          end repeat
          
          return false
        on error
          return false
        end try
      end tell
    end tell
  `;

  try {
    console.log(`Checking if shortcut exists: ${trigger}`);
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const result = stdout.trim().toLowerCase() === 'true';
    console.log(`Shortcut ${trigger} exists: ${result}`);
    return result;
  } catch (error) {
    console.error('Error checking shortcut existence:', error);
    // Return false on error to avoid blocking suggestions
    return false;
  }
}

/**
 * Creates a new text replacement shortcut in macOS System Preferences
 * @param trigger - The trigger text (e.g., ";explain")
 * @param replacement - The replacement text
 * @returns Promise resolving to success status
 */
export async function createTextReplacement(trigger: string, replacement: string): Promise<boolean> {
  if (!trigger || !replacement || typeof trigger !== 'string' || typeof replacement !== 'string') {
    throw new Error('Both trigger and replacement must be non-empty strings');
  }

  // Escape quotes in the text
  const escapedTrigger = trigger.replace(/"/g, '\\"');
  const escapedReplacement = replacement.replace(/"/g, '\\"');

  const script = `
    tell application "System Preferences"
      reveal pane "Keyboard"
    end tell
    
    tell application "System Events"
      tell process "System Preferences"
        try
          click button "Text" of tab group 1 of window 1
          delay 0.5
          
          -- Click the + button to add a new replacement
          click button "+" of tab group 1 of window 1
          delay 0.5
          
          -- Get the text replacement table
          set replacementTable to table 1 of scroll area 1 of tab group 1 of window 1
          
          -- Select the new row (should be the last one)
          set lastRow to last row of replacementTable
          select lastRow
          
          -- Enter the trigger text in the "Replace" field
          set value of text field 1 of lastRow to "${escapedTrigger}"
          
          -- Tab to the "With" field and enter replacement text
          key code 48 -- Tab key
          delay 0.2
          set value of text field 2 of lastRow to "${escapedReplacement}"
          
          -- Press Enter to confirm
          key code 36 -- Enter key
          delay 0.2
          
          return true
        on error errorMessage
          return false
        end try
      end tell
    end tell
  `;

  try {
    console.log(`Creating text replacement: ${trigger} → ${replacement}`);
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const success = stdout.trim().toLowerCase() === 'true';
    
    if (success) {
      console.log(`Successfully created text replacement: ${trigger}`);
    } else {
      console.log(`Failed to create text replacement: ${trigger}`);
    }
    
    return success;
  } catch (error) {
    console.error('Error creating text replacement:', error);
    return false;
  }
}

/**
 * Opens macOS System Preferences to the Keyboard > Text section
 * @returns Promise resolving when the preferences pane is open
 */
export async function openKeyboardPreferences(): Promise<void> {
  const script = `
    tell application "System Preferences"
      activate
      reveal pane "Keyboard"
    end tell
    
    tell application "System Events"
      tell process "System Preferences"
        try
          click button "Text" of tab group 1 of window 1
        on error
          -- Text button might not be available immediately
        end try
      end tell
    end tell
  `;

  try {
    console.log('Opening Keyboard preferences...');
    await execAsync(`osascript -e '${script}'`);
    console.log('Keyboard preferences opened');
  } catch (error) {
    console.error('Error opening Keyboard preferences:', error);
    throw new Error('Failed to open Keyboard preferences');
  }
}

/**
 * Checks if System Preferences is currently running
 * @returns Promise resolving to boolean indicating if System Preferences is running
 */
export async function isSystemPreferencesRunning(): Promise<boolean> {
  const script = `
    tell application "System Events"
      return (exists process "System Preferences")
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim().toLowerCase() === 'true';
  } catch (error) {
    console.error('Error checking System Preferences status:', error);
    return false;
  }
}

/**
 * Closes System Preferences if it's running
 * @returns Promise resolving when System Preferences is closed
 */
export async function closeSystemPreferences(): Promise<void> {
  const script = `
    tell application "System Preferences"
      quit
    end tell
  `;

  try {
    await execAsync(`osascript -e '${script}'`);
    console.log('System Preferences closed');
  } catch (error) {
    console.error('Error closing System Preferences:', error);
    // Don't throw error as this is not critical
  }
} 