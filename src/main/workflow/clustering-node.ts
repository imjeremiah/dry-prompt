/**
 * @file Clustering node for grouping similar text embeddings
 * @module clustering-node
 */

import { calculateCosineSimilarity } from './embedding-node';

// Interface for embedding results
interface EmbeddingResult {
  text: string;
  embedding: number[];
  index: number;
}

// Interface for cluster results
interface ClusterResult {
  texts: string[];
  centroid: number[];
  size: number;
}

// Configuration for clustering algorithm
const CLUSTERING_CONFIG = {
  similarityThreshold: 0.7,  // Minimum similarity to be in same cluster
  minClusterSize: 2,         // Minimum number of items per cluster
  maxClusters: 10            // Maximum number of clusters to return
};

/**
 * Clusters embeddings using a simple similarity-based approach
 * This is a simplified alternative to DBSCAN that doesn't require external dependencies
 * @param embeddings - Array of embedding results to cluster
 * @returns Promise resolving to array of clusters
 */
export async function clusterEmbeddings(embeddings: EmbeddingResult[]): Promise<ClusterResult[]> {
  if (!embeddings || embeddings.length === 0) {
    throw new Error('No embeddings provided for clustering');
  }

  console.log(`Clustering ${embeddings.length} embeddings...`);

  try {
    // Validate embeddings
    const validEmbeddings = embeddings.filter(result => 
      result.embedding && 
      Array.isArray(result.embedding) && 
      result.embedding.length > 0 &&
      result.text && 
      result.text.trim().length > 0
    );

    if (validEmbeddings.length < 2) {
      console.log('Not enough valid embeddings for clustering');
      return [];
    }

    console.log(`Clustering ${validEmbeddings.length} valid embeddings`);

    // Use simple agglomerative clustering approach
    const clusters = await performSimpleClustering(validEmbeddings);

    // Filter clusters by minimum size
    const filteredClusters = clusters.filter(cluster => 
      cluster.size >= CLUSTERING_CONFIG.minClusterSize
    );

    // Sort by cluster size (largest first) and limit to max clusters
    const sortedClusters = filteredClusters
      .sort((a, b) => b.size - a.size)
      .slice(0, CLUSTERING_CONFIG.maxClusters);

    console.log(`Found ${sortedClusters.length} valid clusters`);
    sortedClusters.forEach((cluster, index) => {
      console.log(`Cluster ${index + 1}: ${cluster.size} items`);
      console.log(`  Sample texts: ${cluster.texts.slice(0, 2).map(t => `"${t.substring(0, 50)}..."`).join(', ')}`);
    });

    return sortedClusters;

  } catch (error) {
    console.error('Error clustering embeddings:', error);
    throw new Error(`Failed to cluster embeddings: ${error}`);
  }
}

/**
 * Performs simple similarity-based clustering
 * @param embeddings - Valid embeddings to cluster
 * @returns Array of cluster results
 */
async function performSimpleClustering(embeddings: EmbeddingResult[]): Promise<ClusterResult[]> {
  const clusters: ClusterResult[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < embeddings.length; i++) {
    if (processed.has(i)) {
      continue; // Already assigned to a cluster
    }

    const seedEmbedding = embeddings[i];
    const clusterTexts = [seedEmbedding.text];
    const clusterEmbeddings = [seedEmbedding.embedding];
    processed.add(i);

    // Find similar embeddings
    for (let j = i + 1; j < embeddings.length; j++) {
      if (processed.has(j)) {
        continue;
      }

      const targetEmbedding = embeddings[j];
      const similarity = calculateCosineSimilarity(
        seedEmbedding.embedding, 
        targetEmbedding.embedding
      );

      if (similarity >= CLUSTERING_CONFIG.similarityThreshold) {
        clusterTexts.push(targetEmbedding.text);
        clusterEmbeddings.push(targetEmbedding.embedding);
        processed.add(j);
      }
    }

    // Only create cluster if it has minimum size
    if (clusterTexts.length >= CLUSTERING_CONFIG.minClusterSize) {
      const centroid = calculateCentroid(clusterEmbeddings);
      
      clusters.push({
        texts: clusterTexts,
        centroid,
        size: clusterTexts.length
      });
    }
  }

  return clusters;
}

/**
 * Calculates the centroid (average) of a set of embedding vectors
 * @param embeddings - Array of embedding vectors
 * @returns Centroid vector
 */
function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    return [];
  }

  const dimensions = embeddings[0].length;
  const centroid = new Array(dimensions).fill(0);

  // Sum all embeddings
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += embedding[i];
    }
  }

  // Calculate average
  for (let i = 0; i < dimensions; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

/**
 * Alternative clustering method using k-means-like approach
 * This can be used if the simple method doesn't work well
 * @param embeddings - Embeddings to cluster
 * @param k - Number of clusters to create
 * @returns Array of cluster results
 */
export async function performKMeansClustering(
  embeddings: EmbeddingResult[], 
  k: number = 5
): Promise<ClusterResult[]> {
  if (embeddings.length < k) {
    console.log('Not enough embeddings for k-means clustering');
    return [];
  }

  console.log(`Performing k-means clustering with k=${k}`);

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const shuffled = [...embeddings].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < k; i++) {
    centroids.push([...shuffled[i].embedding]);
  }

  const maxIterations = 10;
  let assignments: number[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const newAssignments: number[] = [];

    // Assign each embedding to closest centroid
    for (const embedding of embeddings) {
      let bestCluster = 0;
      let bestSimilarity = -1;

      for (let c = 0; c < centroids.length; c++) {
        const similarity = calculateCosineSimilarity(embedding.embedding, centroids[c]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = c;
        }
      }

      newAssignments.push(bestCluster);
    }

    // Check for convergence
    if (JSON.stringify(assignments) === JSON.stringify(newAssignments)) {
      console.log(`K-means converged after ${iteration + 1} iterations`);
      break;
    }

    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterEmbeddings = embeddings
        .filter((_, index) => assignments[index] === c)
        .map(result => result.embedding);

      if (clusterEmbeddings.length > 0) {
        centroids[c] = calculateCentroid(clusterEmbeddings);
      }
    }
  }

  // Build final clusters
  const clusters: ClusterResult[] = [];

  for (let c = 0; c < k; c++) {
    const clusterTexts = embeddings
      .filter((_, index) => assignments[index] === c)
      .map(result => result.text);

    if (clusterTexts.length >= CLUSTERING_CONFIG.minClusterSize) {
      clusters.push({
        texts: clusterTexts,
        centroid: centroids[c],
        size: clusterTexts.length
      });
    }
  }

  return clusters.sort((a, b) => b.size - a.size);
}

/**
 * Gets cluster statistics for debugging and analysis
 * @param clusters - Array of cluster results
 * @returns Statistics about the clustering results
 */
export function getClusteringStats(clusters: ClusterResult[]): {
  totalClusters: number;
  totalItems: number;
  averageClusterSize: number;
  largestClusterSize: number;
  smallestClusterSize: number;
} {
  if (clusters.length === 0) {
    return {
      totalClusters: 0,
      totalItems: 0,
      averageClusterSize: 0,
      largestClusterSize: 0,
      smallestClusterSize: 0
    };
  }

  const sizes = clusters.map(c => c.size);
  const totalItems = sizes.reduce((sum, size) => sum + size, 0);

  return {
    totalClusters: clusters.length,
    totalItems,
    averageClusterSize: totalItems / clusters.length,
    largestClusterSize: Math.max(...sizes),
    smallestClusterSize: Math.min(...sizes)
  };
} 