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

export interface State {
  openTabs: number
  socketConnected: boolean,
}

export interface Preferences {
  port: number,
  secret: string,
}

export function setState(update: Partial<State>) {
  const state = deepmerge({}, privateState.state, update) as State;
  privateState.state = state;
  browser.runtime.sendMessage({
    type: "stateUpdated",
    data: { ...state },
  })
    .catch(e => console.warn(`sending message failed: ${e}`));
}

export function setPrefs(update: Partial<Preferences>) {
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

  // TODO: We need to listen for prefsUpdated events in our socket handler now
  // reconnectIfNecessary(prefs);
}

export function setPort(port: number) {
  setPrefs({ port });
}

export function setSecret(secret: string) {
  setPrefs({ secret });
}

export function getPrefs(): Preferences {
  return { ...privateState.prefs };
}

export function getState(): State {
  return { ...privateState.state };
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
}

export function setSocketState(connected: boolean) {
  setState({ socketConnected: connected });
}

export function setSocketOpen() {
  setSocketState(true);
}

export function setSocketClosed() {
  setSocketState(false);
}
