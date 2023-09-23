/*
 * PLAN:
 * - connect to host websocket
 * - create timer to send heartbeat and update
 * - bind websocket event to send 
 */

(async () => {
  let lastSeen = 0;

  const getCount = (cb: (len: number) => void) => {
    browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
      const len = tabs.length;
      lastSeen = len;
      cb(len);
    });
  };

  const socket = new WebSocket("ws://localhost:7212/");
  socket.onopen = (_e: Event) => {
    console.log("socket open");
    getCount((len) => {
      socket.send(len.toString());
    });
  };
  socket.onclose = (_e: CloseEvent) => {
    console.log("socket close");
  };
  socket.onmessage = (e: MessageEvent) => {
    console.log("received:", e.data);
    browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
      socket.send(tabs.length.toString());
    });
  };

  socket.onerror = (e: Event) => {
    console.log("error:", e);
  };

  browser.tabs.onCreated.addListener(() => {
    lastSeen = lastSeen + 1;
    socket.send(lastSeen.toString());
  });

  browser.tabs.onRemoved.addListener(() => {
    lastSeen = lastSeen - 1;
    socket.send(lastSeen.toString());
  });

  setInterval(() => {
    browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
      lastSeen = tabs.length;
      socket.send(tabs.length.toString());
    });
  }, 60000);

  console.log("all bound");
})();
