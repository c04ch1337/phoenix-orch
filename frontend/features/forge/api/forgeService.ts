/**
 * API service for Forge functionality
 */

/**
 * Types for Forge Leaderboard
 */
export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  agent_name: string;
  score: number;
  conscience_score: number;
  usage_count: number;
  impact_score: number;
  is_ashen_saint: boolean;
  last_updated: string;
}

/**
 * Fetch the latest forge leaderboard data
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:5001';
  const response = await fetch(`${apiHost}/api/v1/forge/leaderboard`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}