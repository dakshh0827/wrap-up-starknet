export default function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // --- STARKNET SPECIFIC ERROR INTERCEPTION ---
  // Catching starknet.js and Cairo specific errors so the frontend gets clear feedback
  if (err.message) {
    if (err.message.includes('ContractNotFound')) {
      statusCode = 404;
      message = 'Starknet Error: Contract not found on the specified network.';
    } else if (err.message.includes('Transaction rejected')) {
      statusCode = 400;
      message = 'Starknet Error: Transaction was rejected by the node.';
    } else if (err.message.includes('LibraryError') || err.message.includes('Execution failed')) {
      statusCode = 400;
      message = 'Starknet Error: Cairo contract execution failed. Check inputs or contract state.';
    } else if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      statusCode = 503;
      message = 'Starknet Error: RPC node is unreachable. Make sure Starknet Devnet is running.';
    }
  }
  // --------------------------------------------
  
  res.status(statusCode).json({ 
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}