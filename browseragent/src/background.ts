/*
 * PLAN:
 * - connect to host websocket
 * - create timer to send heartbeat and update
 * - bind websocket event to send 
 */

(async () => {
  const socket = new WebSocket("ws://localhost:7212/");
  socket.onopen = (_e: Event) => {
    console.log("socket open");
  };
  socket.onclose = (_e: CloseEvent) => {
    console.log("socket close");
  };
  socket.onmessage = (e: MessageEvent) => {
    console.log("received:", e.data);
    // TODO: Ensure the event 
    browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
      socket.send(tabs.length.toString());
    });
  };
  socket.onerror = (e: Event) => {
    console.log("error:", e);
  };

  console.log("all bound");
})();
