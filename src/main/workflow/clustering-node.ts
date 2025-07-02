/**
 * @file Clustering node for grouping similar text embeddings using DBSCAN algorithm
 * @module clustering-node
 */

import { DBSCAN } from 'density-clustering';
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

// Configuration for DBSCAN clustering algorithm
const DBSCAN_CONFIG = {
  epsilon: 0.3,              // Maximum distance between two samples for them to be considered neighbors
  minPoints: 2,              // TEMPORARILY LOWERED: Minimum number of points required to form a dense region (cluster)
  maxClusters: 10,           // Maximum number of clusters to return
  distanceFunction: 'cosine' // Distance function to use for clustering
};

/**
 * Clusters embeddings using DBSCAN algorithm for density-based clustering
 * @param embeddings - Array of embedding results to cluster
 * @returns Promise resolving to array of clusters
 */
export async function clusterEmbeddings(embeddings: EmbeddingResult[]): Promise<ClusterResult[]> {
  if (!embeddings || embeddings.length === 0) {
    throw new Error('No embeddings provided for clustering');
  }

  console.log(`Clustering ${embeddings.length} embeddings using DBSCAN...`);

  try {
    // Validate embeddings
    const validEmbeddings = embeddings.filter(result => 
      result.embedding && 
      Array.isArray(result.embedding) && 
      result.embedding.length > 0 &&
      result.text && 
      result.text.trim().length > 0
    );

    if (validEmbeddings.length < DBSCAN_CONFIG.minPoints) {
      console.log(`Not enough valid embeddings for DBSCAN clustering (need at least ${DBSCAN_CONFIG.minPoints})`);
      return [];
    }

    console.log(`Clustering ${validEmbeddings.length} valid embeddings with DBSCAN`);

    // Use DBSCAN clustering algorithm
    const clusters = await performDBSCANClustering(validEmbeddings);

    // Sort by cluster size (largest first) and limit to max clusters
    const sortedClusters = clusters
      .sort((a, b) => b.size - a.size)
      .slice(0, DBSCAN_CONFIG.maxClusters);

    console.log(`DBSCAN found ${sortedClusters.length} valid clusters`);
    sortedClusters.forEach((cluster, index) => {
      console.log(`Cluster ${index + 1}: ${cluster.size} items`);
      console.log(`  Sample texts: ${cluster.texts.slice(0, 2).map(t => `"${t.substring(0, 50)}..."`).join(', ')}`);
    });

    return sortedClusters;

  } catch (error) {
    console.error('Error clustering embeddings with DBSCAN:', error);
    throw new Error(`Failed to cluster embeddings: ${error}`);
  }
}

/**
 * Performs DBSCAN clustering on embeddings
 * @param embeddings - Valid embeddings to cluster
 * @returns Array of cluster results
 */
async function performDBSCANClustering(embeddings: EmbeddingResult[]): Promise<ClusterResult[]> {
  // Initialize DBSCAN with configured parameters
  const dbscan = new DBSCAN();
  
  // Extract just the embedding vectors for clustering
  const vectors = embeddings.map(result => result.embedding);
  
  // Define distance function for DBSCAN (1 - cosine similarity = cosine distance)
  const distanceFunction = (vectorA: number[], vectorB: number[]): number => {
    const similarity = calculateCosineSimilarity(vectorA, vectorB);
    return 1 - similarity; // Convert similarity to distance
  };
  
  console.log(`Running DBSCAN with epsilon=${DBSCAN_CONFIG.epsilon}, minPoints=${DBSCAN_CONFIG.minPoints}`);
  
  // Run DBSCAN clustering
  const clusterIndices = dbscan.run(
    vectors, 
    DBSCAN_CONFIG.epsilon, 
    DBSCAN_CONFIG.minPoints, 
    distanceFunction
  );
  
  console.log(`DBSCAN returned ${clusterIndices.length} clusters`);
  
  // Convert DBSCAN results to our cluster format
  const clusters: ClusterResult[] = [];
  
  for (let clusterIndex = 0; clusterIndex < clusterIndices.length; clusterIndex++) {
    const pointIndices = clusterIndices[clusterIndex];
    
    if (pointIndices.length < DBSCAN_CONFIG.minPoints) {
      continue; // Skip clusters that are too small
    }
    
    // Get texts and embeddings for this cluster
    const clusterTexts = pointIndices.map(idx => embeddings[idx].text);
    const clusterEmbeddings = pointIndices.map(idx => embeddings[idx].embedding);
    
    // Calculate centroid
    const centroid = calculateCentroid(clusterEmbeddings);
    
    clusters.push({
      texts: clusterTexts,
      centroid,
      size: clusterTexts.length
    });
  }
  
  console.log(`Created ${clusters.length} valid clusters from DBSCAN results`);
  
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

    if (clusterTexts.length >= DBSCAN_CONFIG.minPoints) {
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