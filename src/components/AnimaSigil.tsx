/** Nine vessels around a broken spire. Kept as geometry so it stays crisp. */
export default function AnimaSigil({ lit = 9, className = "" }: { lit?: number; className?: string }) {
  return <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className={className}>
    <circle cx="100" cy="100" r="77" stroke="currentColor" strokeOpacity=".2" />
    <circle cx="100" cy="100" r="61" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 8" />
    <path d="M100 45 81 125 99 116 119 139 110 91 100 100 105 74Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity=".06" />
    <path d="m77 152 46-97M86 100h32M100 25v14M100 160v15" stroke="currentColor" strokeOpacity=".35" />
    {Array.from({ length: 9 }, (_, index) => {
      const angle = (index / 9) * Math.PI * 2 - Math.PI / 2;
      const x = 100 + Math.cos(angle) * 77;
      const y = 100 + Math.sin(angle) * 77;
      return <g key={index} opacity={index < lit ? 1 : .2}>
        <path d={`M100 100 ${x} ${y}`} stroke="currentColor" strokeOpacity=".08" />
        <path d={`M${x} ${y - 5}l3.5 5-3.5 5-3.5-5Z`} stroke="currentColor" fill="currentColor" fillOpacity={index < lit ? ".65" : "0"} />
      </g>;
    })}
  </svg>;
}
