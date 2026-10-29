/**
 * Firefox logs "Content at https://… may not load or link to file:///" when a
 * page assigns a file URL or postMessages to one. Nothing on this site is
 * allowed to do either.
 */

const FILE_URL = /^\s*file:/i;

function isFileUrl(value: unknown): value is string {
  return typeof value === "string" && FILE_URL.test(value);
}

function blockProperty(proto: object, prop: "src" | "href"): void {
  try {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc?.set || !desc.get) return;
    Object.defineProperty(proto, prop, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(value: unknown) {
        if (isFileUrl(value)) return;
        desc.set!.call(this, value);
      },
    });
  } catch {
    /* A locked prototype must not take the page down. */
  }
}

export function blockFileAccess(): void {
  if (typeof window === "undefined") return;
  const flag = window as Window & { __bsFileBlocked?: boolean };
  if (flag.__bsFileBlocked) return;
  flag.__bsFileBlocked = true;

  const nativePost = window.postMessage.bind(window);
  window.postMessage = ((
    message: unknown,
    targetOrigin?: string | WindowPostMessageOptions,
    transfer?: Transferable[],
  ) => {
    if (typeof targetOrigin === "string") {
      if (isFileUrl(targetOrigin)) return;
      nativePost(message, targetOrigin, transfer);
      return;
    }
    if (targetOrigin && isFileUrl(targetOrigin.targetOrigin)) return;
    if (targetOrigin == null) {
      nativePost(message);
      return;
    }
    nativePost(message, targetOrigin as string, transfer);
  }) as typeof window.postMessage;

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if ((name === "src" || name === "href" || name === "srcset") && isFileUrl(value)) return;
    nativeSetAttribute.call(this, name, value);
  };

  blockProperty(HTMLImageElement.prototype, "src");
  blockProperty(HTMLIFrameElement.prototype, "src");
  blockProperty(HTMLMediaElement.prototype, "src");
  blockProperty(HTMLSourceElement.prototype, "src");
  blockProperty(HTMLScriptElement.prototype, "src");
  blockProperty(HTMLAnchorElement.prototype, "href");
  blockProperty(HTMLLinkElement.prototype, "href");
  blockProperty(HTMLAreaElement.prototype, "href");
  silenceFirefoxPointerFields();

  const nativeOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (isFileUrl(String(url ?? ""))) return null;
    return nativeOpen(url, target, features);
  }) as typeof window.open;
}

/** Reading these Firefox-only fields logs the file:// security error. */
function silenceFirefoxPointerFields(): void {
  const protos = [MouseEvent.prototype, PointerEvent.prototype, WheelEvent.prototype];
  for (const proto of protos) {
    for (const name of ["mozInputSource", "mozPressure"] as const) {
      if (!(name in proto)) continue;
      try {
        Object.defineProperty(proto, name, {
          configurable: true,
          enumerable: true,
          get: () => (name === "mozPressure" ? 0 : 0),
        });
      } catch {
        /* Already sealed. */
      }
    }
  }
}

/** Runs in <head> before any other script, so the log never starts. */
export const FILE_BLOCK_BOOT = `(function(){if(window.__bsFileBlocked)return;window.__bsFileBlocked=true;var file=/^\\s*file:/i;function isFile(v){return typeof v==="string"&&file.test(v)}function block(proto,prop){try{var d=Object.getOwnPropertyDescriptor(proto,prop);if(!d||!d.set||!d.get)return;Object.defineProperty(proto,prop,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){if(isFile(v))return;d.set.call(this,v)}})}catch(e){}}var nativeSet=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if((n==="src"||n==="href"||n==="srcset")&&isFile(v))return;nativeSet.call(this,n,v)};["src","href"].forEach(function(){});block(HTMLImageElement.prototype,"src");block(HTMLIFrameElement.prototype,"src");block(HTMLMediaElement.prototype,"src");block(HTMLSourceElement.prototype,"src");block(HTMLScriptElement.prototype,"src");block(HTMLAnchorElement.prototype,"href");block(HTMLLinkElement.prototype,"href");if(window.HTMLAreaElement)block(HTMLAreaElement.prototype,"href");[MouseEvent.prototype,window.PointerEvent&&PointerEvent.prototype,WheelEvent.prototype].forEach(function(proto){if(!proto)return;["mozInputSource","mozPressure"].forEach(function(name){if(!(name in proto))return;try{Object.defineProperty(proto,name,{configurable:true,enumerable:true,get:function(){return 0}})}catch(e){}})});var nativeOpen=window.open.bind(window);window.open=function(url,target,features){if(isFile(String(url||"")))return null;return nativeOpen(url,target,features)};})();`;

if (typeof window !== "undefined") blockFileAccess();
