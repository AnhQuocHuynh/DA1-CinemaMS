import { execSync } from 'child_process';

async function benchmark() {
  console.log('================================================================');
  console.log('  BENCHMARK: First Read (Cold Cache / DB) vs Cached Read (Redis)');
  console.log('================================================================\n');

  // 1. Authenticate with Keycloak
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: 'cinema-frontend',
    username: 'admin@cinema.com',
    password: 'admin123',
  });

  const tRes = await fetch('http://localhost:8080/realms/cinema-booking/protocol/openid-connect/token', {
    method: 'POST',
    body: params,
  });
  const tData = await tRes.json();
  const token = tData.access_token;

  if (!token) {
    console.error('Failed to get token:', tData);
    return;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 1: API Gateway User ID Resolution (Redis Cache)
  // Cold: Cache Miss -> HTTP to IdentityService -> DB Query -> Cache Write
  // Warm: Cache Hit directly from Redis memory -> Skip IdentityService & DB
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Gateway User Resolution Cache (user-resolve:<UUID>) ---');

  // Flush Redis cache in lt-redis to ensure clean cold state
  execSync('docker exec lt-redis redis-cli FLUSHALL');
  console.log('[Flushed lt-redis cache to guarantee cold cache]');

  // First Call (Cold)
  const coldStart = performance.now();
  const res1 = await fetch('http://localhost:5000/api/showtimes/1/hold', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatIds: [1] }),
  });
  const coldDuration = (performance.now() - coldStart).toFixed(2);
  console.log('1st Request (COLD - DB query + Inter-service HTTP): ' + coldDuration + ' ms (Status: ' + res1.status + ')');

  // Warm Calls (Cache Hits)
  const warmDurations = [];
  for (let i = 2; i <= 6; i++) {
    const start = performance.now();
    const res = await fetch('http://localhost:5000/api/showtimes/1/hold', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatIds: [1] }),
    });
    const dur = performance.now() - start;
    warmDurations.push(dur);
    console.log(i + 'th Request (WARM - Redis In-Memory Hit)          : ' + dur.toFixed(2) + ' ms (Status: ' + res.status + ')');
  }

  const avgWarm = (warmDurations.reduce((a, b) => a + b, 0) / warmDurations.length).toFixed(2);
  const ratio = (coldDuration / avgWarm).toFixed(1);

  console.log('\n---------------- SUMMARY ----------------');
  console.log('Cold Read (DB & Network) : ' + coldDuration + ' ms');
  console.log('Cached Read (Redis Hit)  : ' + avgWarm + ' ms (avg)');
  console.log('Speed Improvement        : ' + ratio + 'x FASTER with cache');
  console.log('Latency Reduction        : -' + ((1 - avgWarm / coldDuration) * 100).toFixed(1) + '%\n');

  // --------------------------------------------------------------------------
  // SCENARIO 2: Showtime Seats Retrieval (Spring Boot + Postgres DB vs Internal Buffer)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Showtime Seat Map Query (First vs Subsequent Reads) ---');
  const showtimeColdStart = performance.now();
  const sRes1 = await fetch('http://localhost:5000/api/showtimes/1/seats');
  const showtimeCold = (performance.now() - showtimeColdStart).toFixed(2);
  console.log('1st Query (Cold - Full DB scan + JPA hydration)   : ' + showtimeCold + ' ms (Status: ' + sRes1.status + ')');

  const sWarmList = [];
  for (let i = 2; i <= 6; i++) {
    const start = performance.now();
    const res = await fetch('http://localhost:5000/api/showtimes/1/seats');
    const dur = performance.now() - start;
    sWarmList.push(dur);
    console.log(i + 'th Query (Warm - DB Buffer Pool / Memory Hit)     : ' + dur.toFixed(2) + ' ms (Status: ' + res.status + ')');
  }
  const avgSWarm = (sWarmList.reduce((a, b) => a + b, 0) / sWarmList.length).toFixed(2);
  const sRatio = (showtimeCold / avgSWarm).toFixed(1);

  console.log('\n---------------- SUMMARY ----------------');
  console.log('Cold Query (Initial Load): ' + showtimeCold + ' ms');
  console.log('Warm Query (Memory Pool) : ' + avgSWarm + ' ms (avg)');
  console.log('Speed Improvement        : ' + sRatio + 'x FASTER\n');
}

benchmark().catch(console.error);
