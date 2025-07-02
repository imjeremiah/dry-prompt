/**
 * @file Synthesis node for converting text clusters into actionable suggestions using GPT
 * @module synthesis-node
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

// Interface for cluster results
interface ClusterResult {
  texts: string[];
  centroid: number[];
  size: number;
}

// Interface for suggestion results
interface SuggestionResult {
  replacement: string;
  sourceTexts: string[];
  confidence: number;
}

/**
 * Synthesizes actionable suggestions from text clusters using GPT-4
 * @param clusters - Array of cluster results to synthesize
 * @param apiKey - OpenAI API key
 * @returns Promise resolving to array of suggestion results
 */
export async function synthesizeSuggestions(
  clusters: ClusterResult[],
  apiKey: string
): Promise<SuggestionResult[]> {
  if (!clusters || clusters.length === 0) {
    throw new Error('No clusters provided for synthesis');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  console.log(`Synthesizing suggestions from ${clusters.length} clusters...`);

  try {
    // Initialize OpenAI chat model with GPT-4o for best reasoning
    const llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      model: 'gpt-4o',
      temperature: 0.3, // Low temperature for consistent results
      maxTokens: 1000    // Reasonable limit for responses
    });

    const suggestions: SuggestionResult[] = [];

    // Process each cluster individually for better control
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      console.log(`Processing cluster ${i + 1}/${clusters.length} (${cluster.size} items)`);

      try {
        const clusterSuggestion = await processSingleCluster(cluster, llm);
        
        if (clusterSuggestion) {
          suggestions.push(clusterSuggestion);
        }

        // Small delay between API calls to respect rate limits
        if (i < clusters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (clusterError) {
        console.error(`Error processing cluster ${i + 1}:`, clusterError);
        // Continue with other clusters rather than failing completely
      }
    }

    console.log(`Generated ${suggestions.length} suggestions from ${clusters.length} clusters`);

    // Sort suggestions by confidence score
    const sortedSuggestions = suggestions.sort((a, b) => b.confidence - a.confidence);

    return sortedSuggestions;

  } catch (error) {
    console.error('Error synthesizing suggestions:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Invalid or missing OpenAI API key');
      }
      if (error.message.includes('quota')) {
        throw new Error('OpenAI API quota exceeded');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('OpenAI API rate limit exceeded');
      }
    }
    
    throw new Error(`Failed to synthesize suggestions: ${error}`);
  }
}

/**
 * Processes a single cluster to generate a suggestion
 * @param cluster - The cluster to process
 * @param llm - The OpenAI chat model instance
 * @returns Promise resolving to suggestion result or null if no good suggestion
 */
async function processSingleCluster(
  cluster: ClusterResult,
  llm: ChatOpenAI
): Promise<SuggestionResult | null> {
  
  // Create a focused prompt for this specific cluster
  const prompt = createClusterPrompt(cluster);
  
  try {
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const content = response.content as string;
    
    // Parse the response to extract the suggestion
    const parsed = parseGptResponse(content);
    
    if (!parsed) {
      console.log(`No valid suggestion extracted from cluster of ${cluster.size} items`);
      return null;
    }

    return {
      replacement: parsed.replacement,
      sourceTexts: cluster.texts,
      confidence: calculateConfidence(cluster, parsed.replacement)
    };

  } catch (error) {
    console.error('Error processing cluster with GPT:', error);
    return null;
  }
}

/**
 * Creates a carefully engineered prompt for analyzing a cluster
 * @param cluster - The cluster to create a prompt for
 * @returns Formatted prompt string
 */
