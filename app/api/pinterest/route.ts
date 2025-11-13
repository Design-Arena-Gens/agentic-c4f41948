import { NextRequest, NextResponse } from 'next/server';

type RawPin = {
  id: string;
  rich_metadata?: {
    title?: string;
    description?: string;
  };
  note?: string;
  description?: string;
  link?: string;
  dominant_color?: string;
  like_count?: number;
  repin_count?: number;
  images?: {
    [key: string]: {
      url: string;
    };
  };
};

type PinterestResponse = {
  data?: {
    name?: string;
    owner?: {
      username?: string;
    };
    url?: string;
    pins?: RawPin[];
  };
  resource_response?: {
    data?: RawPin[];
    bookmark?: string | null;
  };
  resource?: {
    options?: {
      bookmark?: string | null;
    };
  };
  bookmark?: string | null;
};

type ParsedBoard = {
  username: string;
  board: string;
};

type PinSummary = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pinUrl: string;
  saves: number;
  likes: number;
};

function parseBoard(input: string | null): ParsedBoard {
  if (!input) {
    throw new Error('Missing board parameter. Provide a Pinterest board URL or username/board slug.');
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Pinterest board cannot be empty.');
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length < 2) {
        throw new Error('Pinterest board URL must contain the username and board slug.');
      }
      return {
        username: segments[0],
        board: segments[1]
      };
    }
  } catch (err) {
    throw new Error('Invalid Pinterest URL. Provide a valid board link or username/board combination.');
  }

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Board input should follow username/board format when not using a full URL.');
  }

  return {
    username: parts[0],
    board: parts[1]
  };
}

async function fetchPins(username: string, board: string, limit: number) {
  const collected: RawPin[] = [];
  let bookmark: string | null | undefined;
  let iterations = 0;

  while (collected.length < limit && iterations < 10) {
    const url = new URL(
      `https://widgets.pinterest.com/v3/pidgets/boards/${encodeURIComponent(username)}/${encodeURIComponent(board)}/pins/`
    );
    if (bookmark) {
      url.searchParams.set('bookmark', bookmark);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Pinterest responded with an error. Verify the board is public and try again.');
    }

    const payload = (await response.json()) as PinterestResponse;
    const pinsPayload = payload.data?.pins || payload.resource_response?.data || [];
    if (!Array.isArray(pinsPayload) || pinsPayload.length === 0) {
      break;
    }

    for (const pin of pinsPayload) {
      if (!collected.find((existing) => existing.id === pin.id)) {
        collected.push(pin);
      }
    }

    bookmark = payload.bookmark ?? payload.resource_response?.bookmark ?? payload.resource?.options?.bookmark ?? null;
    if (!bookmark) {
      break;
    }

    iterations += 1;
  }

  return collected.slice(0, limit);
}

function toSummary(pin: RawPin, username: string, board: string): PinSummary | null {
  const baseImage = pin.images?.['orig'] || pin.images?.['736x'] || pin.images?.['474x'] || pin.images?.['170x'];
  if (!baseImage?.url) {
    return null;
  }
  const title = pin.rich_metadata?.title?.trim() || pin.note?.trim() || pin.description?.trim() || '';
  const description = pin.rich_metadata?.description?.trim() || pin.description?.trim() || pin.note?.trim() || '';
  const likes = typeof pin.like_count === 'number' ? pin.like_count : 0;
  const saves = typeof pin.repin_count === 'number' ? pin.repin_count : 0;

  const pinUrl = pin.link?.startsWith('http')
    ? pin.link
    : `https://www.pinterest.com/pin/${pin.id}/?board=${username}/${board}`;

  return {
    id: pin.id,
    title,
    description,
    imageUrl: baseImage.url,
    pinUrl,
    saves,
    likes
  };
}

function sortPins(pins: PinSummary[], sort: string) {
  switch (sort) {
    case 'likes':
      return [...pins].sort((a, b) => b.likes - a.likes);
    case 'saves':
      return [...pins].sort((a, b) => b.saves - a.saves);
    default:
      return [...pins].sort((a, b) => b.likes * 2 + b.saves - (a.likes * 2 + a.saves));
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const board = parseBoard(searchParams.get('board'));
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '12', 10), 1), 48);
    const sort = searchParams.get('sort') || 'combined';

    const pins = await fetchPins(board.username, board.board, limit * 2);
    const summaries = pins
      .map((pin) => toSummary(pin, board.username, board.board))
      .filter((pin): pin is PinSummary => !!pin);

    if (summaries.length === 0) {
      return NextResponse.json(
        { error: 'No pins found. Confirm the board is public and has content.' },
        { status: 404 }
      );
    }

    const sorted = sortPins(summaries, sort).slice(0, limit);

    const payload = {
      board: {
        name: board.board.replace(/-/g, ' '),
        owner: board.username,
        url: `https://www.pinterest.com/${encodeURIComponent(board.username)}/${encodeURIComponent(board.board)}/`
      },
      pins: sorted
    } satisfies {
      board: {
        name: string;
        owner: string;
        url: string;
      };
      pins: PinSummary[];
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to query Pinterest right now.';
    return new NextResponse(message, { status: 400 });
  }
}
