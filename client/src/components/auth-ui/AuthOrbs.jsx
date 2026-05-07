export default function AuthOrbs() {
  return (
    <>
      <div
        className="auth-orb auth-orb-a"
        style={{
          top: '-5%',
          left: '-5%',
          width: '560px',
          height: '560px',
          background: 'rgb(var(--auth-orb-1) / 0.95)',
        }}
      />
      <div
        className="auth-orb auth-orb-b"
        style={{
          bottom: '-8%',
          right: '-8%',
          width: '640px',
          height: '640px',
          background: 'rgb(var(--auth-orb-2) / 0.85)',
        }}
      />
      <div
        className="auth-orb auth-orb-c"
        style={{
          top: '35%',
          right: '20%',
          width: '440px',
          height: '440px',
          background: 'rgb(var(--auth-orb-3) / 0.7)',
        }}
      />
    </>
  )
}
