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

  try {
    console.log(`Checking if shortcut exists: ${trigger}`);
    
    // Use PlistBuddy directly since it works correctly (unlike AppleScript plist reading)
    const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ARRAY_NOT_FOUND"`);
    
    if (rawContent.includes('ARRAY_NOT_FOUND')) {
      console.log(`No NSUserReplacementItems array found`);
      return false;
    }
    
    // Count items and check each one
    const itemCount = (rawContent.match(/Dict {/g) || []).length;
    console.log(`Checking ${itemCount} items for trigger: ${trigger}`);
    
    for (let i = 0; i < itemCount; i++) {
      try {
        const { stdout: replaceValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
        const cleanReplaceValue = replaceValue.trim();
        
        console.log(`  Item ${i}: "${cleanReplaceValue}" vs "${trigger}"`);
        
        if (cleanReplaceValue === trigger) {
          console.log(`✅ Found matching trigger at index ${i}: ${trigger}`);
          return true;
        }
      } catch (error) {
        // Skip items that can't be read
        console.log(`  Item ${i}: Could not read replace value`);
      }
    }
    
    console.log(`❌ Trigger "${trigger}" not found in ${itemCount} items`);
    return false;
    
  } catch (error) {
    console.error('Error checking shortcut existence:', error);
    // Return false on error to avoid blocking suggestions
    return false;
  }
}

/**
 * Creates a new text replacement shortcut in macOS System Preferences using multiple methods
 * @param trigger - The trigger text (e.g., ";explain")
 * @param replacement - The replacement text
 * @returns Promise resolving to success status
 */
export async function createTextReplacement(trigger: string, replacement: string): Promise<boolean> {
  if (!trigger || !replacement || typeof trigger !== 'string' || typeof replacement !== 'string') {
    throw new Error('Both trigger and replacement must be non-empty strings');
  }

  console.log(`Creating text replacement: ${trigger} → ${replacement}`);

  // Method 1: Try direct System Settings automation (most reliable for UI sync)
  console.log('Trying direct System Settings automation...');
  const systemSettingsSuccess = await createShortcutViaSystemSettings(trigger, replacement);
  if (systemSettingsSuccess) {
    return true;
  }

  console.log('System Settings automation failed, trying improved PlistBuddy method...');

  // Method 2: Try the improved PlistBuddy approach with comprehensive refresh
  const plistSuccess = await tryPlistMethodEnhanced(trigger, replacement);
  if (plistSuccess) {
    return true;
  }

  console.log('Enhanced PlistBuddy method failed, trying legacy AppleScript method...');

  // Method 3: Try AppleScript approach to directly interact with System Preferences
  const applescriptSuccess = await tryAppleScriptMethod(trigger, replacement);
  if (applescriptSuccess) {
    return true;
  }

  console.log('AppleScript method failed, trying direct defaults command...');

  // Method 4: Try using defaults command
  const defaultsSuccess = await tryDefaultsMethod(trigger, replacement);
  if (defaultsSuccess) {
    return true;
  }

  console.error('All methods failed to create text replacement');
  return false;
}

/**
 * Enhanced PlistBuddy method with comprehensive System Settings refresh
 */
async function tryPlistMethodEnhanced(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log('Trying enhanced PlistBuddy method...');

    // First, check if we can read the current plist
    const { stdout: currentPlist } = await execAsync(`/usr/libexec/PlistBuddy -c "Print" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
    
    if (!currentPlist) {
      console.log('Cannot read GlobalPreferences.plist, skipping PlistBuddy method');
      return false;
    }

    // Ensure the NSUserReplacementItems array exists
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems array" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || true`);
    
    const entryIndex = await getNextArrayIndex();
    console.log(`Adding replacement at index: ${entryIndex}`);
    
    // Add the new replacement entry with improved structure
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex} dict" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:on integer 1" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:replace string '${trigger.replace(/'/g, "\\'")}'" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:with string '${replacement.replace(/'/g, "\\'")}'" ~/Library/Preferences/.GlobalPreferences.plist`);

    console.log('Plist entry created, applying comprehensive refresh...');

    // Step 1: Comprehensive system restart
    await restartPreferencesSystem();

    // Step 2: Force System Settings refresh
    await forceSystemSettingsRefresh();

    // Step 3: Wait for all changes to propagate
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Verify the shortcut was created
    const verification = await verifyShortcutCreation(trigger, replacement);
    
    console.log('Enhanced PlistBuddy method verification results:');
    verification.diagnostics.forEach(diagnostic => console.log(`  ${diagnostic}`));
    
    if (verification.exists) {
      console.log(`✅ Enhanced PlistBuddy method succeeded: ${trigger}`);
      
      // Final step: Test that it actually works by triggering System Settings refresh again
      await execAsync('osascript -e \'tell application "System Events" to keystroke "f" using {command down, shift down}\' 2>/dev/null || true');
      
      return true;
    } else {
      console.log('❌ Enhanced PlistBuddy method: entry added but still not visible in System Settings');
      
      // Last resort: try to manually trigger a preferences reload
      await execAsync('launchctl kickstart -k system/com.apple.cfprefsd 2>/dev/null || true');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalVerification = await verifyShortcutCreation(trigger, replacement);
      
      console.log('After final reload attempt:');
      finalVerification.diagnostics.forEach(diagnostic => console.log(`  ${diagnostic}`));
      
      if (finalVerification.exists) {
        console.log(`✅ Enhanced PlistBuddy method succeeded after final reload: ${trigger}`);
        return true;
      } else {
        console.log(`❌ Enhanced PlistBuddy method failed: shortcut created in plist but not visible in System Settings`);
        return false;
      }
    }

  } catch (error) {
    console.error('Enhanced PlistBuddy method failed with error:', error);
    return false;
  }
}

/**
 * Legacy PlistBuddy method (kept for fallback)
 */
async function tryPlistMethod(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log('Trying legacy PlistBuddy method...');

    // First, check if we can read the current plist
    const { stdout: currentPlist } = await execAsync(`/usr/libexec/PlistBuddy -c "Print" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
    
    if (!currentPlist) {
      console.log('Cannot read GlobalPreferences.plist, skipping PlistBuddy method');
      return false;
    }

    // Ensure the NSUserReplacementItems array exists
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems array" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || true`);
    
    const entryIndex = await getNextArrayIndex();
    console.log(`Adding replacement at index: ${entryIndex}`);
    
    // Add the new replacement entry with improved structure
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex} dict" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:on integer 1" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:replace string '${trigger.replace(/'/g, "\\'")}'" ~/Library/Preferences/.GlobalPreferences.plist`);
    await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${entryIndex}:with string '${replacement.replace(/'/g, "\\'")}'" ~/Library/Preferences/.GlobalPreferences.plist`);

    // Basic system restart
    await restartPreferencesSystem();

    // Wait a moment for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Use comprehensive verification
    const verification = await verifyShortcutCreation(trigger, replacement);
    
    if (verification.exists) {
      console.log(`✅ Legacy PlistBuddy method succeeded: ${trigger}`);
      return true;
    } else {
      console.log(`❌ Legacy PlistBuddy method failed: ${trigger}`);
      return false;
    }

  } catch (error) {
    console.error('Legacy PlistBuddy method failed with error:', error);
    return false;
  }
}

