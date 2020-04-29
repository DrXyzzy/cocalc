import * as $ from "jquery";
import { callback, delay } from "awaiting";
import { startswith } from "smc-util/misc2";

const MOCHA_CSS_ID = "mocha-css";
const MOCHA_JS_ID = "mocha-js";

// https://cdnjs.com/libraries/mocha/5.2.0 → CSS and JS
function mocha_assets() {
  if (!document.getElementById(MOCHA_CSS_ID)) {
    const css = document.createElement("link");
    css.id = MOCHA_CSS_ID;
    css.href =
      "https://cdnjs.cloudflare.com/ajax/libs/mocha/5.2.0/mocha.min.css";
    css.crossorigin = "anonymous";
    css.type = "text/css";
    css.rel = "stylesheet";
    css.integrity = "sha256-Flo6sV8k+IPfHh6Hx97ReUJDLOwIwvhdGlKOz3UgHRE=";
    document.getElementsByTagName("head")[0].appendChild(link);
  }

  if (!document.getElementById(MOCHA_JS_ID)) {
    const script = document.createElement("script");
    script.id = MOCHA_JS_ID;
    script.href =
      "https://cdnjs.cloudflare.com/ajax/libs/mocha/5.2.0/mocha.min.js";
    script.integrity = "sha256-zcd0ChhCo4xIo9Fk44VeNBLMDf7k7mvtOTvibqnBBQU=";
    script.type = "text/javascript";
    script.crossorigin = "anonymous";
    document.getElementsByTagName("head")[0].appendChild(script);
  }
}

// called during app initialization iff query param test=… is set
export async function mocha_run(path: string): Promise<void> {
  mocha_assets();
  const w: any = window as any;
  w.mocha.setup("bdd");
  load_mocha_tests(path);
  $(".page-container").css("opacity", 0.3);
  $("#mocha")
    .css({
      border: "1px solid grey",
      "border-radius": "3px",
      "box-shadow": "3px 3px 3px 3px #CCC",
    })
    .focus();
  try {
    await callback(w.mocha.run);
  } catch (failures) {
    console.log("testing - FAIL", failures);
  }
  console.log("testing - complete");
  $(".page-container").css("opacity", 0.1);
  await delay(50);
  $("#mocha").focus();
}

/* We have to hard code all the test files as below explicitly,
   due to how webpack and require works.  This will be autogenerated
   via a webpack plugin at some point. */
function load_mocha_tests(path: string): void {
  function f(test: string): boolean {
    return startswith(test, path);
  }
  // TODO: this will be autogenerated
  if (f("frame-editors/markdown-editor/test/basic"))
    require("smc-webapp/frame-editors/markdown-editor/test/basic");
  if (f("frame-editors/markdown-editor/test/math"))
    require("smc-webapp/frame-editors/markdown-editor/test/math");
  if (f("frame-editors/code-editor/test/basic"))
    require("smc-webapp/frame-editors/code-editor/test/basic");
  if (f("frame-editors/code-editor/test/frame"))
    require("smc-webapp/frame-editors/code-editor/test/frame");
  if (f("frame-editors/code-editor/test/actions"))
    require("smc-webapp/frame-editors/code-editor/test/actions");
  if (f("frame-editors/code-editor/test/format"))
    require("smc-webapp/frame-editors/code-editor/test/format");
  if (f("travis")) require("smc-webapp/jupyter/test/travis");

  // not working/useful
  //if (f("account/test/preferences"))
  //require("smc-webapp/account/test/preferences");
}

// make this a button click from the #mocha div.
function test_reset(): void {
  $("#mocha").empty();
  $(".page-container").show().css("opacity", 1);
}

(window as any).test_reset = test_reset;
