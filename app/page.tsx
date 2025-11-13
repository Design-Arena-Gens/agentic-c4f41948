import PinterestFetcher from './components/PinterestFetcher';

export default function Home() {
  return (
    <main>
      <h1>Pinterest Top Pins Downloader</h1>
      <p className="lead">
        Paste any public Pinterest board link to fetch the most liked and most saved pins. Inspect the
        engagement stats, open pins directly on Pinterest, or download the original images individually or as a
        curated bundle.
      </p>
      <PinterestFetcher />
    </main>
  );
}
