let scheme = "ws";

if (window.location.protocol === "https:") {
  scheme += "s";
}

export const serverUrl = scheme + "://" + import.meta.env.VITE_WEBSOCKER_URL;
