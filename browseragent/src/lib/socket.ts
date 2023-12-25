import { Message, getPrefs } from "./events";
import { setSocketClosed, setSocketOpen } from "./state";
import { getCount } from "./lib";

import browser from "webextension-polyfill";

/*
 * TODO: Make this more of an official "global state"
 */

const defaultWaitSecs = 1;
// TODO: Move this to preferences
const maxWaitSecs = 30;

interface PrivateState {
  state: "active" | "disconnected" | "pending",
  activeConnection: Connection | null,
  activeRetrier: Retrier | null,
}

const privateState: PrivateState = {
  state: "disconnected",
  activeConnection: null,
  activeRetrier: null,
}

interface RetrierParams {
  port: number,
  secret: string,

  maxWaitSecs: number,

  onStop: () => void,
  shouldTry: () => boolean,
  shouldAbort: () => boolean,
}

class Retrier {
  waitSecs: number;
  maxWaitSecs: number;
  intervalID: number | null;

  onStop: () => void;
  shouldRetry: () => boolean;
  shouldAbort: () => boolean;

  port: number;
  secret: string;

  constructor(params: RetrierParams) {
    this.waitSecs = defaultWaitSecs;
    this.maxWaitSecs = maxWaitSecs;

    this.onStop = params.onStop;
    this.shouldRetry = params.shouldTry;
    this.shouldAbort = params.shouldAbort;

    this.port = params.port;
    this.secret = params.secret;

    this.intervalID = null;
  }

  public started(): boolean {
    return this.intervalID !== null;
  }

  public start() {
    if (this.started()) {
      console.error("retrier already working");
      return;
    }

    this.intervalID = window.setInterval(() => this.run(), this.waitSecs * 1000);
  }

  public stop() {
    this.waitSecs = defaultWaitSecs;
    if (this.started()) {
      return;
    }

    window.clearInterval(this.intervalID!);
    this.intervalID = null;
    this.onStop();
  }

  private run() {
    if (this.shouldAbort()) {
      this.stop();
      return;
    }

    if (!this.shouldRetry()) {
      return;
    }

    const open = (c: Connection) => {
      this.stop();
      window.setTimeout(() => onOpen(c));
    };

    new Connection(this.port, this.secret, open, onClose, onError, onMessage);
  }
}

class Connection {
  socket: WebSocket
  public port: number
  public secret: string

  constructor(
    port: number,
    secret: string,
    onOpen: (conn: Connection) => void,
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
      onOpen(this);
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
  if (!privateState.activeConnection) {
    console.warn("no socket!");
    return;
  }

  const msg = JSON.stringify(payload(count));
  privateState.activeConnection.send(msg);
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

  if (privateState.activeRetrier) {
    startRetrierIfNecessary();
  }
};

const startRetrierIfNecessary = () => {
  const { port, secret } = getPrefs();
  if (!privateState.activeRetrier) {
    const onStop = () => privateState.activeRetrier = null;
    const shouldTry = () => privateState.state !== "active";
    const shouldAbort = () => privateState.state === "active";
    // NOTE: may want subtly different behaviour for state === "pending" vs.
    // "disconnected"
    privateState.activeRetrier = new Retrier({
      port,
      secret,
      maxWaitSecs,
      onStop,
      shouldTry,
      shouldAbort,
    });
    privateState.activeRetrier.start();
  }
}

const onClose = () => {
  privateState.state = "disconnected";
  setSocketClosed();
  startRetrierIfNecessary();
};

const onError = () => {
  // TODO: what error can we actually take here?
  console.error("websocket error occurred");
  onClose();
};

const onMessage = (e: MessageEvent) => {
  console.debug("received:", e.data);
  getCount((len) => sendCount(len));
};

const onOpen = (newConn: Connection) => {
  if (privateState.activeRetrier) {
    privateState.activeRetrier.stop();
  }
  // Potentially redundant, but helpful if the Retrier ends up spawning
  // competing connections.
  privateState.activeConnection = newConn;
  privateState.state = "active";
  setSocketOpen();
};

const onBrowserMessage = (message: Message) => {
  if (message.type !== "prefsUpdated") {
    return;
  }

  const { port, secret } = message.data;
  const { activeConnection, activeRetrier } = privateState;
  const connCurrent = (activeConnection && activeConnection.port === port && activeConnection.secret === secret);
  if (connCurrent) {
    // Abort if we have an existing socket, either pending or active,
    // with the same secret and port.
    return;
  }

  if (activeRetrier) {
    if (activeRetrier.port === port && activeRetrier.secret === secret) {
      // We already have a retrier trying to connect to this port
      return;
    }

    activeRetrier.stop();
  }

  if (activeConnection) {
    activeConnection.close();
    privateState.activeConnection = null;
  }

  privateState.activeConnection = new Connection(port, secret, onOpen, onClose, onError, onMessage);
}

export const initSocketHandler = async (prefs: Params) => {
  if (privateState.state !== "disconnected") {
    return;
  }

  if (privateState.activeConnection !== null) {
    throw "assertion error: state disconnected and connection non-null";
  }

  privateState.state = "pending";
  privateState.activeConnection = new Connection(prefs.port, prefs.secret, onOpen, onClose, onError, onMessage);
  // Ensure we react to changes in socket preferences
  browser.runtime.onMessage.addListener(onBrowserMessage);
};
