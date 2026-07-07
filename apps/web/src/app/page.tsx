const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

function SoundWave() {
  const bars = [4, 8, 14, 22, 30, 38, 44, 48, 50, 48, 44, 50, 46, 38, 30, 22, 14, 10, 6];
  return (
    <svg width="160" height="56" viewBox="0 0 160 56" fill="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={4 + i * 8}
          y={(56 - h) / 2}
          width="4"
          rx="2"
          height={h}
          fill="white"
          opacity={0.9}
        />
      ))}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-gradient-to-br from-accent via-[#C74A8A] to-primary px-6 py-16">
      <div />

      <div className="flex flex-col items-center gap-6">
        <SoundWave />
        <h1 className="text-4xl font-bold tracking-tight text-white">DeepFuse</h1>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <a
          href={`${API_URL}/auth/login`}
          className="block rounded-full bg-accent py-4 text-center text-lg font-semibold text-white shadow-lg transition hover:shadow-xl"
        >
          Sign up
        </a>
        <a
          href={`${API_URL}/auth/login`}
          className="block rounded-full bg-white py-4 text-center text-lg font-semibold text-accent transition hover:bg-gray-50"
        >
          Log in
        </a>
      </div>
    </div>
  );
}