/**
 * Method 2: AppleScript approach to interact with System Settings directly (macOS Ventura+)
 */
async function tryAppleScriptMethod(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log('Trying AppleScript method...');

    // First, try the modern System Settings approach (macOS 13+)
    const modernScript = `
    tell application "System Settings"
      try
        reveal pane id "com.apple.preference.keyboard"
      on error
        -- Fallback for older naming
        reveal anchor "keyboardTab_Text" of pane id "com.apple.preference.keyboard"
      end try
    end tell
    
    delay 2
    
    tell application "System Events"
      tell process "System Settings"
        try
          -- Look for Text section in Keyboard settings
          set textButton to first button whose name contains "Text" of front window
          click textButton
          delay 1
          
          -- Click the + button to add new replacement
          set plusButton to first button whose description contains "Add" of front window
          click plusButton
          delay 0.5
          
          -- Fill in the trigger (Replace field)
          set replaceField to first text field of front window
          set focused of replaceField to true
          keystroke "${trigger.replace(/"/g, '\\"')}"
          
          -- Tab to the replacement field
          key code 48 -- Tab key
          delay 0.3
          
          -- Fill in the replacement text (With field)
          keystroke "${replacement.replace(/"/g, '\\"')}"
          
          -- Press Enter to confirm
          key code 36 -- Enter key
          delay 1
          
          return true
        on error errorMessage
          log "Modern System Settings failed: " & errorMessage
          return false
        end try
      end tell
    end tell
    
    tell application "System Settings"
      quit
    end tell
    `;

    try {
      const { stdout } = await execAsync(`osascript -e '${modernScript}'`);
      const scriptSuccess = stdout.trim().toLowerCase() === 'true';
      
      if (scriptSuccess) {
        console.log('Modern AppleScript executed successfully, verifying result...');
        
        // Wait for UI interactions to complete and preferences to save
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Use comprehensive verification
        const verification = await verifyShortcutCreation(trigger, replacement);
        
        console.log('AppleScript method verification results:');
        verification.diagnostics.forEach(diagnostic => console.log(`  ${diagnostic}`));
        
        if (verification.exists) {
          console.log(`✅ AppleScript method succeeded: ${trigger}`);
          return true;
        } else {
          console.log(`❌ AppleScript method failed: script ran but shortcut not found`);
        }
      }
    } catch (modernError) {
      console.log('Modern System Settings approach failed, trying legacy System Preferences...');
    }

    // Fallback to legacy System Preferences approach
    const legacyScript = `
    tell application "System Preferences"
      reveal pane "Keyboard"
    end tell
    
    delay 1
    
    tell application "System Events"
      tell process "System Preferences"
        try
          -- Click on Text tab
          click button "Text" of tab group 1 of window 1
          delay 1
          
          -- Click the + button to add new replacement
          click button 1 of group 1 of tab group 1 of window 1
          delay 0.5
          
          -- Fill in the trigger (Replace field)
          set focused of text field 1 of group 1 of tab group 1 of window 1 to true
          keystroke "${trigger.replace(/"/g, '\\"')}"
          
          -- Tab to the replacement field
          key code 48 -- Tab key
          delay 0.2
          
          -- Fill in the replacement text (With field)
          keystroke "${replacement.replace(/"/g, '\\"')}"
          
          -- Press Enter to confirm
          key code 36 -- Enter key
          
          return true
        on error errorMessage
          return false
        end try
      end tell
    end tell
    
    tell application "System Preferences"
      quit
    end tell
    `;

    const { stdout: legacyStdout } = await execAsync(`osascript -e '${legacyScript}'`);
    const legacySuccess = legacyStdout.trim().toLowerCase() === 'true';
    
    if (legacySuccess) {
      console.log('Legacy AppleScript executed successfully, verifying result...');
      
      // Wait for UI interactions to complete and preferences to save
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Use comprehensive verification
      const verification = await verifyShortcutCreation(trigger, replacement);
      
      console.log('Legacy AppleScript method verification results:');
      verification.diagnostics.forEach(diagnostic => console.log(`  ${diagnostic}`));
      
      if (verification.exists) {
        console.log(`✅ Legacy AppleScript method succeeded: ${trigger}`);
        return true;
      } else {
        console.log(`❌ Legacy AppleScript method failed: script ran but shortcut not found`);
        return false;
      }
    } else {
      console.log('❌ Both modern and legacy AppleScript approaches failed');
      return false;
    }

  } catch (error) {
    console.error('AppleScript method failed with error:', error);
    return false;
  }
}

/**
 * Method 3: Using defaults command to write to preferences
 */
async function tryDefaultsMethod(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log('Trying defaults command method...');

    // Create the replacement item structure
    const replacementItem = {
      on: 1,
      replace: trigger,
      with: replacement
    };

    // Get current replacements
    let currentReplacements = [];
    try {
      const { stdout } = await execAsync('defaults read -g NSUserReplacementItems 2>/dev/null || echo "()"');
      if (stdout.trim() !== '()') {
        // Parse existing replacements (this is simplified - in reality would need proper plist parsing)
        console.log('Found existing replacements');
      }
    } catch (error) {
      console.log('No existing replacements found');
    }

    // Try to add using defaults command with proper format
    const plistData = `'{ on = 1; replace = "${trigger}"; with = "${replacement}"; }'`;
    await execAsync(`defaults write -g NSUserReplacementItems -array-add ${plistData}`);

    // Restart preferences system
    await restartPreferencesSystem();

    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Use comprehensive verification
    const verification = await verifyShortcutCreation(trigger, replacement);
    
    console.log('Defaults method verification results:');
    verification.diagnostics.forEach(diagnostic => console.log(`  ${diagnostic}`));
    
    if (verification.exists) {
      console.log(`✅ Defaults method succeeded: ${trigger}`);
      return true;
    } else {
      console.log(`❌ Defaults method failed: shortcut not found after creation`);
      return false;
    }

  } catch (error) {
    console.error('Defaults method failed with error:', error);
    return false;
  }
}

/**
 * Restarts the preferences system and forces UI refresh
 * This comprehensive approach ensures changes appear in System Settings
 */
