import { initHandlers, decrementCount, incrementCount, setTabCount } from "./events";
import { getCount } from "./lib";
import { initSocketHandler } from "./socket";

(async () => {
  browser.runtime.onInstalled.addListener(async () => {
    console.debug("browser runtime initiated");
    await initHandlers();
    await initSocketHandler();
    console.debug("websocket handler done");
    getCount(setTabCount);
    setInterval(() => getCount(setTabCount), 60000);
  });
  browser.tabs.onCreated.addListener(incrementCount);
  browser.tabs.onRemoved.addListener(decrementCount);
  console.debug("added listeners");
})();
