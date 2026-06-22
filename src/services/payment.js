export function createPaymentIntent({ orderId, amount, method = 'VA' }) {
  if (!orderId || !amount) {
    throw new Error('orderId dan amount wajib diisi');
  }

  return {
    provider: 'SIMULATED_PAYMENT_GATEWAY',
    orderId,
    amount,
    method,
    status: method === 'COD' ? 'cod_pending' : 'pending_payment',
    paymentCode: method === 'COD' ? null : `PAY-${Date.now()}`
  };
}

export function verifyPaymentWebhook(payload) {
  return {
    valid: Boolean(payload && payload.orderId && payload.status),
    orderId: payload?.orderId,
    status: payload?.status || 'unknown'
  };
}
