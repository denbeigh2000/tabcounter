import { initHandlers, decrementCount, incrementCount, sendMessage } from "./events";
import { getCount } from "./lib";
import { initSocketHandler } from "./socket";

(async () => {
  initHandlers();
  await initSocketHandler();
  browser.tabs.onCreated.addListener(incrementCount);
  browser.tabs.onRemoved.addListener(decrementCount);

  setInterval(() => {
    getCount((len) => sendMessage({ type: "setTabCount", data: { count: len } }));
  }, 60000);
})();
