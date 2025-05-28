import type { SVGProps } from 'react';

export function BloomingFlowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5z" />
      <path d="M12 5C7.5 5 5 7.5 5 12s2.5 7 7 7 7-2.5 7-7-2.5-7-7-7z" />
      <path d="M12 10v10" />
      <path d="m8.24 8.24-.71-.71" />
      <path d="M5 12H2" />
      <path d="m8.24 15.76-.71.71" />
      <path d="M12 19v3" />
      <path d="m15.76 15.76.71.71" />
      <path d="M19 12h3" />
      <path d="m15.76 8.24.71-.71" />
      {/* Petals - can be animated */}
      <path d="M12 5c-1.52 0-2.86.73-3.71 1.89A4.99 4.99 0 0 0 5 12c0 1.52.73 2.86 1.89 3.71A4.99 4.99 0 0 0 12 19" opacity="0.7" />
      <path d="M12 5c1.52 0 2.86.73 3.71 1.89A4.99 4.99 0 0 1 19 12c0 1.52-.73 2.86-1.89 3.71A4.99 4.99 0 0 1 12 19" opacity="0.7" />
    </svg>
  );
}
