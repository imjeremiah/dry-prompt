/**
 * @file Preload script that establishes secure communication bridge between main and renderer processes
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface that will be exposed to the renderer
interface ElectronAPI {
  saveApiKey: (apiKey: string) => Promise<{ success: boolean; message: string }>;
  getApiKey: () => Promise<string | null>;
  checkApiKey: () => Promise<boolean>;
  
  // Edit dialog validation methods
  validateTrigger: (trigger: string) => Promise<{
    isValid: boolean;
    message?: string;
    type?: 'error' | 'warning' | 'success';
  }>;
  validateReplacement: (replacement: string) => Promise<{
    isValid: boolean;
    message?: string;
    type?: 'error' | 'warning' | 'success';
  }>;
  
  // Edit dialog action methods
  confirmEdit: (editedData: { trigger: string; replacement: string }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  cancelEdit: () => Promise<{ success: boolean; error?: string }>;
  
  // Event listeners for edit dialog
  onLoadSuggestion: (callback: (suggestion: any) => void) => void;
  offLoadSuggestion: (callback: (suggestion: any) => void) => void;
  
  // Multi-suggestion dialog methods
  onLoadMultiSuggestions: (callback: (data: { suggestions: any[]; count: number }) => void) => void;
  confirmSuggestion: (data: { suggestionIndex: number; editedData: { trigger: string; replacement: string } }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  rejectSuggestion: (suggestionIndex: number) => Promise<{
    success: boolean;
    error?: string;
  }>;
  cancelMultiEdit: () => Promise<{ success: boolean; error?: string }>;
}

// Expose protected methods that allow the renderer process to
// securely communicate with the main process via IPC
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Saves the OpenAI API key securely to the macOS Keychain
   * @param apiKey - The OpenAI API key to save
   * @returns Promise resolving to success status and message
   */
  saveApiKey: (apiKey: string): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke('save-api-key', apiKey);
  },

  /**
   * Retrieves the stored OpenAI API key from the macOS Keychain
   * @returns Promise resolving to the API key or null if not found
   */
  getApiKey: (): Promise<string | null> => {
    return ipcRenderer.invoke('get-api-key');
  },

  /**
   * Checks if an API key is currently stored
   * @returns Promise resolving to boolean indicating if API key exists
   */
  checkApiKey: (): Promise<boolean> => {
    return ipcRenderer.invoke('check-api-key');
  },

  /**
   * Validates a trigger text in real-time
   * @param trigger - The trigger text to validate
   * @returns Promise resolving to validation result
   */
  validateTrigger: (trigger: string) => {
    return ipcRenderer.invoke('validate-trigger', trigger);
  },

  /**
   * Validates replacement text in real-time
   * @param replacement - The replacement text to validate
   * @returns Promise resolving to validation result
   */
  validateReplacement: (replacement: string) => {
    return ipcRenderer.invoke('validate-replacement', replacement);
  },

  /**
   * Confirms the edited suggestion and creates the shortcut
   * @param editedData - The edited trigger and replacement text
   * @returns Promise resolving to operation result
   */
  confirmEdit: (editedData: { trigger: string; replacement: string }) => {
    return ipcRenderer.invoke('confirm-edit', editedData);
  },

  /**
   * Cancels the edit dialog
   * @returns Promise resolving to operation result
   */
  cancelEdit: () => {
    return ipcRenderer.invoke('cancel-edit');
  },

  /**
   * Registers a callback for when suggestion data is loaded into the dialog
   * @param callback - Function to call when suggestion is loaded
   */
  onLoadSuggestion: (callback: (suggestion: any) => void) => {
    ipcRenderer.on('load-suggestion', (event, suggestion) => callback(suggestion));
  },

  /**
   * Removes a callback for suggestion loading
   * @param callback - Function to remove from listeners
   */
  offLoadSuggestion: (callback: (suggestion: any) => void) => {
    ipcRenderer.removeListener('load-suggestion', callback);
  },

  /**
   * Registers a callback for when multi-suggestion data is loaded into the dialog
   * @param callback - Function to call when multi-suggestions are loaded
   */
  onLoadMultiSuggestions: (callback: (data: { suggestions: any[]; count: number }) => void) => {
    ipcRenderer.on('load-multi-suggestions', (event, data) => callback(data));
  },

  /**
   * Confirms a specific suggestion from the multi-suggestion dialog
   * @param data - The suggestion index and edited data
   * @returns Promise resolving to operation result
   */
  confirmSuggestion: (data: { suggestionIndex: number; editedData: { trigger: string; replacement: string } }) => {
    return ipcRenderer.invoke('confirm-suggestion', data);
  },

  /**
   * Rejects a specific suggestion from the multi-suggestion dialog
   * @param suggestionIndex - Index of the suggestion to reject
   * @returns Promise resolving to operation result
   */
  rejectSuggestion: (suggestionIndex: number) => {
    return ipcRenderer.invoke('reject-suggestion', suggestionIndex);
  },

  /**
   * Cancels the multi-suggestion edit dialog
   * @returns Promise resolving to operation result
   */
  cancelMultiEdit: () => {
    return ipcRenderer.invoke('cancel-multi-edit');
  }
} as ElectronAPI);

// Type declaration for TypeScript support in renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
