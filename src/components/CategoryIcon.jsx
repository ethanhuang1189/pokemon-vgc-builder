import { useState } from 'react';

const ICON_URLS = {
  Physical: 'https://archives.bulbagarden.net/media/upload/a/a8/PhysicalIC.png',
  Special:  'https://archives.bulbagarden.net/media/upload/1/1a/SpecialIC.png',
  Status:   'https://archives.bulbagarden.net/media/upload/5/5d/StatusIC.png',
};

const BG = { Physical: '#C03028', Special: '#6890F0', Status: '#705898' };

const SYMBOL = {
  Physical: (
    <path
      d="M8 1.5 L9.4 6.0 L13.8 4.5 L11.5 8.0 L13.8 11.5 L9.4 10.0 L8 14.5 L6.6 10.0 L2.2 11.5 L4.5 8.0 L2.2 4.5 L6.6 6.0 Z"
      fill="white" fillOpacity="0.92"
    />
  ),
  Special: (
    <path
      d="M8 1 L9 6.8 L15 8 L9 9.2 L8 15 L7 9.2 L1 8 L7 6.8 Z"
      fill="white" fillOpacity="0.92"
    />
  ),
  Status: (
    <>
      <circle cx="8" cy="8" r="4.5" fill="white" fillOpacity="0.88" />
      <circle cx="8" cy="8" r="2" fill={BG.Status} />
    </>
  ),
};

function FallbackIcon({ category, px }) {
  const bg = BG[category];
  if (!bg) return null;
  return (
    <span title={category} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 16 16" width={px} height={px} style={{ imageRendering: 'pixelated', display: 'block' }}>
        <rect x="0" y="0" width="16" height="16" fill={bg} />
        {SYMBOL[category]}
      </svg>
    </span>
  );
}

export default function CategoryIcon({ category, size = 'sm' }) {
  const [failed, setFailed] = useState(false);
  const px = size === 'xs' ? 13 : size === 'md' ? 20 : 16;
  const url = ICON_URLS[category];
  if (!url) return null;
  if (failed) return <FallbackIcon category={category} px={px} />;
  return (
    <img
      src={url}
      alt={category}
      title={category}
      width={px}
      height={px}
      style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}