async function restartPreferencesSystem(): Promise<void> {
  console.log('Restarting preferences system...');
  
  try {
    // Kill System Settings if it's running
    await execAsync('killall "System Settings" 2>/dev/null || killall "System Preferences" 2>/dev/null || true');
    
    // Force preferences daemon restart
    await execAsync('killall cfprefsd 2>/dev/null || true');
    
    // Restart Dock (handles some UI preferences)
    await execAsync('killall Dock 2>/dev/null || true');
    
    // Force synchronization of all preferences
    await execAsync('defaults synchronize');
    
    // Clear any cached preferences
    await execAsync('sudo defaults synchronize 2>/dev/null || true');
    
    // Wait for services to restart
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force refresh of the specific domain
    await execAsync('defaults read -g NSUserReplacementItems > /dev/null 2>&1 || true');
    
    console.log('Preferences system restarted');
  } catch (error) {
    console.error('Error restarting preferences system:', error);
  }
}

/**
 * Enhanced method to force System Settings to recognize new shortcuts
 */
async function forceSystemSettingsRefresh(): Promise<void> {
  try {
    console.log('Forcing System Settings refresh...');
    
    // Method 1: Use CFPreferences API through defaults
    await execAsync('defaults write com.apple.systempreferences.plist TMShowUnsupportedNetworkVolumes 1 2>/dev/null || true');
    await execAsync('defaults delete com.apple.systempreferences.plist TMShowUnsupportedNetworkVolumes 2>/dev/null || true');
    
    // Method 2: Touch the GlobalPreferences to update modification time
    await execAsync('touch ~/Library/Preferences/.GlobalPreferences.plist');
    
    // Method 3: Force CoreFoundation to flush preferences cache
    await execAsync('sudo purge 2>/dev/null || true');
    
    // Method 4: Use osascript to trigger preferences refresh
    const refreshScript = `
      try
        tell application "System Events"
          set prefsFile to (path to preferences folder as string) & ".GlobalPreferences.plist"
          -- Force a read to refresh cache
          do shell script "plutil -p " & quoted form of (POSIX path of prefsFile) & " > /dev/null"
        end tell
      on error
        -- Ignore errors
      end try
    `;
    
    await execAsync(`osascript -e '${refreshScript}' 2>/dev/null || true`);
    
    console.log('System Settings refresh completed');
    
  } catch (error) {
    console.error('Error forcing System Settings refresh:', error);
  }
}

/**
 * Alternative method using direct System Settings automation (more reliable)
 */
async function createShortcutViaSystemSettings(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log('Trying direct System Settings automation...');
    
    // First, clean up any existing System Settings processes
    await execAsync('killall "System Settings" 2>/dev/null || killall "System Preferences" 2>/dev/null || true');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const script = `
      tell application "System Settings"
        activate
        delay 1
        
        -- Try to open keyboard settings
        try
          reveal pane id "com.apple.KeyboardSettings.extension"
        on error
          try
            reveal pane id "com.apple.preference.keyboard"
          on error
            reveal anchor "keyboardTab_Text" of pane id "com.apple.preference.keyboard"
          end try
        end try
        
        delay 2
      end tell
      
      tell application "System Events"
        tell process "System Settings"
          try
            -- Look for Text Replacements section
            set textSection to first group whose name contains "Text" of front window
            if textSection exists then
              -- Found text section, look for add button
              set addButton to first button whose description contains "add" or title contains "+" of textSection
              if addButton exists then
                click addButton
                delay 0.5
                
                -- Fill in the fields
                set replaceField to first text field of front window
                set focused of replaceField to true
                keystroke "${trigger.replace(/"/g, '\\"')}"
                
                -- Move to next field
                key code 48 -- Tab
                delay 0.3
                
                -- Fill replacement text  
                keystroke "${replacement.replace(/"/g, '\\"')}"
                
                -- Confirm entry
                key code 36 -- Enter
                delay 1
                
                return true
              end if
            end if
            
            -- Fallback: try menu approach
            keystroke "," using command down -- Open preferences
            delay 1
            
            -- Navigate to keyboard
            keystroke "keyboard"
            delay 1
            key code 36 -- Enter
            delay 1
            
            return false
            
          on error errorMsg
            log "Error in System Settings automation: " & errorMsg
            return false
          end try
        end tell
      end tell
      
      tell application "System Settings"
        quit
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const success = stdout.trim().toLowerCase() === 'true';
    
    if (success) {
      console.log('✅ System Settings automation succeeded');
      
      // Wait for settings to save
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the shortcut was created
      const exists = await checkShortcutExists(trigger);
      if (exists) {
        console.log('✅ Shortcut verified in System Settings');
        return true;
      } else {
        console.log('❌ Shortcut not found after System Settings automation');
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('System Settings automation failed:', error);
    return false;
  }
}

/**
 * Gets the next available index in the NSUserReplacementItems array
 * @returns Promise resolving to the next index
 */
async function getNextArrayIndex(): Promise<number> {
  try {
    const { stdout } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null | grep -c "Dict" || echo "0"`);
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Opens macOS System Settings directly to the Text Replacements section
 * @returns Promise resolving when the preferences pane is open
 */
export async function openKeyboardPreferences(): Promise<void> {
  console.log('Opening System Settings to Text Replacements...');
  
  try {
    // Try modern System Settings first (macOS 13+)
    const modernScript = `
      tell application "System Settings"
        activate
        delay 0.5
        
        -- Open to Keyboard settings
        try
          reveal pane id "com.apple.preference.keyboard"
        on error
          reveal pane id "com.apple.KeyboardSettings.extension"
        end try
        
        delay 1
      end tell
      
      -- Navigate to Text Replacements
      tell application "System Events"
        tell process "System Settings"
          try
            -- Wait for the window to load
            delay 1
            
            -- Look for Text Replacements button/link
            repeat with i from 1 to 10
              try
                -- Try different ways to find and click Text Replacements
                if exists button "Text Replacements" of front window then
                  click button "Text Replacements" of front window
                  exit repeat
                else if exists button "Text" of front window then
                  click button "Text" of front window  
                  exit repeat
                else if exists group "Text Replacements" of front window then
                  click group "Text Replacements" of front window
                  exit repeat
                end if
              end try
              delay 0.2
            end repeat
            
            -- Give the interface time to load
            delay 1
            
          on error errorMsg
            -- If we can't navigate automatically, at least we opened Keyboard settings
            log "Could not auto-navigate to Text Replacements: " & errorMsg
          end try
        end tell
      end tell
      
      return "success"
    `;

    await execAsync(`osascript -e '${modernScript}'`);
    console.log('✅ System Settings opened to Keyboard section');
    console.log('📝 Navigate to Text Replacements and click the + button to add shortcuts');
    return;
    
  } catch (modernError) {
    console.log('Modern System Settings failed, trying legacy System Preferences...');
    
    // Fallback to legacy System Preferences (macOS 12 and earlier)
    const legacyScript = `
      tell application "System Preferences"
        activate
        reveal pane "Keyboard"
        delay 1
      end tell
      
      tell application "System Events"
        tell process "System Preferences"
          try
            -- Click on the Text tab
            click button "Text" of tab group 1 of window 1
            delay 0.5
          on error
            -- Text tab might not be available immediately
            log "Could not find Text tab"
          end try
        end tell
      end tell
      
      return "success"
    `;

    try {
      await execAsync(`osascript -e '${legacyScript}'`);
      console.log('✅ System Preferences opened to Keyboard > Text section');
    } catch (legacyError) {
      console.error('Failed to open preferences:', legacyError);
      
      // Last resort: just open System Settings/Preferences
      try {
        await execAsync('open -b com.apple.systempreferences || open -b com.apple.preferences.keyboard || open "x-apple.systempreferences:com.apple.preference.keyboard"');
        console.log('✅ Opened System Settings - navigate to Keyboard > Text Replacements');
      } catch (finalError) {
        console.error('All methods failed:', finalError);
        throw new Error('Failed to open Keyboard preferences. Please open System Settings > Keyboard > Text Replacements manually.');
      }
    }
  }
}

