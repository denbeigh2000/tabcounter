import { Message, Preferences, sendMessage } from "./events";
import { getCount } from "./lib";

let retrierWorking = true;
let socketPending = false;
let socket: WebSocket;

export interface Payload {
  type: "set_tab_count",
  count: number,
};

export const payload = (count: number): Payload => {
  return {
    type: "set_tab_count",
    count,
  };
};

export const sendCount = (count: number) => {
  if (!socket) {
    console.warn("no socket!");
    return;
  }

  const msg = JSON.stringify(payload(count));
  socket.send(msg);
};

export const socketHandler = async (message: Message) => {
  if (message.type !== "stateUpdated") {
    return;
  }

  if (message.data.socketConnected) {
    const { openTabs } = message.data;
    sendCount(openTabs);

    return;
  }

  if (!retrierWorking) {
    retrierWorking = true;
    await restartSocket();
    retrierWorking = false;
  }
};

const restartSocket = async () => {
  return await new Promise(resolve => {
    // Attempt to restart a socket every 2 seconds
    const interval = setInterval(() => {
      // A socket is currently trying to connect. Don't try to start another,
      // which may get us into fighting callback hell.
      if (socketPending) {
        return;
      }

      // A previously-launched socket was successful. Huzzah!
      if (socket) {
        resolve(null);
        clearInterval(interval);

        return;
      };

      // A connection attempt hasn't been started/a previous one has failed.
      // Launch off a new asynchronous worker, and kick off another one in 2
      // seconds if this one failed.
      initSocketHandler();
    }, 2000);
  });
};

export const initSocketHandler = async () => {
  socketPending = true;
  const prefs = await browser.runtime.sendMessage({ type: "requestPrefs", data: null }) as Preferences;
  const sock = new WebSocket(`ws://127.0.0.1:${prefs.port}/`);

  sock.onopen = (_e: Event) => {
    socket = sock;
    socketPending = false;
    sendMessage({
      type: "socketOpen",
      data: null,
    });
  };

  sock.onclose = (_e: CloseEvent) => {
    console.log("socket close");
    socket = null;
    socketPending = false;
    sendMessage({
      type: "socketClosed",
      data: null,
    });
  };

  sock.onerror = (e: Event) => {
    console.error(`socket error: ${e}`);
    socket = null;
    socketPending = false;
    sendMessage({
      type: "socketClosed",
      data: null,
    });
  };

  sock.onmessage = (e: MessageEvent) => {
    console.log("received:", e.data);
    getCount((len) => sendCount(len));
  };
};
