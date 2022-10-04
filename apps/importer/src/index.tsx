import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./app";
import { Buffer } from "buffer";

// @ts-ignore
globalThis.Buffer = Buffer;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
