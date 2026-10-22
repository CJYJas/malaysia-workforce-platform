// Decorative abstract artwork only. Not provider thumbnails, not data.
const PALETTES = [
  ["#F59E2B", "#FBD34D", "#E2553B", "#2F4A8A", "#F6E7CF"],
  ["#2E6FD8", "#F7C948", "#EC6A52", "#1F2A44", "#E9EEF9"],
  ["#E85D75", "#FFB547", "#3BA58C", "#22304A", "#FCEBDD"],
  ["#7A5AF0", "#FFCF5C", "#F0784A", "#1E2638", "#EFEAFB"],
  ["#1E9C8A", "#F6B93B", "#E25B45", "#253046", "#E5F4F1"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CoverArt({ seed, className }: { seed: string; className?: string }) {
  const h = hash(seed);
  const [a, b, c, d, bg] = PALETTES[h % PALETTES.length];
  const r = (n: number) => (h >> n) % 60;
  return (
    <svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <rect width="200" height="90" fill={bg} />
      <path d={`M0 ${50 + (r(2) % 30)} Q ${60 + r(3)} ${r(4) % 20} 200 ${30 + (r(5) % 40)} V90 H0Z`} fill={a} />
      <circle cx={30 + r(6) * 2} cy={25 + (r(7) % 30)} r={18 + (r(8) % 14)} fill={b} />
      <path d={`M${110 + (r(9) % 40)} 0 L200 0 L200 ${40 + (r(10) % 30)}Z`} fill={c} />
      <rect x={r(11) * 2} y={60} width="46" height="10" rx="5" fill={d} opacity=".85" />
    </svg>
  );
}

export function BannerArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bg-g" x1="0" x2="1">
          <stop offset="0" stopColor="#F0663A" />
          <stop offset=".55" stopColor="#F7A531" />
          <stop offset="1" stopColor="#FBD45A" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#bg-g)" />
      <circle cx="690" cy="40" r="120" fill="#FCE38A" opacity=".55" />
      <circle cx="560" cy="230" r="110" fill="#F5873B" opacity=".6" />
      <path d="M0 180 Q 200 120 420 190 T 800 170 V220 H0Z" fill="#E9502F" opacity=".55" />
      <path d="M430 0 L520 0 L470 220 L380 220Z" fill="#FFF3D6" opacity=".22" />
      <rect x="610" y="120" width="140" height="14" rx="7" fill="#2A2F45" opacity=".18" />
      <rect x="650" y="146" width="90" height="14" rx="7" fill="#2A2F45" opacity=".12" />
    </svg>
  );
}
