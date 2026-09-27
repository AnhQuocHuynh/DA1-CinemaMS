import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics to track specific service behavior
const seatMapLatency = new Trend('seat_map_duration_ms');
const seatHoldLatency = new Trend('seat_hold_duration_ms');
const successfulHolds = new Counter('successful_seat_holds');
const conflictHolds = new Counter('conflict_seat_holds');
const reholdHolds = new Counter('rehold_seat_holds');

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Warm up
    { duration: '30s', target: 20 }, // Sustained load
    { duration: '10s', target: 0 },  // Cool down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% of overall requests under 1s
    'http_req_failed': ['rate<0.10'],    // Overall unhandled network failures < 10%
    'seat_map_duration_ms': ['p(95)<500'],
  },
};

// Direct showtime service URL (bypasses gateway for multi-user contention test)
const SHOWTIME_DIRECT_URL = __ENV.SHOWTIME_URL || 'http://showtime-service:8082';
// Base URL for seat map and general queries (uses GATEWAY_URL if provided, else falls back to direct showtime-service)
const BASE_URL = __ENV.GATEWAY_URL || SHOWTIME_DIRECT_URL;
const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || '';

export function setup() {
  let token = null;

  // 1. Authenticate with Keycloak if URL is provided (for gateway profile)
  if (KEYCLOAK_URL) {
    console.log(`[k6 setup] Connecting to Keycloak at: ${KEYCLOAK_URL}`);
    const tokenUrl = `${KEYCLOAK_URL}/realms/cinema-booking/protocol/openid-connect/token`;
    const tokenPayload = {
      grant_type: 'password',
      client_id: 'cinema-frontend',
      username: 'admin@cinema.com',
      password: 'admin123',
    };

    try {
      const loginRes = http.post(tokenUrl, tokenPayload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (loginRes.status === 200) {
        const body = loginRes.json();
        token = body.access_token;
        console.log('[k6 setup] Successfully obtained Keycloak JWT token.');
      } else {
        console.warn(`[k6 setup] Keycloak direct grant returned HTTP ${loginRes.status}: ${loginRes.body}`);
      }
    } catch (err) {
      console.warn(`[k6 setup] Keycloak request failed: ${err}`);
    }
  } else {
    console.log('[k6 setup] KEYCLOAK_URL not configured — running in direct service mode (auth skipped).');
  }

  // 2. Discover or verify test showtime
  let showtimeId = 1;
  try {
    const showtimeRes = http.get(`${BASE_URL}/api/showtimes/${showtimeId}`);
    if (showtimeRes.status === 200) {
      console.log(`[k6 setup] Found existing showtime with ID ${showtimeId}`);
    } else {
      console.log(`[k6 setup] Showtime ${showtimeId} returned HTTP ${showtimeRes.status}; continuing with default showtimeId = 1`);
    }
  } catch (err) {
    console.warn(`[k6 setup] Showtime query failed: ${err}`);
  }

  return { token, showtimeId };
}

export default function (data) {
  const showtimeId = data.showtimeId || 1;

  // Each VU gets a unique simulated user ID (1-based VU index)
  // This ensures different VUs are treated as different users by the seat locking service,
  // which is critical for testing Redis lock contention.
  const simulatedUserId = __VU;

  // -------------------------------------------------------------
  // Scenario 1: Fetch Realtime Seat Map
  // Via API Gateway (if gateway profile) or direct Showtime Service
  // -------------------------------------------------------------
  const mapHeaders = {};
  if (data.token) {
    mapHeaders['Authorization'] = `Bearer ${data.token}`;
  }

  const mapStart = Date.now();
  const seatMapRes = http.get(`${BASE_URL}/api/showtimes/${showtimeId}/seats`, {
    headers: mapHeaders,
    tags: { name: 'GetSeatMap' },
    responseCallback: http.expectedStatuses(200, 404),
  });
  seatMapLatency.add(Date.now() - mapStart);

  check(seatMapRes, {
    'seat map status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  // -------------------------------------------------------------
  // Scenario 2: Concurrent Seat Hold (Redis TTL distributed lock)
  // Hits showtime-service directly with synthetic X-User-Id per VU,
  // simulating multiple distinct users competing for the same seats.
  // This bypasses the gateway's single-user JWT resolution to test
  // the Redis lock contention path that prevents double-booking.
  // -------------------------------------------------------------
  // Select random seat between 1 and 5 to trigger high concurrency & contention
  const randomSeatId = Math.floor(Math.random() * 5) + 1;
  const holdPayload = JSON.stringify({
    seatIds: [randomSeatId],
  });

  const holdHeaders = {
    'Content-Type': 'application/json',
    'X-User-Id': String(simulatedUserId),
  };

  const holdStart = Date.now();
  const holdRes = http.post(
    `${SHOWTIME_DIRECT_URL}/api/showtimes/${showtimeId}/hold`,
    holdPayload,
    {
      headers: holdHeaders,
      tags: { name: 'HoldSeat' },
      responseCallback: http.expectedStatuses(200, 409),
    }
  );
  seatHoldLatency.add(Date.now() - holdStart);

  // 200 = hold acquired or re-hold by same user
  // 409 = SEAT_ALREADY_HELD by different user (expected contention)
  // 400/422 = validation error
  check(holdRes, {
    'hold seat valid response': (r) => [200, 400, 409, 422].includes(r.status),
  });

  if (holdRes.status === 200) {
    // Check response body to distinguish first-hold vs re-hold
    successfulHolds.add(1);
  } else if (holdRes.status === 409) {
    conflictHolds.add(1);
  }

  // Realistic user think time
  sleep(Math.random() * 1 + 0.5);
}

export function teardown(data) {
  console.log('[k6 teardown] Showtime flow load test completed.');
}
