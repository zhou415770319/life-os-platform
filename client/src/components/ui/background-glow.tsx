interface BackgroundGlowProps {
  variant?: 'layout' | 'page' | 'compact';
}

export default function BackgroundGlow({ variant = 'layout' }: BackgroundGlowProps) {
  if (variant === 'compact') {
    return (
      <div className="pointer-events-none fixed top-0 left-0 w-full h-80 -z-10 overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)' }}
        />
        <div
          className="absolute top-10 right-1/4 w-[400px] h-[300px] rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.4), transparent 70%)' }}
        />
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 60%)' }}
        />
        <div
          className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35), transparent 60%)' }}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-glow-pulse"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)' }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl animate-glow-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.4), transparent 70%)',
          animationDelay: '1.5s',
        }}
      />
      <div
        className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl animate-glow-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)',
          animationDelay: '3s',
        }}
      />
    </div>
  );
}
