import React from 'react';

const base: React.SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const HomeIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg {...base} {...props}>
    <path d="M3 11 12 3l9 8M5 10v10h14V10" />
  </svg>
);

export const ChartIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg {...base} {...props}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);

export const ChatIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg {...base} {...props}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
  </svg>
);

export const UserIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg {...base} {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const BellIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg {...base} {...props}>
    <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2ZM10 21h4" />
  </svg>
);