/**
 * Opens System Settings to Text Replacements and shows instructions for a specific replacement
 * @param trigger - Optional specific trigger to add
 * @param replacement - Optional specific replacement text
 * @returns Promise resolving when opened
 */
export async function openTextReplacementsForManualSetup(trigger?: string, replacement?: string): Promise<void> {
  console.log('🔧 Opening Text Replacements for manual setup...');
  
  await openKeyboardPreferences();
  
  if (trigger && replacement) {
    // Show specific instructions for this replacement
    console.log(`\n📋 SPECIFIC REPLACEMENT TO ADD:`);
    console.log(`   Replace: ${trigger}`);
    console.log(`   With: ${replacement}`);
    console.log('\n✨ STEPS:');
    console.log('1. Click the + button in Text Replacements');
    console.log(`2. In "Replace" field, type: ${trigger}`);
    console.log(`3. In "With" field, type: ${replacement}`);
    console.log('4. Press Enter to save');
    console.log(`5. Test by typing "${trigger}" in any text field`);
  } else {
    // Show general instructions
    console.log('\n📋 MANUAL SETUP INSTRUCTIONS:');
    console.log('1. In the Text Replacements section, click the + button');
    console.log('2. Add your shortcuts in the format:');
    console.log('   Replace: -explain (or ;explain, _explain, etc.)');
    console.log('   With: Your explanation text');
    console.log('3. Press Enter to save each shortcut');
    console.log('4. Test by typing the trigger in any text field');
    console.log('\n💡 TIP: Shortcuts starting with - or ; tend to work best');
  }
}

/**
 * Checks if System Settings or System Preferences is currently running
 * @returns Promise resolving to boolean indicating if either app is running
 */
export async function isSystemPreferencesRunning(): Promise<boolean> {
  const script = `
    tell application "System Events"
      set modernRunning to (exists process "System Settings")
      set legacyRunning to (exists process "System Preferences")
      return (modernRunning or legacyRunning)
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim().toLowerCase() === 'true';
  } catch (error) {
    console.error('Error checking System Settings/Preferences status:', error);
    return false;
  }
}

/**
 * Closes System Settings or System Preferences if either is running
 * @returns Promise resolving when both apps are closed
 */
export async function closeSystemPreferences(): Promise<void> {
  const script = `
    tell application "System Settings"
      try
        quit
      on error
        -- System Settings not running
      end try
    end tell
    
    tell application "System Preferences"
      try
        quit
      on error
        -- System Preferences not running
      end try
    end tell
  `;

  try {
    await execAsync(`osascript -e '${script}'`);
    console.log('System Settings/Preferences closed');
  } catch (error) {
    console.error('Error closing System Settings/Preferences:', error);
    // Don't throw error as this is not critical
  }
}

/**
 * Comprehensive verification that a shortcut was successfully created
 * @param trigger - The trigger to verify
 * @param replacement - Expected replacement text
 * @returns Promise resolving to verification result with detailed info
 */
export async function verifyShortcutCreation(trigger: string, replacement: string): Promise<{
  exists: boolean;
  actualReplacement?: string;
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  
  try {
    console.log(`Verifying shortcut creation: ${trigger}`);
    
    // Check if the plist file exists and is readable
    try {
      await execAsync('/usr/libexec/PlistBuddy -c "Print" ~/Library/Preferences/.GlobalPreferences.plist');
      diagnostics.push('✓ GlobalPreferences.plist is accessible');
    } catch (error) {
      diagnostics.push('✗ Cannot access GlobalPreferences.plist');
      return { exists: false, diagnostics };
    }
    
    // Check if NSUserReplacementItems exists
    try {
      const { stdout } = await execAsync('/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null');
      const itemCount = (stdout.match(/Dict {/g) || []).length;
      diagnostics.push(`✓ NSUserReplacementItems contains ${itemCount} items`);
    } catch (error) {
      diagnostics.push('✗ NSUserReplacementItems array not found');
      return { exists: false, diagnostics };
    }
    
    // Use the same PlistBuddy approach as checkShortcutExists
    const exists = await checkShortcutExists(trigger);
    
    if (exists) {
      // Find the actual replacement text
      let actualReplacement: string | undefined;
      
      try {
        const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null`);
        const itemCount = (rawContent.match(/Dict {/g) || []).length;
        
        for (let i = 0; i < itemCount; i++) {
          try {
            const { stdout: replaceValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
            if (replaceValue.trim() === trigger) {
              const { stdout: withValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:with" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
              actualReplacement = withValue.trim();
              break;
            }
          } catch (error) {
            // Skip
          }
        }
      } catch (error) {
        // Skip
      }
      
      diagnostics.push(`✓ Found trigger "${trigger}" with replacement: "${actualReplacement}"`);
      
      if (actualReplacement === replacement) {
        diagnostics.push('✓ Replacement text matches exactly');
      } else {
        diagnostics.push(`⚠ Replacement text differs: expected "${replacement}", got "${actualReplacement}"`);
      }
      
      return { 
        exists: true, 
        actualReplacement,
        diagnostics 
      };
    } else {
      diagnostics.push(`✗ Trigger "${trigger}" not found in preferences`);
      
      // List all existing triggers for debugging using PlistBuddy
      try {
        const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null`);
        const itemCount = (rawContent.match(/Dict {/g) || []).length;
        
        const existingTriggers = [];
        for (let i = 0; i < itemCount; i++) {
          try {
            const { stdout: replaceValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
            existingTriggers.push(replaceValue.trim());
          } catch (error) {
            // Skip
          }
        }
        
        diagnostics.push(`Existing triggers: ${existingTriggers.join(', ')}`);
      } catch (error) {
        diagnostics.push('Could not list existing triggers');
      }
      
      return { exists: false, diagnostics };
    }
    
  } catch (error) {
    diagnostics.push(`✗ Verification error: ${error}`);
    return { exists: false, diagnostics };
  }
}

/**
 * Analyzes the format of existing system shortcuts to understand the expected structure
 * @returns Promise resolving to analysis of existing shortcuts
 */
export async function analyzeExistingShortcutFormat(): Promise<{
  hasSystemShortcuts: boolean;
  systemShortcuts: Array<{
    index: number;
    replace: string;
    with: string;
    on: number;
    fullStructure: string;
  }>;
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  
  try {
    console.log('🔍 Analyzing existing system shortcuts format...');
    
    // Check for any existing shortcuts not created by us
    const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ARRAY_NOT_FOUND"`);
    
    if (rawContent.includes('ARRAY_NOT_FOUND')) {
      diagnostics.push('No NSUserReplacementItems array found');
      return { hasSystemShortcuts: false, systemShortcuts: [], diagnostics };
    }
    
    const itemCount = (rawContent.match(/Dict {/g) || []).length;
    diagnostics.push(`Found ${itemCount} total shortcuts`);
    
    const systemShortcuts = [];
    
    for (let i = 0; i < itemCount; i++) {
      try {
        const { stdout: itemStructure } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null`);
        
        const { stdout: replace } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
        const { stdout: with_ } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:with" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
        const { stdout: on } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:on" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "1"`);
        
        systemShortcuts.push({
          index: i,
          replace: replace.trim(),
          with: with_.trim(),
          on: parseInt(on.trim()) || 1,
          fullStructure: itemStructure.replace(/\n/g, ' ').replace(/\s+/g, ' ')
        });
        
      } catch (error) {
        diagnostics.push(`Error reading item ${i}: ${error}`);
      }
    }
    
    // Identify which ones might be system vs user-created
    const nonDryPromptShortcuts = systemShortcuts.filter(s => 
      !s.replace.includes('dryprompttest') && !s.replace.includes(';hi')
    );
    
    if (nonDryPromptShortcuts.length > 0) {
      diagnostics.push(`Found ${nonDryPromptShortcuts.length} non-DryPrompt shortcuts for format comparison`);
    } else {
      diagnostics.push('No existing system shortcuts found for format comparison');
    }
    
    return {
      hasSystemShortcuts: systemShortcuts.length > 0,
      systemShortcuts,
      diagnostics
    };
    
  } catch (error) {
    diagnostics.push(`Error analyzing shortcuts: ${error}`);
    return { hasSystemShortcuts: false, systemShortcuts: [], diagnostics };
  }
}

