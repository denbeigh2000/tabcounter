export interface Payload {
  type: "set_tab_count",
  count: number,
}

export const payload = (count: number): Payload => {
  return {
    type: "set_tab_count",
    count,
  };
};

export const sendCount = (socket: WebSocket, count: number) => {
  const msg = JSON.stringify(payload(count));
  socket.send(msg);
};
