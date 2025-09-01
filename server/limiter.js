const Bottleneck = require('bottleneck');

const perSec = Number(process.env.IATA_RATE_LIMIT_PER_SEC) || 5;

const limiter = new Bottleneck({
  minTime: Math.ceil(1000 / perSec), // ~N req/sec
  reservoir: 20,                      // burst bucket
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 1000
});

module.exports = { limiter };
