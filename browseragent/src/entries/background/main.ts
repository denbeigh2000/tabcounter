import browser from "webextension-polyfill";

import { initHandlers, decrementCount, incrementCount, setTabCount, getPrefs } from "@tabcounter/lib/events";
import { getCount } from "@tabcounter/lib/lib";
import { initSocketHandler } from "@tabcounter/lib/socket";

browser.runtime.onInstalled.addListener(async () => {
  console.debug("browser runtime initiated");
  await initHandlers();
  const prefs = getPrefs();
  await initSocketHandler(prefs);
  console.debug("websocket handler done");
  getCount(setTabCount);
  setInterval(() => getCount(setTabCount), 60000);
});

browser.tabs.onCreated.addListener(incrementCount);

browser.tabs.onRemoved.addListener(decrementCount);

console.debug("added listeners");
