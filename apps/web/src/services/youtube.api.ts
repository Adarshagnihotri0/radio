import axios from 'axios';

export interface YouTubeSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

interface YouTube138Content {
  videoId?: string;
  title?: string;
  channelTitle?: string;
  thumbnails?: Array<{ url?: string }>;
}

interface YouTube138WrappedContent {
  type?: string;
  video?: YouTube138Content;
}

interface YouTube138SearchResponse {
  contents?: Array<YouTube138Content | YouTube138WrappedContent>;
}

function unwrapYouTube138Content(
  item: YouTube138Content | YouTube138WrappedContent,
): YouTube138Content | null {
  if ('videoId' in item || 'title' in item || 'channelTitle' in item || 'thumbnails' in item) {
    return item as YouTube138Content;
  }

  if ('video' in item) {
    return item.video ?? null;
  }

  return null;
}

function getViteEnv(): Record<string, string | undefined> {
  return (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
}

function toSearchItem(content: YouTube138Content): YouTubeSearchItem | null {
  if (!content.videoId) return null;

  const thumb = content.thumbnails?.[1]?.url ?? content.thumbnails?.[0]?.url;

  return {
    id: { videoId: content.videoId },
    snippet: {
      title: content.title ?? 'Untitled video',
      channelTitle: content.channelTitle ?? 'Unknown channel',
      thumbnails: {
        medium: thumb ? { url: thumb } : undefined,
        default: thumb ? { url: thumb } : undefined,
      },
    },
  };
}

function getRapidApiKey(): string | null {
  return getViteEnv().VITE_RAPIDAPI_KEY?.trim() || null;
}

function getRapidApiHost(): string {
  return getViteEnv().VITE_RAPIDAPI_HOST?.trim() || 'youtube-v31.p.rapidapi.com';
}

export const youtubeApi = {
  hasKey: (): boolean => Boolean(getRapidApiKey()),

  search: async (query: string): Promise<YouTubeSearchItem[]> => {
    const apiKey = getRapidApiKey();
    const apiHost = getRapidApiHost();
    if (!apiKey) {
      throw new Error('Missing VITE_RAPIDAPI_KEY in apps/web/.env');
    }

    // youtube138 can return channel videos via POST with a different shape.
    if (apiHost === 'youtube138.p.rapidapi.com' && /^UC[a-zA-Z0-9_-]{22}$/.test(query)) {
      const { data } = await axios.post<YouTube138SearchResponse>(
        `https://${apiHost}/channel/videos/`,
        {
          id: query,
          filter: 'videos_latest',
          cursor: '',
          hl: 'en',
          gl: 'US',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': apiHost,
          },
          timeout: 12_000,
        },
      );

      return (data.contents ?? [])
        .map(unwrapYouTube138Content)
        .filter((item): item is YouTube138Content => Boolean(item))
        .map(toSearchItem)
        .filter((item): item is YouTubeSearchItem => Boolean(item?.id.videoId));
    }

    const { data } = await axios.get<YouTubeSearchResponse & YouTube138SearchResponse>(
      `https://${apiHost}/search`,
      {
        params: {
          part: 'snippet',
          type: 'video',
          maxResults: '12',
          q: query,
          hl: 'en',
          gl: 'US',
        },
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': apiHost,
        },
        timeout: 12_000,
      },
    );

    if (Array.isArray(data.items)) {
      return data.items.filter((item) => Boolean(item.id.videoId));
    }

    if (Array.isArray(data.contents)) {
      return data.contents
        .map(unwrapYouTube138Content)
        .filter((item): item is YouTube138Content => Boolean(item))
        .map(toSearchItem)
        .filter((item): item is YouTubeSearchItem => Boolean(item?.id.videoId));
    }

    return [];
  },
};
