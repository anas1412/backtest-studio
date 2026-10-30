// Server-sent events hub: every open page gets every event.
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const enc = new TextEncoder();

export function broadcast(type: string, data: unknown) {
  const msg = enc.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  for (const c of clients) {
    try { c.enqueue(msg); } catch { clients.delete(c); }
  }
}

export function subscribe(initial: [string, unknown][]): Response {
  let ctl: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctl = c;
      clients.add(c);
      for (const [t, d] of initial) c.enqueue(enc.encode(`event: ${t}\ndata: ${JSON.stringify(d)}\n\n`));
    },
    cancel() { clients.delete(ctl); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
