let scheme = "ws";

if (window.location.protocol === "https:") {
  scheme += "s";
}

export const serverUrl =
  scheme +
  "://" +
  window.location.hostname +
  ":" +
  "3005" + //import.meta.env.port +
  "/websocket";
