import { beforeEach, describe, expect, it, vi } from 'vitest';
import keycloak from '../../lib/keycloak';
import {
  CHAT_API_URL,
  ChatStreamEventPayload,
  createSession,
  deleteSession,
  getSessionDetail,
  listSessions,
  renameSession,
  resolveChatApiUrl,
  sendChatMessage,
  streamChatMessage,
} from '../chatbotApi';

vi.mock('../../lib/keycloak', () => ({
  default: {
    authenticated: false,
    token: undefined as string | undefined,
    updateToken: vi.fn().mockResolvedValue(true),
    logout: vi.fn(),
  },
}));

describe('chatbotApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keycloak.authenticated = false;
    keycloak.token = undefined;
  });

  it('resolves /api/chat URL from VITE_CHATBOT_URL or VITE_API_BASE_URL', () => {
    expect(resolveChatApiUrl('', 'http://localhost:5000/api')).toBe(
      'http://localhost:5000/api/chat',
    );
    expect(resolveChatApiUrl('http://localhost:5005/', 'http://localhost:5000/api')).toBe(
      'http://localhost:5005/api/chat',
    );
    expect(resolveChatApiUrl('http://localhost:5005/api/chat/', '')).toBe(
      'http://localhost:5005/api/chat',
    );
  });

  it('calls session CRUD and renameSession endpoints with guest token or Keycloak JWT', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 's-1', title: 'My Chat' }]), { status: 200 }),
    );
    const sessions = await listSessions();
    expect(sessions).toEqual([{ id: 's-1', title: 'My Chat' }]);
    expect(fetchMock.mock.calls[0][0]).toBe(`${CHAT_API_URL}/sessions`);
    const guestHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(guestHeaders['X-Session-Token']).toBeTruthy();
    expect(guestHeaders.Authorization).toBeUndefined();

    keycloak.authenticated = true;
    keycloak.token = 'kc-jwt-token';

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 's-2', title: 'Dune Chat' }), { status: 200 }),
    );
    const created = await createSession('Dune Chat');
    expect(created.id).toBe('s-2');
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer kc-jwt-token');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 's-2', title: 'Renamed Chat' }), { status: 200 }),
    );
    const renamed = await renameSession('s-2', 'Renamed Chat');
    expect(renamed.title).toBe('Renamed Chat');
    expect(fetchMock.mock.calls[2][0]).toBe(`${CHAT_API_URL}/sessions/s-2`);
    expect(fetchMock.mock.calls[2][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ title: 'Renamed Chat' }));

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 's-2',
          title: 'Renamed Chat',
          messages: [{ id: 1, role: 'user', content: 'Hi' }],
        }),
        { status: 200 },
      ),
    );
    const detail = await getSessionDetail('s-2');
    expect(detail.messages).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 's-2',
          reply: 'Hello!',
          cached: false,
          suggestedFollowUps: [],
          sources: [],
        }),
        { status: 200 },
      ),
    );
    const syncReply = await sendChatMessage('Hello', 's-2');
    expect(syncReply.reply).toBe('Hello!');
    expect(fetchMock.mock.calls[4][0]).toBe(`${CHAT_API_URL}/message`);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteSession('s-2');
    expect(fetchMock.mock.calls[5][0]).toBe(`${CHAT_API_URL}/sessions/s-2`);
    expect(fetchMock.mock.calls[5][1].method).toBe('DELETE');
  });

  it('parses SSE chunks, sources, and answer-guard replacement events', async () => {
    const encoder = new TextEncoder();
    const sseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk":"Watch ","done":false}\n\n'));
        controller.enqueue(encoder.encode('data: {"chunk":"Dune","done":false}\n'));
        controller.enqueue(
          encoder.encode(
            '\ndata: {"chunk":"","done":true,"cached":false,"sessionId":"s-9","sources":[{"type":"movie","id":1,"title":"Dune","snippet":"Epic","similarity":0.92}]}\n\n',
          ),
        );
        controller.close();
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(sseBody, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"chunk":"Bad movie","done":false}\n\n' +
                    'data: {"chunk":"","done":true,"cached":false,"sessionId":"s-9","sources":[],"replacement":"Refusal message"}\n\n',
                ),
              );
              controller.close();
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const events1: ChatStreamEventPayload[] = [];
    await streamChatMessage('s-9', 'Tell me about Dune', (ev) => events1.push(ev));
    expect(events1).toHaveLength(3);
    expect(events1[0].chunk).toBe('Watch ');
    expect(events1[1].chunk).toBe('Dune');
    expect(events1[2].done).toBe(true);
    expect(events1[2].sources?.[0].title).toBe('Dune');

    const events2: ChatStreamEventPayload[] = [];
    await streamChatMessage('s-9', 'Any other movie?', (ev) => events2.push(ev));
    expect(events2[1].done).toBe(true);
    expect(events2[1].sources).toEqual([]);
    expect(events2[1].replacement).toBe('Refusal message');
  });

  it('streams stateless guest FAQ responses with sessionId: null', async () => {
    const encoder = new TextEncoder();
    const sseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"chunk":"Standard tickets can be cancelled up to 60 minutes before showtime.","done":false}\n\n' +
              'data: {"chunk":"","done":true,"cached":false,"sessionId":null,"sources":[{"type":"faq","id":1,"title":"Refund policy","snippet":"60 minutes","similarity":0.96}]}\n\n',
          ),
        );
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(sseBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const events: ChatStreamEventPayload[] = [];
    await streamChatMessage(null, 'What is the refund policy?', (ev) => events.push(ev));
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ sessionId: null, message: 'What is the refund policy?' }),
    );
    expect(events).toHaveLength(2);
    expect(events[1].done).toBe(true);
    expect(events[1].sessionId).toBeNull();
    expect(events[1].sources?.[0].type).toBe('faq');
  });

  it('includes language in request body when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sessionId: 's-2',
          reply: 'Xin chào!',
          cached: false,
          suggestedFollowUps: [],
          sources: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendChatMessage('Hello', 's-2', 'vi');
    expect(res.reply).toBe('Xin chào!');
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ sessionId: 's-2', message: 'Hello', language: 'vi' }),
    );
  });

  it('aborts streamChatMessage cleanly when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    const cancelSpy = vi.fn().mockResolvedValue(undefined);
    const readerMock = {
      read: vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves unless cancelled/aborted
          }),
      ),
      cancel: cancelSpy,
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => readerMock,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const streamPromise = streamChatMessage('s-1', 'Hi', vi.fn(), 'en', controller.signal);
    controller.abort();

    await expect(streamPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
