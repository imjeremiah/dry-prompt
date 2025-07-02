/**
 * @file Manages secure storage and retrieval of credentials from the macOS Keychain
 * @module keychain-service
 */

import * as keytar from 'keytar';

// Constants for keychain storage
const SERVICE_NAME = 'DryPrompt';
const API_KEY_ACCOUNT = 'openai-api-key';

/**
 * Saves the OpenAI API key securely to the macOS Keychain
 * @param apiKey - The API key to store
 * @returns Promise resolving to success status
 * @throws Error if the keychain operation fails
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }

  try {
    await keytar.setPassword(SERVICE_NAME, API_KEY_ACCOUNT, apiKey);
    console.log('API key saved to keychain successfully');
  } catch (error) {
    console.error('Failed to save API key to keychain:', error);
    throw new Error('Failed to save API key to keychain. Please check system permissions.');
  }
}

/**
 * Retrieves the OpenAI API key from the macOS Keychain
 * @returns Promise resolving to the API key or null if not found
 * @throws Error if the keychain operation fails
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const apiKey = await keytar.getPassword(SERVICE_NAME, API_KEY_ACCOUNT);
    
    if (apiKey) {
      console.log('API key retrieved from keychain successfully');
      return apiKey;
    } else {
      console.log('No API key found in keychain');
      return null;
    }
  } catch (error) {
    console.error('Failed to retrieve API key from keychain:', error);
    throw new Error('Failed to retrieve API key from keychain. Please check system permissions.');
  }
}

/**
 * Checks if an API key is currently stored in the keychain
 * @returns Promise resolving to boolean indicating if API key exists
 */
export async function hasApiKey(): Promise<boolean> {
  try {
    const apiKey = await keytar.getPassword(SERVICE_NAME, API_KEY_ACCOUNT);
    return apiKey !== null && apiKey.length > 0;
  } catch (error) {
    console.error('Failed to check for API key in keychain:', error);
    return false;
  }
}

/**
 * Removes the stored API key from the keychain
 * @returns Promise resolving to success status
 * @throws Error if the keychain operation fails
 */
export async function deleteApiKey(): Promise<void> {
  try {
    const result = await keytar.deletePassword(SERVICE_NAME, API_KEY_ACCOUNT);
    
    if (result) {
      console.log('API key deleted from keychain successfully');
    } else {
      console.log('No API key found to delete');
    }
  } catch (error) {
    console.error('Failed to delete API key from keychain:', error);
    throw new Error('Failed to delete API key from keychain. Please check system permissions.');
  }
} 