import { Message, Preferences, RequestPrefsMessage, RequestStateMessage, SetPrefsMessage, State } from "@tabcounter/lib/events";


const connected = {
  str: "connected",
  color: "green",
};

const disconnected = {
  str: "not connected",
  color: "red",
};

const show = (el: HTMLElement) => {
  el.hidden = false;
  el.style.display = "";
}

const hide = (el: HTMLElement) => {
  el.hidden = true;
  el.style.display = "none";
}

(async () => {
  const form = document.forms[0];
  const elements = {
    loading: document.getElementById("loading-screen") as HTMLDivElement,
    content: document.getElementById("content") as HTMLDivElement,

    port: form.elements.namedItem("port") as HTMLInputElement,
    secret: form.elements.namedItem("secret") as HTMLInputElement,

    statusLabel: document.getElementById("connected-status") as HTMLSpanElement,
  };

  console.debug("adding listener");

  browser.runtime.onMessage.addListener((message: Message) => {
    console.debug("message", message);
    if (message.type === "prefsUpdated") {
      const { port, secret } = message.data;
      elements.port.value = port.toString();
      elements.secret.value = secret;

      return;
    }

    if (message.type === "stateUpdated") {
      const { str, color } = message.data.socketConnected ? connected : disconnected;
      elements.statusLabel.innerText = str;
      elements.statusLabel.style.color = color;
      return;
    }
  });

  console.debug("added listener");

  const msg: RequestPrefsMessage = {
    type: "requestPrefs",
    data: null,
  };

  console.debug("sending prefs request");
  const prefs = await browser.runtime.sendMessage(msg) as Preferences;
  console.debug('prefs:', prefs);

  const stateMsg: RequestStateMessage = {
    type: "requestState",
    data: null,
  };
  const state = await browser.runtime.sendMessage(stateMsg) as State;

  elements.port.value = prefs.port.toString();
  elements.secret.value = prefs.secret;

  const { str, color } = state.socketConnected ? connected : disconnected;
  elements.statusLabel.style.color = color;
  elements.statusLabel.innerText = str;

  hide(elements.loading);
  show(elements.content);

  form.addEventListener("submit", (event: SubmitEvent) => {
    console.debug("running submit callback");
    event.preventDefault();
    const data = new FormData(form);
    const rawPort = data.get("port");
    const rawSecret = data.get("secret");
    if (!rawPort || !rawSecret) {
      console.log("missing port/secret. port:", rawPort, "secret:", rawSecret);
      return;
    }

    const port = parseInt(rawPort.valueOf().toString());
    const secret = rawSecret.valueOf().toString();

    const msg: SetPrefsMessage = { type: "setPrefs", data: { secret, port } };
    browser.runtime.sendMessage(msg);
  });

  console.debug("bound submit");
})()
