import Link from "next/link";

export default function Home() {
  return (
    <main className="hero-split">
      {/* Left Side - For Candidates */}
      <section className="hero-side hero-left">
        <div className="hero-content fade-in-up">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            AI-Powered Verification
          </div>

          <h1 className="hero-title">
            Europe is hiring.
            <br />
            <span style={{ opacity: 0.9 }}>
              Get verified by AI and find your dream job.
            </span>
          </h1>

          <p className="hero-subtitle">
            Join thousands of verified candidates who found legal work
            opportunities in Europe. Our AI streamlines your verification
            process, so you can focus on what matters.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>AI-powered document verification</span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>Direct access to verified employers</span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>Full visa process support</span>
            </div>
          </div>

          <Link href="/signup?type=candidate" className="btn btn-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Join as Candidate
          </Link>
        </div>

        {/* Abstract decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            pointerEvents: 'none'
          }}
        />
      </section>

      {/* Right Side - For Employers */}
      <section className="hero-side hero-right">
        <div className="hero-content fade-in-up delay-200">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            100% Automated Process
          </div>

          <h1 className="hero-title">
            Hire global talent
            <br />
            <span style={{ opacity: 0.9 }}>
              without the paperwork.
            </span>
          </h1>

          <p className="hero-subtitle">
            Access a pool of pre-verified international candidates ready to work.
            We handle the entire visa process end-to-end, so you can focus
            on growing your business.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>Pre-verified candidate profiles</span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>Automated visa documentation</span>
            </div>
            <div className="hero-feature">
              <span className="hero-feature-icon">✓</span>
              <span>Compliance-ready hiring</span>
            </div>
          </div>

          <Link href="/signup?type=employer" className="btn btn-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Post a Job Request
          </Link>
        </div>

        {/* Abstract decoration */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '350px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            pointerEvents: 'none'
          }}
        />
      </section>

      {/* Floating Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          Workers United
        </Link>

        <div className="nav-links">
          <Link href="/login" className="nav-link">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-secondary" style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>
            Get Started
          </Link>
        </div>
      </nav>
    </main>
  );
}
