/*
 * PLAN:
 * - connect to host websocket
 * - create timer to send heartbeat and update
 * - bind websocket event to send 
 */

import { decrementCount, getCount, incrementCount, updateCount } from "./lib";
import { sendCount } from "./socket";

(async () => {
  const defaultPort = 7212;

  const socket = new WebSocket(`ws://127.0.0.1:${defaultPort}/`);
  socket.onopen = (_e: Event) => {
    console.log("socket open");
    updateCount((len) => sendCount(socket, len));
  };

  socket.onclose = (_e: CloseEvent) => {
    console.log("socket close");
  };
  socket.onmessage = (e: MessageEvent) => {
    console.log("received:", e.data);
    updateCount((len) => sendCount(socket, len));
  };

  socket.onerror = (e: Event) => {
    console.log("error:", e);
  };

  browser.tabs.onCreated.addListener(() => {
    incrementCount();
    sendCount(socket, getCount());
  });

  browser.tabs.onRemoved.addListener(() => {
    decrementCount();
    sendCount(socket, getCount());
  });

  setInterval(() => {
    updateCount((len) => sendCount(socket, len));
  }, 60000);

  console.log("all bound");
})();
