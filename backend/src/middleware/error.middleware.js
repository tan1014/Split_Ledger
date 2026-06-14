export function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
}
