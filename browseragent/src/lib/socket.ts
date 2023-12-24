import { Message, getPrefs, setSocketClosed, setSocketOpen } from "./events";
import { getCount } from "./lib";

let retrierWorking = true;
let socketPending = false;
let conn: Connection | null;

class Connection {
  socket: WebSocket
  public port: number
  public secret: string

  constructor(
    port: number,
    secret: string,
    onOpen: () => void,
    onClose: () => void,
    onError: () => void,
    onMessage: (e: MessageEvent) => void,
  ) {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}/`);
    this.port = port;
    this.secret = secret;

    console.debug("websocket initalised");

    this.socket.onopen = (_e: Event) => {
      console.debug("websocket opened");
      onOpen();
    };

    this.socket.onclose = (_e: CloseEvent) => {
      console.debug("websocket closed");
      onClose();
    };

    this.socket.onerror = (e: Event) => {
      console.error(`socket error: ${e}`);
      onError();
    };

    this.socket.onmessage = onMessage;

    console.debug("websocket configured");
  }

  public send(msg: string) {
    this.socket.send(msg);
  }

  public close() {
    this.socket.close();
  }
}

interface Params {
  port: number,
  secret: string,
}

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
  if (!conn) {
    console.warn("no socket!");
    return;
  }

  const msg = JSON.stringify(payload(count));
  conn.send(msg);
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

export const reconnectIfNecessary = async (params: Params) => {
  if (socketPending) {
    console.debug("socket pending, returning");
    return;
  }

  if (conn && (conn.port === params.port && conn.secret === params.secret)) {
    console.debug("Not reconnecting, same params");
    return;
  }
  const socketFut = initSocketHandler(params);

  if (conn) {
    console.debug("killing existing connection");

    conn.close();
    conn = null;
  }

  await socketFut;
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
      if (conn) {
        resolve(null);
        clearInterval(interval);

        return;
      };

      // A connection attempt hasn't been started/a previous one has failed.
      // Launch off a new asynchronous worker, and kick off another one in 2
      // seconds if this one failed.
      const prefs = getPrefs();
      initSocketHandler(prefs);
    }, 2000);
  });
};

const onClose = () => {
  conn = null;
  socketPending = false;
  setSocketClosed();
};

const onError = () => {
  conn = null;
  socketPending = false;
  setSocketClosed();
};

const onMessage = (e: MessageEvent) => {
  console.debug("received:", e.data);
  getCount((len) => sendCount(len));
};

export const initSocketHandler = async (prefs: Params) => {
  if (socketPending) {
    return;
  }

  socketPending = true;
  const newConn = new Connection(prefs.port, prefs.secret, () => {
    conn = newConn;
    socketPending = false;

    setSocketOpen();
  }, onClose, onError, onMessage);
};
