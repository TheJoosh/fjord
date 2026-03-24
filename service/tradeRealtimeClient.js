const listeners = new Set();

let socket = null;
let activeUserName = '';
let reconnectTimer = null;
let shouldReconnect = false;

function notifyListeners(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors to avoid breaking fanout.
    }
  }
}

function clearReconnectTimer() {
  if (!reconnectTimer) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function getSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

function connectSocket() {
  if (!activeUserName) return;

  clearReconnectTimer();

  const nextSocket = new WebSocket(getSocketUrl());
  socket = nextSocket;

  nextSocket.addEventListener('open', () => {
    notifyListeners({ channel: 'trade', type: 'socket_open' });
  });

  nextSocket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(String(event.data || '{}'));
      notifyListeners(parsed);
    } catch {
      // Ignore malformed websocket payloads.
    }
  });

  nextSocket.addEventListener('close', () => {
    if (socket === nextSocket) {
      socket = null;
    }

    if (!shouldReconnect || !activeUserName) {
      return;
    }

    clearReconnectTimer();
    reconnectTimer = window.setTimeout(() => {
      connectSocket();
    }, 1500);
  });

  nextSocket.addEventListener('error', () => {
    // Close event will trigger reconnection when appropriate.
  });
}

function disconnectSocket() {
  clearReconnectTimer();
  if (!socket) return;

  const currentSocket = socket;
  socket = null;

  try {
    currentSocket.close();
  } catch {
    // Ignore close failures.
  }
}

export const tradeRealtimeClient = {
  connect(userName) {
    const normalized = String(userName || '').trim();
    if (!normalized) {
      this.disconnect();
      return;
    }

    if (
      activeUserName === normalized &&
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    activeUserName = normalized;
    shouldReconnect = true;
    disconnectSocket();
    connectSocket();
  },

  disconnect() {
    shouldReconnect = false;
    activeUserName = '';
    disconnectSocket();
  },

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