function createClusterPrompt(cluster: ClusterResult): string {
  // Sample up to 5 texts from the cluster for analysis
  const sampleTexts = cluster.texts.slice(0, 5);
  
  return `You are analyzing repetitive text patterns to suggest keyboard shortcuts for a productivity app.

TASK: Analyze these similar text prompts and create ONE concise, generic text replacement that captures their common intent.

SIMILAR PROMPTS (${cluster.size} total):
${sampleTexts.map((text, i) => `${i + 1}. "${text}"`).join('\n')}

REQUIREMENTS:
- Create a generic version that works for ALL the prompts above
- Keep it concise but complete (max 100 characters)
- Make it professional and clear
- Focus on the ACTION or INTENT, not specific details
- Suitable for text replacement/autocomplete

RESPONSE FORMAT:
Replacement: [your suggested text replacement]
Confidence: [HIGH/MEDIUM/LOW based on how well the prompts match]

Example:
Replacement: Explain the following code:
Confidence: HIGH`;
}

/**
 * Parses GPT response to extract the suggestion and confidence
 * @param response - Raw GPT response text
 * @returns Parsed result or null if parsing fails
 */
function parseGptResponse(response: string): { replacement: string; confidence: string } | null {
  try {
    // Look for "Replacement:" line
    const replacementMatch = response.match(/Replacement:\s*(.+)/i);
    const confidenceMatch = response.match(/Confidence:\s*(HIGH|MEDIUM|LOW)/i);
    
    if (!replacementMatch) {
      console.log('Could not find replacement in GPT response');
      return null;
    }
    
    const replacement = replacementMatch[1].trim();
    const confidence = confidenceMatch ? confidenceMatch[1].toUpperCase() : 'MEDIUM';
    
    // Validate replacement
    if (!replacement || replacement.length < 5 || replacement.length > 200) {
      console.log(`Invalid replacement length: "${replacement}"`);
      return null;
    }
    
    // Clean up replacement (remove quotes if present)
    const cleanReplacement = replacement.replace(/^["']|["']$/g, '').trim();
    
    return {
      replacement: cleanReplacement,
      confidence
    };
    
  } catch (error) {
    console.error('Error parsing GPT response:', error);
    return null;
  }
}

/**
 * Calculates a confidence score for a suggestion based on cluster characteristics
 * @param cluster - The source cluster
 * @param replacement - The suggested replacement text
 * @returns Confidence score between 0 and 1
 */
function calculateConfidence(cluster: ClusterResult, replacement: string): number {
  let confidence = 0.5; // Base confidence
  
  // Higher confidence for larger clusters
  if (cluster.size >= 5) {
    confidence += 0.2;
  } else if (cluster.size >= 3) {
    confidence += 0.1;
  }
  
  // Check text length consistency
  const avgLength = cluster.texts.reduce((sum, text) => sum + text.length, 0) / cluster.texts.length;
  const lengthVariance = cluster.texts.reduce((sum, text) => 
    sum + Math.pow(text.length - avgLength, 2), 0
  ) / cluster.texts.length;
  
  // Lower variance in length suggests more similar texts
  if (lengthVariance < 100) {
    confidence += 0.1;
  }
  
  // Check if replacement is reasonable length
  if (replacement.length >= 10 && replacement.length <= 80) {
    confidence += 0.1;
  }
  
  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Validates that a suggestion meets quality criteria
 * @param suggestion - The suggestion to validate
 * @returns Whether the suggestion is valid
 */
export function isValidSuggestion(suggestion: SuggestionResult): boolean {
  return (
    suggestion.replacement &&
    typeof suggestion.replacement === 'string' &&
    suggestion.replacement.length >= 5 &&
    suggestion.replacement.length <= 200 &&
    suggestion.confidence > 0.3 &&
    suggestion.sourceTexts &&
    suggestion.sourceTexts.length >= 2
  );
}

/**
 * Filters suggestions to remove low-quality ones
 * @param suggestions - Array of suggestions to filter
 * @returns Filtered array of high-quality suggestions
 */
export function filterQualitySuggestions(suggestions: SuggestionResult[]): SuggestionResult[] {
  return suggestions
    .filter(isValidSuggestion)
    .filter(suggestion => suggestion.confidence >= 0.4)
    .slice(0, 5); // Limit to top 5 suggestions
} 