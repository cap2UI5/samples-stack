// Both samples, driven over the wire against CAP's MOCKS of the systems they
// call - what cds watch serves while no credentials are configured: the
// business partner service from srv/external/data/, the SAP system from
// srv/external/SAP_RFC.js. remote.test.mjs drives the same samples through
// the protocols a real system is reached by.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { firedBy, messageBox, post, ROOT, serve, slot, ui5Findings, wellFormed } from "./server.mjs";

const s = serve();
const P = (o) => post(s.url, o);
const ok = (r) => assert.equal(r.status, 200, r.text.slice(0, 500));

const APPS = fs.readdirSync(path.join(ROOT, "srv/apps"))
  .filter((f) => /^z2ui5_cl_caps_app_\d+\.js$/.test(f))
  .map((f) => f.replace(/\.js$/, "").toUpperCase());

test("every sample starts against the mocks, and its view is well-formed XML", async () => {
  assert.ok(APPS.length > 0);
  for (const app of APPS) {
    const r = await P({ app });
    ok(r);
    assert.equal(messageBox(r), undefined, `${app}: the mock did not answer - ${messageBox(r)?.text}`);
    assert.match(r.json.MODEL.SOURCE, /^the mock of /, `${app}: the screen says who answered`);
    const xml = slot(r, "MAIN");
    assert.ok(xml, `${app}: no MAIN view on the start`);
    assert.equal(wellFormed(xml), true, `${app}: ${wellFormed(xml)}`);
    assert.deepEqual(ui5Findings(xml), [], `${app}: every control and property exists in UI5 1.71`);
    assert.match(xml, /title="cap2UI5 - /, `${app}: the page title`);
    assert.match(xml, /showNavButton="false"/, `${app}: started directly, there is nothing to go back to`);
    assert.ok(firedBy(xml, "navButtonPress"), `${app}: the back button carries the nav-back wire`);
  }
});

test("001 OData: the first page, a search with two filters, one partner's addresses", async () => {
  const APP = "Z2UI5_CL_CAPS_APP_001";
  const start = await P({ app: APP });
  assert.equal(start.json.MODEL.COUNT, 14, "every business partner of srv/external/data/");
  assert.equal(start.json.MODEL.PARTNERS.length, 14);
  assert.deepEqual(start.json.MODEL.PARTNERS[0], {
    BUSINESSPARTNER: "1000000", BUSINESSPARTNERCATEGORY: "2", BUSINESSPARTNERFULLNAME: "Inlandskunde DE 1",
    SEARCHTERM1: "KUNDE_DE1", CREATIONDATE: "2019-02-11" });
  assert.match(slot(start, "MAIN"), /press="\.eB\(\['ADDRESSES'\], \$\{BUSINESSPARTNER\}\)"/,
    "a row press sends its business partner");

  // the user types part of a name and picks a category - both bound, both sent back
  const search = await P({ app: APP, id: start.id, event: "SEARCH", model: { SEARCH: "Supplier", CATEGORY: "2" } });
  ok(search);
  assert.deepEqual(search.json.MODEL.PARTNERS.map((p) => p.BUSINESSPARTNERFULLNAME),
    ["Domestic Supplier US 1", "Domestic Supplier US 2"]);
  assert.equal(search.json.MODEL.COUNT, 2);
  assert.equal(slot(search, "MAIN"), undefined, "a search pushes the model, it does not rebuild the view");

  const persons = await P({ app: APP, id: search.id, event: "SEARCH", model: { SEARCH: "", CATEGORY: "1" } });
  assert.deepEqual(persons.json.MODEL.PARTNERS.map((p) => p.BUSINESSPARTNER),
    ["1000020", "1000021", "1000022", "1000023"]);

  const addresses = await P({ app: APP, id: persons.id, event: "ADDRESSES", args: ["1000021"] });
  ok(addresses);
  const popup = slot(addresses, "POPUP");
  assert.equal(wellFormed(popup), true, wellFormed(popup));
  assert.deepEqual(ui5Findings(popup), []);
  assert.match(popup, /<Dialog title="Addresses - \{\/PARTNER\}"/);
  assert.equal(addresses.json.MODEL.PARTNER, "John Miller");
  assert.deepEqual(addresses.json.MODEL.ADDRESSES, [{
    ADDRESSID: "22811", STREETNAME: "Oak Avenue", HOUSENUMBER: "88", POSTALCODE: "60601", CITYNAME: "Chicago",
    COUNTRY: "US" }]);
});

test("002 RFC: the user list, a pattern, one user in full, a user that does not exist", async () => {
  const APP = "Z2UI5_CL_CAPS_APP_002";
  const start = await P({ app: APP });
  assert.equal(start.json.MODEL.ROWS, 7, "ROWS - every user of SAP_RFC.js");
  assert.deepEqual(start.json.MODEL.USERS[0],
    { USERNAME: "ASCHMIDT", FIRSTNAME: "Anna", LASTNAME: "Schmidt", FULLNAME: "Anna Schmidt" });
  assert.match(slot(start, "MAIN"), /press="\.eB\(\['DETAIL'\], \$\{USERNAME\}\)"/, "a row press sends its user");

  // typed in lower case: the app upper-cases it for the CP range
  const search = await P({ app: APP, id: start.id, event: "SEARCH", model: { PATTERN: "*m*" } });
  ok(search);
  assert.deepEqual(search.json.MODEL.USERS.map((u) => u.USERNAME), ["ASCHMIDT", "JMILLER", "MGARCIA"]);
  assert.equal(search.json.MODEL.ROWS, 3);

  const detail = await P({ app: APP, id: search.id, event: "DETAIL", args: ["JMILLER"] });
  ok(detail);
  const popup = slot(detail, "POPUP");
  assert.equal(wellFormed(popup), true, wellFormed(popup));
  assert.deepEqual(ui5Findings(popup), []);
  assert.match(popup, /<Dialog title="User \{\/USER\/USERNAME\}"/);
  assert.match(popup, /<ObjectStatus text="\{= \$\{\/USER\/LOCKED\} \? 'Locked' : 'Not locked' \}"/);
  assert.deepEqual(detail.json.MODEL.USER, {
    USERNAME: "JMILLER", FULLNAME: "John Miller", DEPARTMENT: "Purchasing", FUNCTION: "Purchaser",
    E_MAIL: "john.miller@example.com", TEL1_NUMBR: "+1 312 555 0188", USTYP: "Dialog", CLASS: "PURCHASING",
    GLTGV: "2022-03-02", GLTGB: "2026-12-31", LOCKED: true });
  assert.deepEqual(detail.json.MODEL.ROLES, [
    { AGR_NAME: "Z_PURCHASE_ORDERS", AGR_TEXT: "Process purchase orders", FROM_DAT: "2022-03-02", TO_DAT: "2026-12-31" }]);

  // an initial DATS (00000000: valid without end) shows as nothing
  const developer = await P({ app: APP, id: detail.id, event: "DETAIL", args: ["DEVELOPER"] });
  assert.equal(developer.json.MODEL.USER.GLTGB, "");
  assert.equal(developer.json.MODEL.USER.LOCKED, false);
  assert.equal(developer.json.MODEL.ROLES.length, 2);

  // BAPI_USER_GET_DETAIL does not raise for a user that does not exist - RETURN says so
  const nobody = await P({ app: APP, id: developer.id, event: "DETAIL", args: ["NOBODY"] });
  ok(nobody);
  assert.deepEqual(messageBox(nobody), { type: "error", text: "User NOBODY does not exist" });
  assert.equal(slot(nobody, "POPUP"), undefined, "no popup for it");
  assert.equal(nobody.json.MODEL?.USER, undefined, "and the last user stays: the app changed nothing to push");
});
