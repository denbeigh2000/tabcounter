/*
 * PLAN:
 * - connect to host websocket
 * - create timer to send heartbeat and update
 * - bind websocket event to send 
 */

interface Payload {
  type: "set_tab_count",
  count: number,
}

const payload = (count: number) => {
  return {
    type: "set_tab_count",
    count,
  };
};

(async () => {
  let lastSeen = 0;
  const defaultPort = 7212;

  const updateCount = (cb: (len: number) => void) => {
    browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
      const len = tabs.length;
      lastSeen = len;
      cb(len);
    });
  };

  const socket = new WebSocket(`ws://127.0.0.1:${defaultPort}/`);
  socket.onopen = (_e: Event) => {
    console.log("socket open");
    updateCount((len) => {
      const msg = JSON.stringify(payload(len));
      socket.send(msg);
    });
  };

  socket.onclose = (_e: CloseEvent) => {
    console.log("socket close");
  };
  socket.onmessage = (e: MessageEvent) => {
    console.log("received:", e.data);
    updateCount((len) => {
      const msg = JSON.stringify(payload(len));
      socket.send(msg);
    });
  };

  socket.onerror = (e: Event) => {
    console.log("error:", e);
  };

  browser.tabs.onCreated.addListener(() => {
    lastSeen = lastSeen + 1;
    const msg = JSON.stringify(payload(lastSeen));
    socket.send(msg);
  });

  browser.tabs.onRemoved.addListener(() => {
    lastSeen = lastSeen - 1;
    const msg = JSON.stringify(payload(lastSeen));
    socket.send(msg);
  });

  setInterval(() => {
    updateCount((len) => {
      const msg = JSON.stringify(payload(len));
      socket.send(msg);
    });
  }, 60000);

  console.log("all bound");
})();
