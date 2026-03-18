function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ background: '#0D0B1A', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
          {statusCode || 'Error'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem' }}>
          {statusCode === 404 ? 'Page not found' : 'An error occurred'}
        </p>
        <a href="/dashboard" style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          borderRadius: '1rem',
          color: 'white',
          background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)',
          textDecoration: 'none',
        }}>
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: { res?: { statusCode?: number }; err?: { statusCode?: number } }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
