export const makeProblemGlobalId = (problemOj: string, problemId: string) =>
  `${problemOj}-${problemId}`;

/**
 * Defines options, related to retrying and caching, to be used as
 * a parameter in `attemptFetch`
 */
interface AttemptFetchOptions {
  /**
   * Maximum number of times to attempt fetching
   */
  maxAttemptTimes: number;

  /**
   * Check if the response is valid
   * @param response Response to check
   * @returns Whether the response is valid
   * @example
   * checkValid: (response) => response.getResponseCode() === 200
   * checkValid: (response) => !response.getContentText().includes('Error')
   */
  checkValid: (response: GoogleAppsScript.URL_Fetch.HTTPResponse) => boolean;

  /**
   * Check if the response is cacheable
   * @param text Text content of the response
   * @returns Whether the response is cacheable
   * @example
   * isCacheable: (text) => !text.includes('Error')
   * isCacheable: (text) => text.includes('No Submissions')
   * isCacheable: (text) => true
   */
  isCacheable: (text: string) => boolean;

  /**
   * Expiration time of the cache in seconds
   * @example
   * cacheExpirationInSeconds: 60 * 60 * 24 * 7 // 1 week
   * cacheExpirationInSeconds: 60 * 60 * 24 // 1 day
   * cacheExpirationInSeconds: 60 * 60 // 1 hour
   */
  cacheExpirationInSeconds: number;
}

const defaultOptions: AttemptFetchOptions = {
  maxAttemptTimes: 10,
  checkValid: () => true,
  isCacheable: () => true,
  cacheExpirationInSeconds: 60 * 60 * 24 * 7,
};

/**
 * Fetch a URL with retry.
 * @param url URL to fetch
 * @param options Options related to retrying and caching
 * @returns `[responseText, ok]`  
 *  `responseText`: the text content of the response  
 *  `ok`: whether the fetch is successful, even if after retrying  
 * @example
 * const [responseText, ok] = attemptFetch('https://atcoder.jp/contests/abc001/tasks');
 * if (!ok) {
 *  console.error(`Failed to fetch https://atcoder.jp/contests/abc001/tasks`);
 * }
 */
export const attemptFetch = (
  url: string,
  options: Partial<AttemptFetchOptions> = defaultOptions,
): [string, boolean] => {

  if (url === '') {
    return ['', false];
  }

  options = { ...defaultOptions, ...options };
  const { maxAttemptTimes, checkValid, isCacheable, cacheExpirationInSeconds } = options;

  const cache = CacheService.getScriptCache().get(url);
  if (cache !== null) {
    return [cache, true];
  }

  let errorMessage = '';

  for (let attempt = 0; attempt < maxAttemptTimes; ++attempt) {
    try {
      const response = UrlFetchApp.fetch(url);
      if (!checkValid(response)) {
        throw new Error(`Failed to fetch ${url}`);
      }
      const text = response.getContentText();
      if (isCacheable(text)) {
        CacheService.getScriptCache().put(url, text, cacheExpirationInSeconds);
      }
      return [text, true];
    }
    catch (e) {
      errorMessage = `Error while fetching ${url}\n` + e.message;
    }
  }
  console.error(errorMessage);
  return ['', false];
}

/**
 * Get the percentile rank of each player
 * @param players Array of players; each player is an object with `id` and `score`
 * @returns Map from player id to percentile rank
 */
export const getPercentileRankMap = (
  players: { id: string, score: number }[],
) => {
  const sorted = [...players].sort((a, b) => a.score - b.score);
  const ranks = players.map(player => {
    // binary search number of scores <= score
    let l = 0, r = sorted.length - 1, rank = 0;
    while (l <= r) {
      const mid = Math.floor((l + r) / 2);
      if (sorted[mid].score <= player.score) {
        rank = mid;
        l = mid + 1;
      } else {
        r = mid - 1;
      }
    }
    return Math.round(((rank + 1) / sorted.length) * 100);
  });
  const map = new Map<string, { rank: number, score: number }>();
  players.forEach((player, index) => {
    map.set(player.id, {
      rank: ranks[index],
      score: player.score
    });
  });
  return map;
};