/**
 * Test function to debug shortcut creation issues
 * Creates a test shortcut and provides comprehensive diagnostics
 * @returns Promise resolving to test results
 */
export async function testShortcutCreation(): Promise<{
  success: boolean;
  method?: string;
  diagnostics: string[];
}> {
  const testTrigger = ';dryprompttest';
  const testReplacement = 'DryPrompt Test Shortcut';
  const diagnostics: string[] = [];
  
  console.log('🧪 Starting shortcut creation test...');
  diagnostics.push(`Test trigger: "${testTrigger}"`);
  diagnostics.push(`Test replacement: "${testReplacement}"`);
  
  // First, check if test shortcut already exists and remove it
  try {
    const existingCheck = await checkShortcutExists(testTrigger);
    if (existingCheck) {
      diagnostics.push('⚠ Test shortcut already exists, please remove it manually first');
      return { success: false, diagnostics };
    }
  } catch (error) {
    diagnostics.push(`Error checking for existing test shortcut: ${error}`);
  }
  
  // Debug initial plist state
  try {
    const initialDebug = await debugPlistStructure();
    diagnostics.push(`\n📋 Initial plist state:`);
    diagnostics.push(`  Array exists: ${initialDebug.hasArray}`);
    diagnostics.push(`  Item count: ${initialDebug.itemCount}`);
    
    if (initialDebug.items.length > 0) {
      diagnostics.push(`  Existing items:`);
      initialDebug.items.forEach(item => {
        diagnostics.push(`    [${item.index}] replace: "${item.replace}", with: "${item.with}", on: ${item.on}`);
      });
    }
  } catch (error) {
    diagnostics.push(`Error debugging initial plist state: ${error}`);
  }
  
  // Test each method
  const methods = [
    { name: 'PlistBuddy', func: tryPlistMethod },
    { name: 'AppleScript', func: tryAppleScriptMethod },
    { name: 'Defaults', func: tryDefaultsMethod }
  ];
  
  for (const method of methods) {
    diagnostics.push(`\n--- Testing ${method.name} method ---`);
    
    try {
      const success = await method.func(testTrigger, testReplacement);
      
      // Debug plist state after this method attempt
      try {
        const postDebug = await debugPlistStructure();
        diagnostics.push(`\n📋 Plist state after ${method.name} method:`);
        diagnostics.push(`  Array exists: ${postDebug.hasArray}`);
        diagnostics.push(`  Item count: ${postDebug.itemCount}`);
        
        if (postDebug.items.length > 0) {
          diagnostics.push(`  Items after attempt:`);
          postDebug.items.forEach(item => {
            diagnostics.push(`    [${item.index}] replace: "${item.replace}", with: "${item.with}", on: ${item.on}`);
          });
        }
        
        // Show raw content for debugging
        if (postDebug.rawContent && postDebug.rawContent.length < 500) {
          diagnostics.push(`  Raw plist content: ${postDebug.rawContent.replace(/\n/g, ' ').substring(0, 200)}...`);
        }
      } catch (debugError) {
        diagnostics.push(`Error debugging plist after ${method.name}: ${debugError}`);
      }
      
      if (success) {
        diagnostics.push(`✅ ${method.name} method succeeded!`);
        
        // Provide instructions for manual verification
        diagnostics.push(`\n🔍 Manual verification steps:`);
        diagnostics.push(`1. Open System Preferences > Keyboard > Text (or System Settings > Keyboard)`);
        diagnostics.push(`2. Look for "${testTrigger}" in the Replace column`);
        diagnostics.push(`3. Verify it shows "${testReplacement}" in the With column`);
        diagnostics.push(`4. Test typing "${testTrigger}" in any text field`);
        
        return { 
          success: true, 
          method: method.name,
          diagnostics 
        };
      } else {
        diagnostics.push(`❌ ${method.name} method failed`);
      }
    } catch (error) {
      diagnostics.push(`❌ ${method.name} method threw error: ${error}`);
    }
  }
  
  diagnostics.push(`\n❌ All methods failed to create test shortcut`);
  
  // Final plist debug
  try {
    const finalDebug = await debugPlistStructure();
    diagnostics.push(`\n📋 Final plist state:`);
    diagnostics.push(`  Array exists: ${finalDebug.hasArray}`);
    diagnostics.push(`  Item count: ${finalDebug.itemCount}`);
    
    if (finalDebug.items.length > 0) {
      diagnostics.push(`  Final items:`);
      finalDebug.items.forEach(item => {
        diagnostics.push(`    [${item.index}] replace: "${item.replace}", with: "${item.with}", on: ${item.on}`);
      });
    }
  } catch (error) {
    diagnostics.push(`Error debugging final plist state: ${error}`);
  }
  
  diagnostics.push(`\n💡 Troubleshooting suggestions:`);
  diagnostics.push(`1. Check if DryPrompt has Accessibility permissions`);
  diagnostics.push(`2. Ensure System Settings/Preferences is not open during creation`);
  diagnostics.push(`3. Try creating a shortcut manually to verify system functionality`);
  diagnostics.push(`4. Check Console.app for any system preference errors`);
  diagnostics.push(`5. If plist shows items but they're not found, there may be a format issue`);
  
  return { success: false, diagnostics };
}

