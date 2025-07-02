/**
 * @file Embedding node for converting text to vector representations using OpenAI
 * @module embedding-node
 */

import { OpenAIEmbeddings } from '@langchain/openai';

// Interface for log entries
interface LogEntry {
  timestamp: string;
  text: string;
  windowTitle?: string;
  processName?: string;
}

// Interface for embedding results
interface EmbeddingResult {
  text: string;
  embedding: number[];
  index: number;
}

/**
 * Embeds text entries using OpenAI's text-embedding-3-small model
 * @param logEntries - Array of log entries to embed
 * @param apiKey - OpenAI API key
 * @returns Promise resolving to array of embedding results
 */
export async function embedTexts(
  logEntries: LogEntry[], 
  apiKey: string
): Promise<EmbeddingResult[]> {
  if (!logEntries || logEntries.length === 0) {
    throw new Error('No log entries provided for embedding');
  }

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  console.log(`Embedding ${logEntries.length} text entries...`);

  try {
    // Initialize OpenAI embeddings with the small model for cost efficiency
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      model: 'text-embedding-3-small',
      dimensions: 1536, // Standard dimension for text-embedding-3-small
    });

    // Extract just the text content for embedding
    const texts = logEntries.map(entry => entry.text);

    // Filter out empty or very short texts
    const validTexts = texts.filter(text => text.trim().length >= 10);

    if (validTexts.length === 0) {
      throw new Error('No valid texts found for embedding (all texts too short)');
    }

    console.log(`Embedding ${validTexts.length} valid texts (filtered from ${texts.length})`);

    // Generate embeddings in batches to avoid API limits
    const batchSize = 100; // OpenAI embedding API limit
    const embeddingResults: EmbeddingResult[] = [];

    for (let i = 0; i < validTexts.length; i += batchSize) {
      const batch = validTexts.slice(i, i + batchSize);
      console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validTexts.length / batchSize)}`);

      try {
        // Generate embeddings for this batch
        const batchEmbeddings = await embeddings.embedDocuments(batch);

        // Create embedding results with original indices
        const batchResults = batchEmbeddings.map((embedding, batchIndex) => ({
          text: batch[batchIndex],
          embedding,
          index: i + batchIndex
        }));

        embeddingResults.push(...batchResults);

        // Small delay between batches to respect rate limits
        if (i + batchSize < validTexts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (batchError) {
        console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, batchError);
        throw new Error(`Failed to embed batch starting at index ${i}: ${batchError}`);
      }
    }

    console.log(`Successfully generated ${embeddingResults.length} embeddings`);

    // Validate embeddings
    const invalidEmbeddings = embeddingResults.filter(result => 
      !result.embedding || !Array.isArray(result.embedding) || result.embedding.length === 0
    );

    if (invalidEmbeddings.length > 0) {
      console.warn(`Found ${invalidEmbeddings.length} invalid embeddings`);
    }

    return embeddingResults;

  } catch (error) {
    console.error('Error generating embeddings:', error);
    
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
    
    throw new Error(`Failed to generate embeddings: ${error}`);
  }
}

/**
 * Calculates cosine similarity between two embedding vectors
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity score between 0 and 1
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  // Calculate magnitudes
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < embedding1.length; i++) {
    magnitude1 += embedding1[i] * embedding1[i];
    magnitude2 += embedding2[i] * embedding2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Validates that an embedding vector is valid
 * @param embedding - The embedding vector to validate
 * @returns Whether the embedding is valid
 */
export function isValidEmbedding(embedding: number[]): boolean {
  return Array.isArray(embedding) && 
         embedding.length > 0 && 
         embedding.every(value => typeof value === 'number' && !isNaN(value));
} 