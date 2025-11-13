'use client';

import Image from 'next/image';
import { FormEvent, useMemo, useState } from 'react';

type SortOption = 'likes' | 'saves' | 'combined';

type PinSummary = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pinUrl: string;
  saves: number;
  likes: number;
};

type FetchResponse = {
  board: {
    name: string;
    owner: string;
    url: string;
  };
  pins: PinSummary[];
};

const numberFormatter = new Intl.NumberFormat('en-US');

export default function PinterestFetcher() {
  const [boardInput, setBoardInput] = useState('');
  const [limit, setLimit] = useState(12);
  const [sort, setSort] = useState<SortOption>('combined');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FetchResponse | null>(null);

  const hasPins = result?.pins?.length;
  const boardSlug = useMemo(() => boardInput.trim().replace(/https?:\/\/[^/]+\//, '').replace(/\/+$/, ''), [
    boardInput
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!boardInput.trim()) {
      setError('Enter a Pinterest board URL or username/board pair.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        board: boardInput.trim(),
        limit: String(limit),
        sort
      });
      const response = await fetch(`/api/pinterest?${params.toString()}`);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to fetch pins from Pinterest.');
      }

      const payload = (await response.json()) as FetchResponse;
      setResult(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error fetching pins.';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadAll() {
    if (!result?.pins?.length) {
      return;
    }

    try {
      setLoading(true);
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();

      await Promise.all(
        result.pins.map(async (pin, index) => {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(pin.imageUrl)}`;
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`Failed to download image for pin ${pin.id}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          zip.file(`pin-${index + 1}.jpg`, arrayBuffer);
        })
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const safeSlug = boardSlug || 'pinterest-board';
      saveAs(blob, `${safeSlug.replace(/[^a-z0-9-_]/gi, '_')}-top-${result.pins.length}.zip`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download images.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Board URL or username/board"
          value={boardInput}
          onChange={(event) => setBoardInput(event.target.value)}
        />
        <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
          {[6, 12, 24, 36].map((value) => (
            <option key={value} value={value}>{`Top ${value}`}</option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
          <option value="likes">Most liked</option>
          <option value="saves">Most saved</option>
          <option value="combined">Popularity blend</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Fetching…' : 'Find Pins'}
        </button>
        <button type="button" disabled={!hasPins || loading} onClick={handleDownloadAll}>
          {loading ? 'Working…' : 'Download All'}
        </button>
      </form>

      {error ? <div className="error-banner">{error}</div> : null}
      {loading && !hasPins ? <div className="loading-state">Contacting Pinterest…</div> : null}

      {hasPins ? (
        <section className="results-grid">
          {result?.pins.map((pin) => (
            <article key={pin.id} className="pin-card">
              <Image
                src={pin.imageUrl}
                alt={pin.title || pin.description || 'Pinterest pin'}
                width={500}
                height={750}
                style={{ width: '100%', height: 'auto' }}
              />
              <header>
                <h3>{pin.title || pin.description || 'Untitled Pin'}</h3>
                {pin.description && pin.description !== pin.title ? <p>{pin.description}</p> : null}
              </header>
              <footer>
                <div className="metrics">
                  <span>❤ {numberFormatter.format(pin.likes)}</span>
                  <span>📌 {numberFormatter.format(pin.saves)}</span>
                </div>
                <div className="pin-actions">
                  <a href={pin.pinUrl} target="_blank" rel="noopener noreferrer">
                    View on Pinterest
                  </a>
                  <a href={`/api/proxy?url=${encodeURIComponent(pin.imageUrl)}`} download>
                    Download
                  </a>
                </div>
              </footer>
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
