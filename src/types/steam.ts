export interface SteamAppInfo {
  name: string;
  image_url: string;
  appid: number;
  platforms: string[];
  release_date: string;
  metacritic_score?: number;
  review_summary?: string;
}
