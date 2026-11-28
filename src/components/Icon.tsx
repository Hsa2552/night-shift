const paths = {
  sun: 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7m-10 10-1.4 1.4m0-12.8L7 7m10 10 1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20.9 13.4A9 9 0 0 1 10.6 3.1a9 9 0 1 0 10.3 10.3Z',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  lock: 'M6 11h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Zm2 0V8a4 4 0 0 1 8 0v3m-4 4v1',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'eye-off':
    'm3 3 18 18M10 6.2a12 12 0 0 1 2-.2c6.5 0 10 6 10 6a18 18 0 0 1-2.4 3M6.5 7.5A18 18 0 0 0 2 12s3.5 6 10 6a11 11 0 0 0 4-.7M10 10a3 3 0 0 0 4 4',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  sliders: 'M5 4v16m7-16v16m7-16v16M2 9h6m1 6h6m1-7h6',
  pages: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 0v14',
  minus: 'M5 12h14',
  plus: 'M5 12h14m-7-7v14',
  fit: 'M8 4H4v16h4m8-16h4v16h-4M7 12h10m-7-3-3 3 3 3m4-6 3 3-3 3',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  alert: 'M12 8v4m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
} as const

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  )
}
