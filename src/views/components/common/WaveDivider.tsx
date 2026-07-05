/**
 * 시그니처 웨이브 — 브랜드명 'INNOWAVE'를 시각 언어로 옮긴 요소.
 * 히어로 하단과 섹션 전환부에 사용. 색은 토큰의 웨이브 그라디언트를 따른다.
 */
export interface WaveDividerProps {
  flip?: boolean;
}

export function WaveDivider({ flip = false }: WaveDividerProps) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: 'clamp(48px, 8vw, 120px)',
        transform: flip ? 'scaleY(-1)' : 'none',
      }}
    >
      <defs>
        <linearGradient id="iw-wave-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--iw-cyan-300)" />
          <stop offset="55%" stopColor="var(--iw-blue-500)" />
          <stop offset="100%" stopColor="var(--iw-blue-700)" />
        </linearGradient>
      </defs>
      <path
        d="M0,64 C240,110 480,10 720,54 C960,98 1200,20 1440,64 L1440,120 L0,120 Z"
        fill="url(#iw-wave-grad)"
        opacity="0.16"
      />
      <path
        d="M0,80 C240,120 480,30 720,70 C960,110 1200,40 1440,80 L1440,120 L0,120 Z"
        fill="var(--iw-surface)"
      />
    </svg>
  );
}
