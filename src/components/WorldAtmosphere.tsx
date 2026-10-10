const particles = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`, top: `${(i * 61 + 7) % 100}%`,
  animationDelay: `${-(i * 1.7)}s`, animationDuration: `${14 + (i % 5) * 4}s`,
}));

export default function WorldAtmosphere({ region, still }: { region: string; still: boolean }) {
  const lower = region.toLowerCase();
  const climate = /cinder|ash|kiln/.test(lower) ? "ash" : /moon|coast|salt|beacon|bight/.test(lower) ? "tide" : /star|moor|crater|observatory/.test(lower) ? "stars" : "oldlands";
  return <div aria-hidden="true" className={`world-atmosphere atmosphere-${climate}${still ? " atmosphere-still" : ""}`}>
    <div className="atmosphere-haze" />
    {particles.map((style, i) => <i key={i} style={style} />)}
  </div>;
}
