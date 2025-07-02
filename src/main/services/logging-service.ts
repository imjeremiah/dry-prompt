/**
 * @file Manages secure local storage of captured keyboard input for analysis
 * @module logging-service
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Interface for log entries
interface LogEntry {
  timestamp: string;
  text: string;
  windowTitle?: string;
  processName?: string;
}

// Get the path to the user data directory
const getUserDataPath = (): string => {
  return app.getPath('userData');
};

// Get the path to the prompt log file
const getPromptLogPath = (): string => {
  return path.join(getUserDataPath(), 'prompt_log.json');
};

// Get the path to the archive directory
const getArchiveDir = (): string => {
  return path.join(getUserDataPath(), 'archive');
};

/**
 * Ensures the user data directory and archive directory exist
 */
const ensureDirectoriesExist = (): void => {
  const userDataPath = getUserDataPath();
  const archiveDir = getArchiveDir();
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
};

/**
 * Logs a text input entry to the prompt log file
 * @param text - The captured text to log
 * @param windowTitle - Optional window title for context
 * @param processName - Optional process name for context
 */
export async function logTextInput(
  text: string, 
  windowTitle?: string, 
  processName?: string
): Promise<void> {
  if (!text || text.trim().length === 0) {
    return; // Don't log empty text
  }

  ensureDirectoriesExist();
  
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    text: text.trim(),
    windowTitle,
    processName
  };

  try {
    const logPath = getPromptLogPath();
    
    // Read existing log entries or start with empty array
    let logEntries: LogEntry[] = [];
    
    if (fs.existsSync(logPath)) {
      const existingData = fs.readFileSync(logPath, 'utf8');
      
      if (existingData.trim()) {
        try {
          logEntries = JSON.parse(existingData);
        } catch (parseError) {
          console.error('Error parsing existing log file, starting fresh:', parseError);
          logEntries = [];
        }
      }
    }
    
    // Add new entry
    logEntries.push(logEntry);
    
    // Write updated log back to file
    fs.writeFileSync(logPath, JSON.stringify(logEntries, null, 2));
    
    console.log(`Logged text input: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
  } catch (error) {
    console.error('Failed to log text input:', error);
    throw new Error('Failed to save text input to log file');
  }
}

/**
 * Retrieves all logged text entries
 * @returns Promise resolving to array of log entries
 */
export async function getLogEntries(): Promise<LogEntry[]> {
  try {
    const logPath = getPromptLogPath();
    
    if (!fs.existsSync(logPath)) {
      return [];
    }
    
    const data = fs.readFileSync(logPath, 'utf8');
    
    if (!data.trim()) {
      return [];
    }
    
    return JSON.parse(data);
    
  } catch (error) {
    console.error('Failed to read log entries:', error);
    return [];
  }
}

/**
 * Archives the current prompt log file and creates a new empty one
 * This is called after successful AI analysis to prevent indefinite file growth
 * @returns Promise resolving to the path of the archived file
 */
export async function archivePromptLog(): Promise<string | null> {
  try {
    const logPath = getPromptLogPath();
    
    if (!fs.existsSync(logPath)) {
      console.log('No log file to archive');
      return null;
    }
    
    ensureDirectoriesExist();
    
    // Generate archive filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFilename = `prompt_log_${timestamp}.json`;
    const archivePath = path.join(getArchiveDir(), archiveFilename);
    
    // Move current log to archive
    fs.renameSync(logPath, archivePath);
    
    console.log(`Prompt log archived to: ${archivePath}`);
    
    return archivePath;
    
  } catch (error) {
    console.error('Failed to archive prompt log:', error);
    throw new Error('Failed to archive prompt log file');
  }
}

/**
 * Gets the count of entries in the current log file
 * @returns Promise resolving to the number of log entries
 */
export async function getLogEntryCount(): Promise<number> {
  try {
    const entries = await getLogEntries();
    return entries.length;
  } catch (error) {
    console.error('Failed to get log entry count:', error);
    return 0;
  }
}

/**
 * Clears all log entries (for testing or manual reset)
 * @returns Promise resolving when clearing is complete
 */
export async function clearLog(): Promise<void> {
  try {
    const logPath = getPromptLogPath();
    
    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
      console.log('Prompt log cleared');
    }
    
  } catch (error) {
    console.error('Failed to clear log:', error);
    throw new Error('Failed to clear prompt log file');
  }
} 