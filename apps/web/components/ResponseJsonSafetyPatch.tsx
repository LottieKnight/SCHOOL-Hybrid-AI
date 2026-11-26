"use client";

import { useEffect } from "react";
import { safeJson } from "@/lib/http";

type PatchedResponsePrototype = typeof Response.prototype & {
  __saeduSafeJsonPatched?: boolean;
  __saeduOriginalJson?: Response["json"];
};

export function ResponseJsonSafetyPatch() {
  useEffect(() => {
    const proto = Response.prototype as PatchedResponsePrototype;
    if (proto.__saeduSafeJsonPatched) return;

    proto.__saeduOriginalJson = proto.json;
    proto.json = function patchedJson(this: Response) {
      // Parse safely so empty/non-JSON bodies never throw SyntaxError into UI code.
      return safeJson(this) as any;
    };
    proto.__saeduSafeJsonPatched = true;
  }, []);

  return null;
}
