// src/components/icons/MinimalIcons.tsx
import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

const ACTIVE = '#511619';
const INACTIVE = 'rgba(240,228,193,0.7)';
type Props = { active?: boolean; color?: string };

// One place to tweak thickness for ALL icons
const STROKE = 2; // try 1.8, 2, or 2.2 if you need a hairline adjustment

/* SEARCH — balanced lens + handle, centered */
export function SearchIcon({ active, color }: Props) {
  const c = color ?? (active ? ACTIVE : INACTIVE);
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={5.75} stroke={c} strokeWidth={STROKE} fill="none" />
      <Line x1={15.5} y1={15.5} x2={20} y2={20} stroke={c} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

/* HEART — slim, symmetric, pointed tip; matches visual box of others */
export function HeartIcon({ active, color }: Props) {
  const c = color ?? (active ? ACTIVE : INACTIVE);
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="
          M12 20.5
          L5.3 13.4
          C3.6 11.7 3.8 8.9 5.9 7.6
          C7.5 6.6 9.6 7.1 10.9 8.6
          C11.3 9.0 11.6 9.4 12 9.9
          C12.4 9.4 12.7 9.0 13.1 8.6
          C14.4 7.1 16.5 6.6 18.1 7.6
          C20.2 8.9 20.4 11.7 18.7 13.4
          L12 20.5 Z
        "
        fill="none"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* CHAT — rounded rectangle with integrated tail; same padding as others */
export function ChatIcon({ active, color }: Props) {
  const c = color ?? (active ? ACTIVE : INACTIVE);
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="
          M7 5
          H17
          A4 4 0 0 1 21 9
          V13
          A4 4 0 0 1 17 17
          H12
          L9 20
          V17
          H7
          A4 4 0 0 1 3 13
          V9
          A4 4 0 0 1 7 5
          Z
        "
        fill="none"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
/* PROFILE — optically matched size */
export function ProfileIcon({ active, color }: { active?: boolean; color?: string }) {
  const ACTIVE = '#511619';
  const INACTIVE = 'rgba(240,228,193,0.7)';
  const c = color ?? (active ? ACTIVE : INACTIVE);
  const STROKE = 2; // keep in sync with your other icons

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      {/* Bigger head, same top padding as others (≈1px with stroke) */}
      <Circle cx={12} cy={8} r={4} fill="none" stroke={c} strokeWidth={STROKE} />
      {/* Wider shoulders to fill width like the chat/heart silhouettes */}
      <Path
        d="M4 19c0-3.2 5.3-5.5 8-5.5s8 2.3 8 5.5"
        fill="none"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* Export both ways */
const MinimalIcons = { SearchIcon, HeartIcon, ChatIcon, ProfileIcon };
export default MinimalIcons;