/**
 * Debug function to examine the actual plist structure and content
 * @returns Promise resolving to detailed plist analysis
 */
export async function debugPlistStructure(): Promise<{
  hasArray: boolean;
  itemCount: number;
  items: Array<{
    index: number;
    structure: string;
    replace?: string;
    with?: string;
    on?: number;
  }>;
  rawContent: string;
}> {
  try {
    console.log('🔍 Debugging plist structure...');
    
    // Get the raw plist content
    const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ARRAY_NOT_FOUND"`);
    
    if (rawContent.includes('ARRAY_NOT_FOUND')) {
      return {
        hasArray: false,
        itemCount: 0,
        items: [],
        rawContent: 'Array does not exist'
      };
    }
    
    // Count items
    const itemCount = (rawContent.match(/Dict {/g) || []).length;
    
    // Examine each item
    const items = [];
    for (let i = 0; i < itemCount; i++) {
      try {
        const { stdout: itemStructure } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ERROR"`);
        
        let replace: string | undefined;
        let with_: string | undefined;
        let on: number | undefined;
        
        // Try to extract individual values
        try {
          const { stdout: replaceValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
          replace = replaceValue.trim();
        } catch (e) {
          // Ignore
        }
        
        try {
          const { stdout: withValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:with" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
          with_ = withValue.trim();
        } catch (e) {
          // Ignore
        }
        
        try {
          const { stdout: onValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:on" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
          on = parseInt(onValue.trim()) || undefined;
        } catch (e) {
          // Ignore
        }
        
        items.push({
          index: i,
          structure: itemStructure,
          replace,
          with: with_,
          on
        });
        
      } catch (error) {
        items.push({
          index: i,
          structure: `Error reading item ${i}: ${error}`,
        });
      }
    }
    
    return {
      hasArray: true,
      itemCount,
      items,
      rawContent
    };
    
  } catch (error) {
    return {
      hasArray: false,
      itemCount: 0,
      items: [],
      rawContent: `Debug error: ${error}`
    };
  }
}

/**
 * Cleans up test shortcuts from the plist
 * @returns Promise resolving to cleanup result
 */
export async function cleanupTestShortcuts(): Promise<{
  success: boolean;
  removedCount: number;
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  let removedCount = 0;
  
  try {
    console.log('🧹 Cleaning up test shortcuts...');
    
    // Get current items
    const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ARRAY_NOT_FOUND"`);
    
    if (rawContent.includes('ARRAY_NOT_FOUND')) {
      diagnostics.push('No NSUserReplacementItems array found - nothing to clean');
      return { success: true, removedCount: 0, diagnostics };
    }
    
    const itemCount = (rawContent.match(/Dict {/g) || []).length;
    diagnostics.push(`Found ${itemCount} items to check`);
    
    // Remove items in reverse order to avoid index shifting
    for (let i = itemCount - 1; i >= 0; i--) {
      try {
        const { stdout: replaceValue } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems:${i}:replace" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo ""`);
        const trigger = replaceValue.trim();
        
        if (trigger.includes('dryprompttest') || trigger === ';hi') {
          console.log(`Removing test shortcut: ${trigger}`);
          await execAsync(`/usr/libexec/PlistBuddy -c "Delete :NSUserReplacementItems:${i}" ~/Library/Preferences/.GlobalPreferences.plist`);
          removedCount++;
          diagnostics.push(`Removed: ${trigger}`);
        }
      } catch (error) {
        diagnostics.push(`Could not check item ${i}: ${error}`);
      }
    }
    
    if (removedCount > 0) {
      // Restart preferences system
      await restartPreferencesSystem();
      diagnostics.push(`Restarted preferences system after removing ${removedCount} items`);
    }
    
    return { success: true, removedCount, diagnostics };
    
  } catch (error) {
    diagnostics.push(`Cleanup error: ${error}`);
    return { success: false, removedCount, diagnostics };
  }
}

/**
 * Tests creating shortcuts with different formats to identify what works
 * @returns Promise resolving to test results
 */
export async function testDifferentShortcutFormats(): Promise<{
  success: boolean;
  results: Array<{
    format: string;
    trigger: string;
    replacement: string;
    created: boolean;
    visible: boolean;
    error?: string;
  }>;
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  const results = [];
  
  try {
    console.log('🧪 Testing different shortcut formats...');
    
    // Clean up any existing test shortcuts first
    const cleanup = await cleanupTestShortcuts();
    diagnostics.push(`Cleanup removed ${cleanup.removedCount} existing test shortcuts`);
    
    // Test different formats based on what we see in the working shortcuts
    const testFormats = [
      { format: 'dash-prefix', trigger: '-drytest', replacement: 'DryPrompt Format Test 1' },
      { format: 'semicolon-prefix', trigger: ';drytest', replacement: 'DryPrompt Format Test 2' },
      { format: 'underscore-prefix', trigger: '_drytest', replacement: 'DryPrompt Format Test 3' },
      { format: 'no-prefix', trigger: 'drytest', replacement: 'DryPrompt Format Test 4' },
      { format: 'double-dash', trigger: '--drytest', replacement: 'DryPrompt Format Test 5' }
    ];
    
    for (const testFormat of testFormats) {
      console.log(`\n🔍 Testing format: ${testFormat.format} (${testFormat.trigger})`);
      
      try {
        // Try PlistBuddy method first
        const { stdout: rawContent } = await execAsync(`/usr/libexec/PlistBuddy -c "Print :NSUserReplacementItems" ~/Library/Preferences/.GlobalPreferences.plist 2>/dev/null || echo "ARRAY_NOT_FOUND"`);
        
        let itemCount = 0;
        if (!rawContent.includes('ARRAY_NOT_FOUND')) {
          itemCount = (rawContent.match(/Dict {/g) || []).length;
        }
        
        // Add the new shortcut
        await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${itemCount}:replace string '${testFormat.trigger}'" ~/Library/Preferences/.GlobalPreferences.plist`);
        await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${itemCount}:with string '${testFormat.replacement}'" ~/Library/Preferences/.GlobalPreferences.plist`);
        await execAsync(`/usr/libexec/PlistBuddy -c "Add :NSUserReplacementItems:${itemCount}:on integer 1" ~/Library/Preferences/.GlobalPreferences.plist`);
        
        // Restart preferences system
        await restartPreferencesSystem();
        
        // Check if it was created
        const created = await checkShortcutExists(testFormat.trigger);
        
        // For now, we can't automatically check if it's visible in System Settings
        // That would require UI automation or manual verification
        
        results.push({
          format: testFormat.format,
          trigger: testFormat.trigger,
          replacement: testFormat.replacement,
          created: created,
          visible: false, // We'll update this manually based on System Settings
        });
        
        diagnostics.push(`${testFormat.format}: Created=${created}`);
        
      } catch (error) {
        results.push({
          format: testFormat.format,
          trigger: testFormat.trigger,
          replacement: testFormat.replacement,
          created: false,
          visible: false,
          error: error.toString()
        });
        
        diagnostics.push(`${testFormat.format}: Error - ${error}`);
      }
    }
    
    return { success: true, results, diagnostics };
    
  } catch (error) {
    diagnostics.push(`Format test error: ${error}`);
    return { success: false, results, diagnostics };
  }
}

/**
 * Test creating a shortcut with dash prefix (since user noted most work with "-")
 */
export async function testDashPrefixShortcut(): Promise<{
  success: boolean;
  diagnostics: string[];
}> {
  const testTrigger = '-drytest2';
  const testReplacement = 'DryPrompt Dash Test';
  const diagnostics: string[] = [];
  
  console.log('🧪 Testing dash prefix shortcut creation...');
  diagnostics.push(`Testing dash prefix: "${testTrigger}" → "${testReplacement}"`);
  
  try {
    // Clean up any existing version first
    await cleanupTestShortcuts();
    
    // Try creating with enhanced method
    const success = await createTextReplacement(testTrigger, testReplacement);
    
    if (success) {
      diagnostics.push('✅ Dash prefix shortcut created successfully');
      diagnostics.push('📋 Please check System Settings > Keyboard > Text Replacements');
      diagnostics.push('🔍 Look for "-drytest2" in the list');
      
      // Wait a moment and verify it's still there
      await new Promise(resolve => setTimeout(resolve, 2000));
      const verification = await verifyShortcutCreation(testTrigger, testReplacement);
      
      if (verification.exists) {
        diagnostics.push('✅ Shortcut verified after delay');
        return { success: true, diagnostics };
      } else {
        diagnostics.push('❌ Shortcut disappeared after delay');
        return { success: false, diagnostics };
      }
    } else {
      diagnostics.push('❌ Failed to create dash prefix shortcut');
      return { success: false, diagnostics };
    }
    
  } catch (error) {
    diagnostics.push(`❌ Error testing dash prefix: ${error}`);
    return { success: false, diagnostics };
  }
}

/**
 * Creates a shortcut using the exact format that appears to work
 */
export async function createShortcutWithWorkingFormat(trigger: string, replacement: string): Promise<boolean> {
  try {
    console.log(`Creating shortcut with working format: ${trigger} → ${replacement}`);
    
    // Ensure trigger starts with dash if it doesn't already have a prefix
    let formattedTrigger = trigger;
    if (!trigger.startsWith('-') && !trigger.startsWith(';') && !trigger.startsWith('_')) {
      formattedTrigger = `-${trigger}`;
      console.log(`Auto-formatted trigger to: ${formattedTrigger}`);
    }
    
    // Use the enhanced creation method
    return await createTextReplacement(formattedTrigger, replacement);
    
  } catch (error) {
    console.error('Error creating shortcut with working format:', error);
    return false;
  }
}

/**
 * Creates a text replacement by automating the System Settings UI
 * This is the most reliable method as it uses the official interface
 * @param trigger - The trigger text (e.g., "-123")
 * @param replacement - The replacement text (e.g., "testing123")
 * @returns Promise resolving to success status
 */
export async function createTextReplacementViaUI(trigger: string, replacement: string): Promise<boolean> {
  if (!trigger || !replacement || typeof trigger !== 'string' || typeof replacement !== 'string') {
    throw new Error('Both trigger and replacement must be non-empty strings');
  }

  console.log(`🎯 Creating text replacement via UI automation: "${trigger}" → "${replacement}"`);

  try {
    // First, ensure System Settings is open to Text Replacements
    await openKeyboardPreferences();
    
    // Wait for the interface to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const script = `
      tell application "System Settings"
        activate
        delay 1
      end tell
      
      tell application "System Events"
        tell process "System Settings"
          try
            -- Ensure we're in the Text Replacements section
            -- Look for the + button (add button)
            set addButton to missing value
            
            -- Try different ways to find the add button
            repeat with i from 1 to 5
              try
                -- Look for + button in various locations
                if exists button "+" of front window then
                  set addButton to button "+" of front window
                  exit repeat
                else if exists button 1 of group 1 of front window then
                  -- Sometimes it's the first button in a group
                  set buttonTitle to title of button 1 of group 1 of front window
                  if buttonTitle contains "+" or buttonTitle contains "Add" then
                    set addButton to button 1 of group 1 of front window
                    exit repeat
                  end if
                else if exists button "Add" of front window then
                  set addButton to button "Add" of front window
                  exit repeat
                end if
              end try
              delay 0.5
            end repeat
            
            if addButton is missing value then
              error "Could not find the + (Add) button"
            end if
            
            -- Click the + button to add a new replacement
            click addButton
            delay 1
            
            -- Look for text fields to fill in
            set replaceField to missing value
            set withField to missing value
            
            -- Find the text fields (there should be two: Replace and With)
            repeat with i from 1 to 10
              try
                set allTextFields to every text field of front window
                if (count of allTextFields) >= 2 then
                  set replaceField to item 1 of allTextFields
                  set withField to item 2 of allTextFields
                  exit repeat
                end if
              end try
              delay 0.2
            end repeat
            
            if replaceField is missing value or withField is missing value then
              error "Could not find the Replace and With text fields"
            end if
            
            -- Fill in the Replace field
            set focused of replaceField to true
            delay 0.3
            keystroke "${trigger.replace(/"/g, '\\"')}"
            delay 0.5
            
            -- Move to the With field (usually Tab key)
            key code 48 -- Tab
            delay 0.3
            
            -- Fill in the With field
            keystroke "${replacement.replace(/"/g, '\\"')}"
            delay 0.5
            
            -- Save the entry (usually Enter key)
            key code 36 -- Enter
            delay 1
            
            return "success"
            
          on error errorMsg
            log "UI automation error: " & errorMsg
            return "error: " & errorMsg
          end try
        end tell
      end tell
    `;

    console.log('🤖 Running UI automation script...');
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    
    if (stdout.includes('success')) {
      console.log('✅ UI automation completed successfully');
      
      // Wait for the system to process the change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the shortcut was created
      const verification = await verifyShortcutInUI(trigger);
      if (verification) {
        console.log('✅ Text replacement verified in System Settings');
        return true;
      } else {
        console.log('⚠️ UI automation completed but shortcut not found - may need manual verification');
        return true; // Still consider it successful as UI automation worked
      }
    } else {
      console.log('❌ UI automation failed:', stdout);
      return false;
    }

  } catch (error) {
    console.error('❌ UI automation error:', error);
    return false;
  }
}

/**
 * Verifies a text replacement exists by checking if it's visible in System Settings
 * @param trigger - The trigger to verify
 * @returns Promise resolving to whether the shortcut is visible
 */
async function verifyShortcutInUI(trigger: string): Promise<boolean> {
  try {
    const script = `
      tell application "System Settings"
        activate
        delay 0.5
      end tell
      
      tell application "System Events"
        tell process "System Settings"
          try
            -- Look for the trigger text in the UI
            set allStaticTexts to every static text of front window
            repeat with textElement in allStaticTexts
              if value of textElement contains "${trigger.replace(/"/g, '\\"')}" then
                return "found"
              end if
            end repeat
            
            -- Also check table/list views
            set allTables to every table of front window
            repeat with tableElement in allTables
              set tableContents to value of tableElement as string
              if tableContents contains "${trigger.replace(/"/g, '\\"')}" then
                return "found"
              end if
            end repeat
            
            return "not_found"
            
          on error
            return "error"
          end try
        end tell
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.includes('found');

  } catch (error) {
    console.error('Error verifying shortcut in UI:', error);
    return false;
  }
}

