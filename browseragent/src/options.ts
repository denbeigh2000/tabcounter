import { Message, Preferences, RequestPrefsMessage, SetPrefsMessage } from "./events";

(async () => {
  const form = document.forms[0];
  const elements = {
    port: form.elements.namedItem("port") as HTMLFormElement,
    secret: form.elements.namedItem("secret") as HTMLFormElement,
  };

  console.debug("running stuff");

  // const ready = new Promise<void>(resolve => {
  //   browser.runtime.onInstalled.addListener(() => {
  //     resolve();
  //     console.debug("configuring options listeners");

  //   });
  // });

  console.debug("adding listener");

  browser.runtime.onMessage.addListener((message: Message) => {
    console.debug("message", message);
    if (message.type === "prefsUpdated") {
      elements.port.value = message.data.port;
      elements.secret.value = message.data.secret;
    }
  });

  console.debug("added listener");

  // await ready;
  const msg: RequestPrefsMessage = {
    type: "requestPrefs",
    data: null,
  };

  console.debug("sending prefs request");
  let prefs = await browser.runtime.sendMessage(msg) as Preferences;
  console.debug('prefs:', prefs);

  elements.port.value = prefs.port.toString();
  elements.secret.value = prefs.secret;

  form.addEventListener("submit", (event: SubmitEvent) => {
    console.debug("running submit callback");
    event.preventDefault();
    const data = new FormData(form);
    const port = parseInt(data.get("port").valueOf().toString());
    const secret = data.get("secret").valueOf() as string;

    const msg: SetPrefsMessage = { type: "setPrefs", data: { secret, port } };
    browser.runtime.sendMessage(msg);
  });

  console.debug("bound submit");
})()
