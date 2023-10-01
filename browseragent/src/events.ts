import { reconnectIfNecessary, sendCount } from "./socket";
import { deepmerge } from "deepmerge-ts";

interface PrivateState {
  state: State,
  prefs: Preferences,
}

const defaultState = {
  openTabs: 0,
  socketConnected: false,
};

const defaultPrefs = {
  port: 7212,
  secret: "",
};

let privateState: PrivateState = {
  state: defaultState,
  prefs: defaultPrefs,
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
  data: null,
}

export interface SetPrefsMessage extends BaseMessage {
  type: "setPrefs",
  data: {
    secret: string,
    port: number
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
  data: null,
}

export type Message =
  RequestPrefsMessage
  | RequestStateMessage
  | SetPrefsMessage
  | StateUpdatedMessage
  | PrefsUpdatedMessage
  | TabCountChangeMessage
  | SocketOpenMessage
  | SocketClosedMessage;

export function getPrefs(): Preferences {
  return { ...privateState.prefs };
}

export function getState(): State {
  return { ...privateState.state };
}

export function setSocketOpen() {
  setSocketState(true);
}

export function setSocketClosed() {
  setSocketState(false);
}

export async function initHandlers() {
  console.debug("fetching preferences");
  const savedPrefs = (await browser.storage.local.get("prefs")).prefs as Partial<Preferences>;
  console.debug("preferences:", savedPrefs);
  const initPrefs = savedPrefs ? deepmerge({}, defaultPrefs, savedPrefs) : { ...defaultPrefs };
  setState(defaultState);
  setPrefs(initPrefs);

  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.debug(`message listener: type ${message.type}`);
    switch (message.type) {
      case "requestPrefs":
        setTimeout(() => sendResponse(privateState.prefs));
        return true;
      case "requestState":
        setTimeout(() => sendResponse(privateState.state));
        return true;
      case "setPrefs":
        setPrefs(message.data);
        break;
      default:
        console.warn(`unhandled message: ${message}`)
    };
  });
  console.debug("message listener attached");
}

function setState(update: Partial<State>) {
  const state = deepmerge({}, privateState.state, update) as State;
  privateState.state = state;
  browser.runtime.sendMessage({
    type: "stateUpdated",
    data: { ...state },
  })
    .catch(e => console.warn(`sending message failed: ${e}`));
}

function setPrefs(update: Partial<Preferences>) {
  const prefs = deepmerge({}, privateState.prefs, update) as Preferences;
  privateState.prefs = prefs;
  console.debug("set privateState:", privateState);
  browser.runtime.sendMessage({
    type: "prefsUpdated",
    data: { ...prefs },
  })
    .catch(e => console.warn(`sending message failed: ${e}`));
  browser.storage.local.set({ prefs });
  console.debug("kicked off browser storage write");

  reconnectIfNecessary(prefs);
}

export const decrementCount = () => {
  const state = getState();
  setTabCount(state.openTabs - 1);
}

export const incrementCount = () => {
  const state = getState();
  setTabCount(state.openTabs + 1);
}

export function setTabCount(count: number) {
  setState({ openTabs: count });
  sendCount(count);
}

function setSocketState(connected: boolean) {
  setState({ socketConnected: connected });
}

export function setPort(port: number) {
  setPrefs({ port });
}

export function setSecret(secret: string) {
  setPrefs({ secret });
}
