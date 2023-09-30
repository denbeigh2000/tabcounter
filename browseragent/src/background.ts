import { initHandlers, decrementCount, incrementCount, setTabCount, getPrefs } from "./events";
import { getCount } from "./lib";
import { initSocketHandler } from "./socket";

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
