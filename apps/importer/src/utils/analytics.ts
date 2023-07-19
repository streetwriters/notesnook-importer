/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { useEffect, useState } from "react";
import Config from "./config";

declare global {
  interface Window {
    umami?: {
      trackEvent: (
        value: string,
        type: string,
        url?: string,
        websiteId?: string
      ) => void;
      trackView: (url: string, referrer?: string, websiteId?: string) => void;
    };
  }
}

export function loadTrackerScript() {
  if (Config.get("telemetry") === "false") return Promise.resolve(false);
  if (document.getElementById("analytics")) {
    return Promise.resolve(true);
  }

  const script = document.createElement("script");
  script.id = "analytics";
  script.src = "https://analytics.streetwriters.co/umami.js";
  script.async = true;
  script.dataset.websiteId = "b84b000d-9fcb-48e3-bbc0-0adad1a960c0";

  if (process.env.REACT_APP_PLATFORM !== "desktop")
    script.dataset.domains = "importer.notesnook.com";
  script.dataset.autoTrack = "false";
  script.dataset.doNotTrack = "true";
  script.dataset.hostUrl = "https://analytics.streetwriters.co";

  return new Promise<boolean>((resolve, reject) => {
    script.onload = () => resolve(true);
    script.onerror = (e) => reject(e);

    const firstScriptElement = document.getElementsByTagName("script")[0];
    firstScriptElement.parentNode?.insertBefore(script, firstScriptElement);
  });
}

type TrackerEvent = {
  name: string;
  // description: string;
  type?: "event" | "view";
};

export async function trackEvent(event: TrackerEvent, eventMessage?: string) {
  if (
    !(await loadTrackerScript()) ||
    !Config.get("telemetry", true) ||
    !window.umami
  )
    return;

  if (event.type === "view") trackVisit(event.name);
  else if (eventMessage) window.umami.trackEvent(eventMessage, event.name);
}

function trackVisit(url = "/") {
  window.umami?.trackView(url, window.document.referrer);
}

export function useTelemetry() {
  const [isEnabled, setIsEnabled] = useState(Config.get("telemetry", true));

  useEffect(() => {
    Config.set("telemetry", isEnabled);
  }, [isEnabled]);

  return { isEnabled, setIsEnabled };
}
