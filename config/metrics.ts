export const UPM = 1000;
export const METRICS = {
  capHeight: 230,
  xHeight: 420,
  baseline: 800,
  descender: 950,
} as const;

// Input-box limits are distinct from cap/x-height/baseline guides. Latin descenders
// and low punctuation retain bottom overshoot room without leaving the em box.
export const SAFETY_PROFILES = {
  hangul: { left: 40, top: 40, right: 960, bottom: 960 },
  latin: { left: 40, top: 40, right: 960, bottom: 990 },
  symbol: { left: 30, top: 10, right: 970, bottom: 990 },
} as const;
