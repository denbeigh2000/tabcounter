import { sendCount } from "./socket";
interface PrivateState {
  state: State,
  prefs: Preferences,
}

let state: PrivateState = {
  state: {
    openTabs: 0,
    socketConnected: false,
  },
  prefs: {
    // TODO: Persist these in localstorage or something?
    port: 7212,
    secret: "",
  },
};

export interface Preferences {
  port: number,
  secret: string,
}

export interface State {
  openTabs: number
  socketConnected: boolean,
}

interface BaseMessage {
  type: string,
  data: any,
}

export interface RequestPrefsMessage extends BaseMessage {
  type: "requestPrefs",
  data: null,
}

export interface RequestStateMessage extends BaseMessage {
  type: "requestState",
}

export interface SetSecretMessage extends BaseMessage {
  type: "setSecret",
  data: {
    secret: string
  }
}

export interface SetPortMessage extends BaseMessage {
  type: "setPort",
  data: {
    port: number,
  }
}

export interface StateUpdatedMessage extends BaseMessage {
  type: "stateUpdated",
  data: State,
}

export interface PrefsUpdatedMessage extends BaseMessage {
  type: "prefsUpdated",
  data: Preferences,
}

export interface TabCountChangeMessage extends BaseMessage {
  type: "setTabCount",
  data: {
    count: number,
  }
}

export interface SocketOpenMessage extends BaseMessage {
  type: "socketOpen",
  data: null,
}

export interface SocketClosedMessage extends BaseMessage {
  type: "socketClosed",
}

export type Message =
  RequestPrefsMessage
  | RequestStateMessage
  | SetSecretMessage
  | SetPortMessage
  | StateUpdatedMessage
  | PrefsUpdatedMessage
  | TabCountChangeMessage
  | SocketOpenMessage
  | SocketClosedMessage;

export async function sendMessage(msg: Message) {
  return await browser.runtime.sendMessage(msg);
}

export function initHandlers() {
  browser.runtime.onMessage.addListener(async (message: Message) => {
    switch (message.type) {
      case "requestPrefs":
        return Object.assign({}, state.prefs);
      case "requestState":
        return Object.assign({}, state.state);
      case "setPort":
        setPort(message.data.port);
        break;
      case "setSecret":
        setSecret(message.data.secret);
        break;
      case "setTabCount":
        setTabCount(message.data.count);
        break;
      case "socketOpen":
        setSocketState(true);
        break;
      case "socketClosed":
        setSocketState(false);
        break;
      case "prefsUpdated":
      case "stateUpdated":
        break;
      default:
        console.warn(`unhandled message: ${message}`)
    };
  });
}

export function decrementCount() {
  setTabCount(state.state.openTabs - 1);
}

export function incrementCount() {
  setTabCount(state.state.openTabs - 1);
}

export function setTabCount(count: number) {
  state.state.openTabs = count;
  sendMessage({
    type: "stateUpdated",
    data: Object.assign({}, state.state),
  });
  sendCount(count);
}

export function setSocketState(connected: boolean) {
  state.state.socketConnected = connected;
  sendMessage({
    type: "stateUpdated",
    data: Object.assign({}, state.state),
  });
}

export function setPort(port: number) {
  // TODO: This needs to also make the main background loop
  // disconnect/reconnect. Maybe the main loop should be primarily driven by
  // the browser's message passing?
  state.prefs.port = port;
  sendMessage({
    type: "prefsUpdated",
    data: Object.assign({}, state.prefs),
  });
}

export function setSecret(secret: string) {
  state.prefs.secret = secret;
  sendMessage({
    type: "prefsUpdated",
    data: Object.assign({}, state.prefs),
  });
}
