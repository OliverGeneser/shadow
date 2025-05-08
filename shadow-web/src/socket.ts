let scheme = "wss";

if (window.location.protocol === "https:") {
  scheme += "s";
}

export const serverUrl = scheme + "://" + import.meta.env.VITE_WEBSOCKET_URL;
console.log(serverUrl);
