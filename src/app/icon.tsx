import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#FF6B00',
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
      }}
    >
      <span
        style={{
          color: 'white',
          fontSize: 20,
          fontWeight: 900,
          fontFamily: 'sans-serif',
          lineHeight: 1,
          letterSpacing: '-1px',
        }}
      >
        𝕏
      </span>
    </div>,
    { ...size }
  )
}
