/**
 * @file Utility for generating keyboard shortcut triggers from replacement text
 * @module trigger-generator
 */

// List of common action keywords for trigger generation
const ACTION_KEYWORDS = [
  'explain', 'describe', 'analyze', 'review', 'check', 'test', 'debug',
  'create', 'generate', 'build', 'make', 'write', 'add', 'insert',
  'update', 'modify', 'change', 'edit', 'fix', 'correct', 'improve',
  'remove', 'delete', 'clean', 'clear', 'reset', 'undo',
  'find', 'search', 'locate', 'get', 'fetch', 'retrieve',
  'show', 'display', 'print', 'output', 'list', 'enumerate',
  'compare', 'match', 'validate', 'verify', 'confirm',
  'open', 'close', 'save', 'load', 'import', 'export',
  'start', 'stop', 'run', 'execute', 'launch', 'quit'
];

// Common subject keywords for different contexts
const SUBJECT_KEYWORDS = [
  'code', 'function', 'method', 'class', 'variable', 'file', 'folder',
  'test', 'bug', 'error', 'issue', 'problem', 'solution',
  'data', 'database', 'query', 'table', 'record', 'field',
  'user', 'account', 'login', 'password', 'session', 'auth',
  'api', 'endpoint', 'request', 'response', 'json', 'xml',
  'config', 'setting', 'option', 'parameter', 'value',
  'server', 'client', 'network', 'connection', 'port',
  'component', 'module', 'plugin', 'library', 'framework'
];

// Words to filter out from triggers
const STOP_WORDS = [
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just',
  'should', 'now', 'this', 'that', 'these', 'those', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
];

/**
 * Generates a shortcut trigger from replacement text using the keyword formula
 * Formula: `;` + first action verb + first relevant keyword
 * @param replacementText - The text replacement to generate a trigger for
 * @returns Generated trigger string
 */
export function generateShortcutTrigger(replacementText: string): string {
  if (!replacementText || typeof replacementText !== 'string') {
    return ';auto';
  }

  try {
    // Clean and normalize the text
    const cleanText = replacementText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim();

    if (!cleanText) {
      return ';auto';
    }

    const words = cleanText.split(' ').filter(word => 
      word.length > 2 && !STOP_WORDS.includes(word)
    );

    if (words.length === 0) {
      return ';auto';
    }

    // Find the first action keyword
    const actionWord = words.find(word => ACTION_KEYWORDS.includes(word));
    
    // Find the first subject keyword
    const subjectWord = words.find(word => SUBJECT_KEYWORDS.includes(word));
    
    // Generate trigger based on available keywords
    let trigger = ';';
    
    if (actionWord && subjectWord) {
      // Ideal case: action + subject
      trigger += actionWord + subjectWord;
    } else if (actionWord) {
      // Action + first non-action word
      const firstOtherWord = words.find(word => word !== actionWord);
      trigger += actionWord + (firstOtherWord || '');
    } else if (subjectWord) {
      // Subject + action-like word or first word
      const firstWord = words[0];
      trigger += (firstWord === subjectWord ? subjectWord : firstWord + subjectWord);
    } else {
      // Fallback: use first two words
      trigger += words.slice(0, 2).join('');
    }

    // Ensure trigger is reasonable length
    if (trigger.length > 15) {
      trigger = trigger.substring(0, 15);
    }

    // Ensure minimum length
    if (trigger.length < 4) {
      trigger += 'x';
    }

    return trigger;

  } catch (error) {
    console.error('Error generating trigger:', error);
    return ';auto';
  }
}

/**
 * Validates that a trigger follows expected patterns
 * @param trigger - The trigger to validate
 * @returns Whether the trigger is valid
 */
export function isValidTrigger(trigger: string): boolean {
  if (!trigger || typeof trigger !== 'string') {
    return false;
  }

  // Must start with semicolon
  if (!trigger.startsWith(';')) {
    return false;
  }

  // Must be reasonable length
  if (trigger.length < 3 || trigger.length > 20) {
    return false;
  }

  // Must contain only letters and semicolon
  if (!/^;[a-z]+$/.test(trigger)) {
    return false;
  }

  return true;
}

/**
 * Generates alternative trigger options for a replacement text
 * @param replacementText - The text replacement
 * @returns Array of alternative trigger options
 */
export function generateAlternativeTriggers(replacementText: string): string[] {
  const alternatives: string[] = [];
  const primary = generateShortcutTrigger(replacementText);
  alternatives.push(primary);

  try {
    const cleanText = replacementText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleanText.split(' ').filter(word => 
      word.length > 2 && !STOP_WORDS.includes(word)
    );

    // Generate variations
    if (words.length >= 2) {
      // First word + last word
      alternatives.push(`;${words[0]}${words[words.length - 1]}`);
      
      // First letter of each word
      const initials = words.map(w => w[0]).join('');
      if (initials.length >= 3) {
        alternatives.push(`;${initials}`);
      }
    }

    // Abbreviation based on vowel removal
    const firstWord = words[0];
    if (firstWord && firstWord.length > 4) {
      const abbreviated = firstWord.replace(/[aeiou]/g, '');
      if (abbreviated.length >= 3) {
        alternatives.push(`;${abbreviated}`);
      }
    }

  } catch (error) {
    console.error('Error generating alternative triggers:', error);
  }

  // Remove duplicates and invalid triggers
  return [...new Set(alternatives)].filter(isValidTrigger);
}

/**
 * Checks if a trigger might conflict with common system shortcuts
 * @param trigger - The trigger to check
 * @returns Whether the trigger might cause conflicts
 */
export function hasLikelyConflicts(trigger: string): boolean {
  const conflictPatterns = [
    ';cmd', ';ctrl', ';alt', ';shift',  // System modifiers
    ';copy', ';paste', ';cut', ';undo', // Common shortcuts
    ';save', ';open', ';close', ';quit', // File operations
    ';new', ';print', ';find'           // Common commands
  ];
  
  return conflictPatterns.some(pattern => trigger === pattern);
}

/**
 * Suggests trigger improvements based on common patterns
 * @param trigger - The original trigger
 * @param replacementText - The replacement text for context
 * @returns Improved trigger suggestion or original if no improvement needed
 */
export function improveTrigger(trigger: string, replacementText: string): string {
  if (!isValidTrigger(trigger)) {
    return generateShortcutTrigger(replacementText);
  }

  if (hasLikelyConflicts(trigger)) {
    // Try to generate a different trigger
    const alternatives = generateAlternativeTriggers(replacementText);
    const nonConflicting = alternatives.find(alt => !hasLikelyConflicts(alt));
    return nonConflicting || trigger + 'x';
  }

  return trigger;
} 