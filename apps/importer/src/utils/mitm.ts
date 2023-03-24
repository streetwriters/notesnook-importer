export {};

let sw: ServiceWorker | null = null;
let scope = "";

function registerWorker() {
  return navigator.serviceWorker
    .getRegistration("./")
    .then((swReg) => {
      return (
        swReg || navigator.serviceWorker.register("sw.js", { scope: "./" })
      );
    })
    .then((swReg) => {
      const swRegTmp = swReg.installing || swReg.waiting;

      scope = swReg.scope;
      let fn: () => void;
      return (
        (sw = swReg.active) ||
        new Promise((resolve) => {
          swRegTmp?.addEventListener(
            "statechange",
            (fn = () => {
              if (swRegTmp.state === "activated") {
                swRegTmp.removeEventListener("statechange", fn);
                sw = swReg.active;
                resolve(undefined);
              }
            })
          );
        })
      );
    });
}

// Now that we have the Service Worker registered we can process messages
export function postMessage(
  data: {
    origin?: string;
    referrer?: string;
    headers: Record<string, string>;
    pathname: string;
    url?: string;
    transferringReadable: boolean;
  },
  ports: MessagePort[]
) {
  // It's important to have a messageChannel, don't want to interfere
  // with other simultaneous downloads
  if (!ports || !ports.length) {
    throw new TypeError("[StreamSaver] You didn't send a messageChannel");
  }

  if (typeof data !== "object") {
    throw new TypeError("[StreamSaver] You didn't send a object");
  }

  // the default public service worker for StreamSaver is shared among others.
  // so all download links needs to be prefixed to avoid any other conflict
  data.origin = window.location.origin;

  // if we ever (in some feature versoin of streamsaver) would like to
  // redirect back to the page of who initiated a http request
  data.referrer = data.referrer || document.referrer || origin;

  // test if it's correct
  // should thorw a typeError if not
  new Headers(data.headers);

  // remove all leading slashes
  data.pathname = data.pathname.replace(/^\/+/g, "");

  // remove protocol
  let org = origin.replace(/(^\w+:|^)\/\//, "");

  // set the absolute pathname to the download url.
  data.url = new URL(`${scope + org}/${data.pathname}`).toString();

  if (!data.url.startsWith(`${scope + org}/`)) {
    throw new TypeError("[StreamSaver] bad `data.pathname`");
  }

  // This sends the message data as well as transferring
  // messageChannel.port2 to the service worker. The service worker can
  // then use the transferred port to reply via postMessage(), which
  // will in turn trigger the onmessage handler on messageChannel.port1.

  const transferable = [ports[0]];

  return sw?.postMessage(data, transferable);
}

export async function register() {
  if (navigator.serviceWorker) {
    await registerWorker();
  }
}
