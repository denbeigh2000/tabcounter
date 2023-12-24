let lastSeen = 0;

export const updateCount = (cb: (len: number) => void) => {
  browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
    const len = tabs.length;
    lastSeen = len;
    cb(len);
  });
};

export const getCount = (cb: (len: number) => void) => {
  browser.tabs.query({}).then((tabs: Array<browser.tabs.Tab>) => {
    cb(tabs.length);
  });
};

export const decrementCount = () => {
  lastSeen = lastSeen - 1;
};

export const incrementCount = () => {
  lastSeen = lastSeen - 1;
};