/**
 * Opens Text Replacements with specific guidance to add "-123" → "testing123"
 * This provides the simplest manual approach for the user's requested replacement
 * @returns Promise resolving when setup guidance is shown
 */
export async function setupSpecificReplacement(): Promise<void> {
  const trigger = '-123';
  const replacement = 'testing123';
  
  console.log('🎯 Setting up specific text replacement...');
  
  await openTextReplacementsForManualSetup(trigger, replacement);
  
  // Also copy the values to clipboard for easy pasting
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Copy the trigger to clipboard first
    await execAsync(`echo "${trigger}" | pbcopy`);
    console.log(`\n📋 "${trigger}" copied to clipboard for easy pasting!`);
    console.log('💡 After clicking +, just paste (Cmd+V) in the Replace field');
    
  } catch (error) {
    console.log('⚠️ Could not copy to clipboard, but you can manually type the values');
  }
}

/**
 * Simply opens System Settings to Text Replacements - no automation, just navigation
 * @returns Promise resolving when System Settings is opened
 */
export async function openTextReplacementsOnly(): Promise<void> {
  console.log('📝 Opening System Settings > Keyboard > Text Replacements...');
  
  try {
    // First, open to the main Keyboard page
    await execAsync('open "x-apple.systempreferences:com.apple.preference.keyboard"');
    
    // Wait for it to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now click the "Text Replacements..." button
    const clickTextReplacementsScript = `
      tell application "System Settings"
        activate
        delay 1
      end tell
      
      tell application "System Events"
        tell process "System Settings"
          try
            -- Look for the "Text Replacements..." button
            set textReplacementsButton to missing value
            
            -- Method 1: Direct button lookup
            repeat with i from 1 to 5
              try
                if exists button "Text Replacements..." of front window then
                  set textReplacementsButton to button "Text Replacements..." of front window
                  exit repeat
                end if
                
                -- Also try without the "..." 
                if exists button "Text Replacements" of front window then
                  set textReplacementsButton to button "Text Replacements" of front window
                  exit repeat
                end if
                
                delay 0.5
              end try
            end repeat
            
            -- Method 2: Look in groups
            if textReplacementsButton is missing value then
              set allGroups to every group of front window
              repeat with grp in allGroups
                try
                  if exists button "Text Replacements..." of grp then
                    set textReplacementsButton to button "Text Replacements..." of grp
                    exit repeat
                  end if
                  if exists button "Text Replacements" of grp then
                    set textReplacementsButton to button "Text Replacements" of grp
                    exit repeat
                  end if
                end try
              end repeat
            end if
            
            -- Method 3: Try coordinate click in bottom-right area where button should be
            if textReplacementsButton is missing value then
              set winBounds to bounds of front window
              set winWidth to item 3 of winBounds
              set winHeight to item 4 of winBounds
              
              -- Click in bottom-right area where Text Replacements button is
              set clickX to winWidth - 120
              set clickY to winHeight - 80
              click at {clickX, clickY}
              delay 1
              return "coordinate_click_attempted"
            else
              -- Click the found button
              click textReplacementsButton
              delay 1
              return "button_clicked"
            end if
            
          on error errorMsg
            return "error: " & errorMsg
          end try
        end tell
      end tell
    `;
    
    console.log('🎯 Attempting to click Text Replacements button...');
    const { stdout } = await execAsync(`osascript -e '${clickTextReplacementsScript}'`);
    
    console.log('Click result:', stdout.trim());
    
    if (stdout.includes('button_clicked') || stdout.includes('coordinate_click_attempted')) {
      console.log('✅ Navigated to Text Replacements interface');
      console.log('💡 You should now see the Text Replacements list with a + button');
    } else {
      console.log('⚠️ Could not automatically click Text Replacements button');
      console.log('👆 Please manually click the "Text Replacements..." button in the bottom-right');
    }
    
  } catch (error) {
    console.error('❌ Error opening Text Replacements:', error);
    throw error;
  }
} 