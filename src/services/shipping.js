export function calculateShippingRate({ originCity, destinationCity, weightGram, courier = 'REG' }) {
  if (!originCity || !destinationCity) {
    throw new Error('originCity dan destinationCity wajib diisi');
  }

  const weightKg = Math.max(1, Math.ceil(Number(weightGram || 0) / 1000));
  const baseRate = courier === 'COD' ? 18000 : 14000;
  const cost = baseRate + (weightKg - 1) * 6000;

  return {
    provider: 'SIMULATED_SHIPPING_PROVIDER',
    courier,
    originCity,
    destinationCity,
    weightGram,
    cost,
    etd: courier === 'COD' ? '2-5 hari' : '1-3 hari'
  };
}

export function createShipment({ orderId, cod = false }) {
  return {
    provider: 'SIMULATED_SHIPPING_PROVIDER',
    orderId,
    cod,
    awb: `SIM-${Date.now()}`,
    status: 'created'
  };
}
