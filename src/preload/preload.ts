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
  }
} as ElectronAPI);

// Type declaration for TypeScript support in renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
