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

import { fromBase64 } from "../../utils/base64";
import { WASM_BASE64 } from "./lzxd-bg";

/**
 * Minimal glue for the lzxd WebAssembly module. Mirrors the wasm-bindgen
 * exports of lzxd 0.1.5 (https://github.com/Lonami/lzxd) while being
 * self-contained (the wasm binary is embedded as base64).
 */

export enum WindowSize {
  KB32 = 32768,
  KB64 = 65536,
  KB128 = 131072,
  KB256 = 262144,
  KB512 = 524288,
  MB1 = 1048576,
  MB2 = 2097152,
  MB4 = 4194304,
  MB8 = 8388608,
  MB16 = 16777216,
  MB32 = 33554432
}

type WasmExports = {
  memory: WebAssembly.Memory;
  __wbindgen_malloc: (len: number) => number;
  __wbindgen_realloc: (ptr: number, oldSize: number, newSize: number) => number;
  __wbindgen_free: (ptr: number, size: number) => void;
  __wbindgen_add_to_stack_pointer: (delta: number) => number;
  lzxd_new: (windowSize: number) => number;
  lzxd_decompress_next: (
    retptr: number,
    ptr: number,
    dataPtr: number,
    len: number
  ) => void;
  __wbg_lzxd_free: (ptr: number) => void;
};

let wasmPromise: Promise<WasmExports> | undefined;

async function getWasm(): Promise<WasmExports> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const bytes = fromBase64(WASM_BASE64);
      const imports = {
        __wbindgen_placeholder__: {
          __wbindgen_string_new: () => addHeapObject(new Error()),
          __wbg_new_abda76e883ba8a5f: () => addHeapObject(new Error()),
          __wbg_stack_658279fe44541cf6: () => {},
          __wbg_error_f851667af71bcfc6: () => {},
          __wbindgen_object_drop_ref: () => {},
          __wbindgen_throw: () => {}
        }
      };
      const { instance } = await WebAssembly.instantiate(bytes, imports);
      return instance.exports as unknown as WasmExports;
    })();
  }
  return wasmPromise;
}

const heap: unknown[] = new Array(128).fill(undefined);
heap.push(undefined, null, true, false);
let heapNext = heap.length;

function addHeapObject(obj: unknown): number {
  if (heapNext === heap.length) heap.push(heap.length + 1);
  const idx = heapNext;
  heapNext = heap[idx] as number;
  heap[idx] = obj;
  return idx;
}

function takeObject(idx: number): unknown {
  const ret = heap[idx];
  if (idx < 132) return ret;
  heap[idx] = heapNext;
  heapNext = idx;
  return ret;
}

let wasmVectorLen = 0;

export class Lzxd {
  private ptr: number;

  private constructor(ptr: number, private readonly wasm: WasmExports) {
    this.ptr = ptr;
  }

  static async create(windowSize: number): Promise<Lzxd> {
    const wasm = await getWasm();
    const ptr = wasm.lzxd_new(windowSize);
    return new Lzxd(ptr, wasm);
  }

  free() {
    this.wasm.__wbg_lzxd_free(this.ptr);
    this.ptr = 0;
  }

  /** Decompresses the next compressed chunk. */
  decompressNext(chunk: Uint8Array): Uint8Array {
    const wasm = this.wasm;
    // The wasm memory may grow during the call which invalidates cached
    // views, so create fresh views on every call.
    let uint8Memory = new Uint8Array(wasm.memory.buffer);
    let int32Memory = new Int32Array(wasm.memory.buffer);

    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = wasm.__wbindgen_malloc(chunk.length);
      uint8Memory.set(chunk, ptr0);
      wasmVectorLen = chunk.length;

      wasm.lzxd_decompress_next(retptr, this.ptr, ptr0, wasmVectorLen);

      uint8Memory = new Uint8Array(wasm.memory.buffer);
      int32Memory = new Int32Array(wasm.memory.buffer);

      const r0 = int32Memory[retptr / 4 + 0];
      const r1 = int32Memory[retptr / 4 + 1];
      const r2 = int32Memory[retptr / 4 + 2];
      const r3 = int32Memory[retptr / 4 + 3];
      if (r3) {
        throw takeObject(r2) as Error;
      }
      const result = new Uint8Array(uint8Memory.slice(r0, r0 + r1));
      wasm.__wbindgen_free(r0, r1);
      return result;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
}
