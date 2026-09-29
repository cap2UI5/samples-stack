// The samples project served in this process by cds.test, and the abap2UI5
// wire to talk to it: the tests play the frontend's part, one POST per
// roundtrip, as cap2UI5/samples does (and cap2UI5's own examples/bookshop).
//
// Every remote service of the project is MOCKED unless the test file gives it
// credentials first (serve( ) passes --with-mocks, as cds watch does): a
// service with credentials is called, one without is served by CAP itself.
//
// Do not call cds.test.log( ) in a file that serves SAP_RFC mocked. CAP skips
// a protocol it does not know - SAP_RFC is @protocol: 'rfc' - by returning
// what the logger's warn( ) returns, which is nothing until the log is
// captured; captured, the warning itself is kept as an endpoint and the
// server fails to start ("Cannot find impl for protocol adapter: undefined").
import { checkXmlSource } from "@abap2ui5/linter";
import cds from "@sap/cds";
import { XMLValidator } from "fast-xml-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Serve the project for the calling test file (cds.test registers the hooks). */
export function serve() {
  const t = cds.test(ROOT, "--with-mocks");
  return { get url() { return `${t.url}/rest/root/z2ui5`; } };
}

/**
 * One roundtrip. No `id` starts `app`; with `id` it answers an event on the
 * draft the previous response named. `model` is what the frontend sends back:
 * the bound values the user changed.
 */
export async function post(url, { app, id = "", event = "", args = [], model = {} } = {}) {
  const body = { value: { S_FRONT: {
    ID: id, APP: app, EVENT: event, T_EVENT_ARG: args,
    ORIGIN: "http://127.0.0.1", PATHNAME: "/rest/root/z2ui5",
    SEARCH: id ? "" : `?app_start=${app}`, HASH: "", CONFIG: {} },
    XX: {}, MODEL: model } };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from("alice:").toString("base64"),   // CAP's mocked user
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* an error page, not a wire envelope */ }
  return { status: r.status, text, json, id: json?.S_FRONT?.ID, app: json?.S_FRONT?.APP };
}

/** Every action of a response, system and custom. */
export const actions = (r) => [
  ...(r.json?.S_FRONT?.S_ACTION?.T_SYSTEM ?? []),
  ...(r.json?.S_FRONT?.S_ACTION?.T_CUSTOM ?? []),
];

/** The XML a response displays into a view slot (MAIN, POPUP, NEST, …), or undefined. */
export const slot = (r, name) => actions(r)
  .find((a) => a[0] === "VIEW_SLOTS" && a[1] === "display" && a[2] === name)?.[3];

/** The message box a response opens, as { type, text }, or undefined. */
export const messageBox = (r) => {
  const a = actions(r).find((x) => x[0] === "MESSAGE_BOX");
  return a && { type: a[1], text: a[2] };
};

/** true, or the parser's complaint - a template literal typo shows up here, not only in the browser */
export const wellFormed = (xml) => {
  const v = XMLValidator.validate(xml);
  return v === true ? true : `${v.err.code} at ${v.err.line}:${v.err.col} - ${v.err.msg}`;
};

/**
 * What the abap2UI5 linter's property gate finds in a view: every control,
 * property, aggregation and event against the UI5 metadata, at the release
 * the abap2UI5 family supports (1.71) - [] when it finds nothing. A property
 * that does not exist renders as nothing, silently; this is where it shows.
 * (The render gate needs a browser and stays out of npm test.)
 */
export const ui5Findings = (xml) => checkXmlSource(xml, { render: false, minUi5: "1.71" })
  .findings.map((f) => `${f.severity}: ${f.message}`);

/** the event a handler attribute's wire fires, as the browser sends it back */
export const firedBy = (xml, attr) => xml.match(new RegExp(`${attr}="\\.eB\\(\\['([^']+)'`))?.[1];
