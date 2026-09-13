/** Shimmering placeholder grid shown while the first photos load. */
export function SkeletonGrid() {
  const heights = [
    [1.25, 0.8, 1.1, 1.3],
    [0.9, 1.3, 0.75, 1.2],
  ];
  return (
    <div className="masonry masonry--skeleton" aria-hidden="true">
      {heights.map((col, i) => (
        <div key={i} className="masonry__col">
          {col.map((r, j) => (
            <div key={j} className="skel" style={{ aspectRatio: `1 / ${r}`, animationDelay: `${(i * 4 + j) * 90}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
