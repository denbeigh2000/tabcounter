import { sendCount } from "./socket";
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

let privateState: PrivateState;

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
  data: null,
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
  const savedPrefs = await browser.storage.local.get("prefs") as Partial<Preferences>;
  const initPrefs = savedPrefs ? deepmerge({}, defaultPrefs, savedPrefs) : { ...defaultPrefs };
  setState(defaultState);
  setPrefs(initPrefs);

  browser.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.debug(`message listener: type ${message.type}`);
    switch (message.type) {
      case "requestPrefs":
        setTimeout(() => sendResponse(browser.storage.local.get("prefs")));
        return true;
      case "requestState":
        setTimeout(() => sendResponse(browser.storage.local.get("state")));
        return true;
      case "setPort":
        setPort(message.data.port);
        break;
      case "setSecret":
        setSecret(message.data.secret);
        break;
      default:
        console.warn(`unhandled message: ${message}`)
    };
  });
  console.debug("message listener attached");
}

function setState(update: Partial<State>) {
  const state = deepmerge({}, privateState.state, update);
  privateState = { state, ...privateState };
  browser.runtime.sendMessage({
    type: "stateUpdated",
    data: { ...state },
  });
}

function setPrefs(update: Partial<Preferences>) {
  const prefs = deepmerge({}, privateState.prefs, update);
  privateState = { prefs, ...privateState };
  browser.runtime.sendMessage({
    type: "prefsUpdated",
    data: { ...prefs },
  });
  browser.storage.local.set({ prefs });
}

export function decrementCount() {
  setTabCount(privateState.state.openTabs - 1);
}

export function incrementCount() {
  setTabCount(privateState.state.openTabs - 1);
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
