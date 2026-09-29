// Both samples through the PROTOCOLS a real system is reached by. Credentials
// are configured, so CAP does not mock the services, and every call leaves
// through the code that would call your system - only the far end is faked:
//
//   API_BUSINESS_PARTNER  CAP's OData V2 client, to an HTTP server in this
//                         process that answers as the S/4HANA service does
//   SAP_RFC               @sap/cds-rfc, to a stand-in for its connector
//                         @sap-rfc/node-rfc-library (test/fixtures/)
//
// Both far ends record what they receive, so the assertions are about what
// the system would get: the OData request, the RFC parameters by kind.
import assert from "node:assert/strict";
import http from "node:http";
import nodeModule from "node:module";
import path from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { messageBox, post, ROOT, serve, slot } from "./server.mjs";

// ---- the S/4HANA end of API_BUSINESS_PARTNER: OData V2 JSON, as Gateway answers
const requests = [];
const s4 = http.createServer((req, res) => {
  requests.push({ url: decodeURIComponent(req.url), apikey: req.headers.apikey });
  const set = req.url.split("?")[0].split("/").pop();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ d: set === "A_BusinessPartner"
    ? { __count: "1234", results: [
        { __metadata: { type: "API_BUSINESS_PARTNER.A_BusinessPartnerType" },
          BusinessPartner: "17100001", BusinessPartnerFullName: "Domestic Supplier US 1",
          BusinessPartnerCategory: "2", SearchTerm1: "SUPPL_US1", CreationDate: "/Date(1556755200000)/" }] }
    : { results: [
        { __metadata: { type: "API_BUSINESS_PARTNER.A_BusinessPartnerAddressType" },
          AddressID: "22820", StreetName: "Industrial Park", HouseNumber: "500", PostalCode: "30303",
          CityName: "Atlanta", Country: "US" }] } }));
});
await new Promise((resolve) => s4.listen(0, "127.0.0.1", resolve));
after(() => s4.close());

// ---- the SAP system end of SAP_RFC: the connector, redirected to the stand-in
if (!nodeModule.registerHooks) throw new Error("remote.test.mjs needs module.registerHooks - Node.js 22.15 or later");
const CONNECTOR = pathToFileURL(path.join(ROOT, "test/fixtures/node-rfc-library.cjs")).href;
nodeModule.registerHooks({
  resolve: (specifier, context, next) => (specifier === "@sap-rfc/node-rfc-library"
    ? { url: CONNECTOR, shortCircuit: true }
    : next(specifier, context)),
});
const rfc = (globalThis.__rfc ??= []);

// ---- the credentials, as a .env file would give them (cds_requires_<service>_credentials)
const S4_URL = `http://127.0.0.1:${s4.address().port}/sap/opu/odata/sap/API_BUSINESS_PARTNER`;
process.env.cds_requires_API__BUSINESS__PARTNER_credentials = JSON.stringify({ url: S4_URL, headers: { APIKey: "my-api-key" } });
process.env.cds_requires_SAP__RFC_credentials = JSON.stringify(
  { ashost: "sap.example.com", sysnr: "00", client: "100", user: "RFC_CAP", passwd: "not-a-real-one" });

const s = serve();
const P = (o) => post(s.url, o);
const ok = (r) => assert.equal(r.status, 200, r.text.slice(0, 500));

test("001 OData: the query arrives as an OData V2 request, the answer as rows", async () => {
  const APP = "Z2UI5_CL_CAPS_APP_001";
  const start = await P({ app: APP });
  ok(start);
  assert.equal(messageBox(start), undefined, messageBox(start)?.text);
  assert.equal(start.json.MODEL.SOURCE, S4_URL, "the screen names the service it reached");
  assert.deepEqual(requests.shift(), {
    url: "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner" +
      "?$select=BusinessPartner,BusinessPartnerFullName,BusinessPartnerCategory,SearchTerm1,CreationDate" +
      "&$orderby=BusinessPartner&$top=20&$inlinecount=allpages",
    apikey: "my-api-key" }, "the headers of the credentials go along - the sandbox's APIKey");
  assert.equal(start.json.MODEL.COUNT, 1234, "$inlinecount: every hit, not only the page");
  assert.deepEqual(start.json.MODEL.PARTNERS, [{
    BUSINESSPARTNER: "17100001", BUSINESSPARTNERFULLNAME: "Domestic Supplier US 1", BUSINESSPARTNERCATEGORY: "2",
    SEARCHTERM1: "SUPPL_US1", CREATIONDATE: "2019-05-02" }], "an Edm.DateTime arrives as the date it is");

  const search = await P({ app: APP, id: start.id, event: "SEARCH", model: { SEARCH: "Supplier", CATEGORY: "2" } });
  ok(search);
  assert.equal(requests.shift().url, "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner" +
    "?$select=BusinessPartner,BusinessPartnerFullName,BusinessPartnerCategory,SearchTerm1,CreationDate" +
    "&$orderby=BusinessPartner&$top=20" +
    "&$filter=substringof('Supplier',BusinessPartnerFullName) and BusinessPartnerCategory eq '2'" +
    "&$inlinecount=allpages");

  // a quote in the search is data, not OData syntax
  const quoted = await P({ app: APP, id: search.id, event: "SEARCH", model: { SEARCH: "O'Brien", CATEGORY: "" } });
  ok(quoted);
  assert.match(requests.shift().url, /&\$filter=substringof\('O''Brien',BusinessPartnerFullName\)&\$inlinecount/);

  const addresses = await P({ app: APP, id: quoted.id, event: "ADDRESSES", args: ["17100001"] });
  ok(addresses);
  assert.equal(requests.shift().url, "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartnerAddress" +
    "?$select=AddressID,StreetName,HouseNumber,PostalCode,CityName,Country&$filter=BusinessPartner eq '17100001'");
  assert.equal(addresses.json.MODEL.PARTNER, "Domestic Supplier US 1");
  assert.deepEqual(addresses.json.MODEL.ADDRESSES.map((a) => a.CITYNAME), ["Atlanta"]);
  assert.ok(slot(addresses, "POPUP"));
});

test("002 RFC: each BAPI reaches the connector with its parameters sorted by kind", async () => {
  const APP = "Z2UI5_CL_CAPS_APP_002";
  const start = await P({ app: APP });
  ok(start);
  assert.equal(messageBox(start), undefined, messageBox(start)?.text);
  assert.equal(start.json.MODEL.SOURCE, "sap.example.com, client 100", "the screen names the system - not the user");
  assert.deepEqual(rfc.splice(0), [
    { open: { ashost: "sap.example.com", sysnr: "00", client: "100", lang: "en", also: ["passwd", "user"] } },
    { execute: "BAPI_USER_GETLIST", params: {
      import:   { MAX_ROWS: 50, WITH_USERNAME: "X" },
      changing: {},
      table:    { SELECTION_RANGE: [{ PARAMETER: "USERNAME", SIGN: "I", OPTION: "CP", LOW: "*" }] } } },
    { commit: true },
    { close: true },
  ], "one connection per call: open, execute, commit, close - as @sap/cds-rfc runs a transaction");
  assert.deepEqual(start.json.MODEL.USERS.map((u) => u.USERNAME), ["DEVELOPER"]);
  assert.equal(start.json.MODEL.ROWS, 1);

  const detail = await P({ app: APP, id: start.id, event: "DETAIL", args: ["DEVELOPER"] });
  ok(detail);
  assert.deepEqual(rfc.splice(0).find((c) => c.execute),
    { execute: "BAPI_USER_GET_DETAIL", params: { import: { USERNAME: "DEVELOPER" }, changing: {}, table: {} } });
  assert.deepEqual(detail.json.MODEL.USER, {
    USERNAME: "DEVELOPER", FULLNAME: "Developer", DEPARTMENT: "IT", FUNCTION: "ABAP Developer",
    E_MAIL: "developer@example.com", TEL1_NUMBR: "", USTYP: "Dialog", CLASS: "DEVELOPER",
    GLTGV: "2024-01-01", GLTGB: "", LOCKED: false });
  assert.deepEqual(detail.json.MODEL.ROLES,
    [{ AGR_NAME: "Z_ABAP_DEVELOPER", AGR_TEXT: "Develop in ABAP", FROM_DAT: "2024-01-01", TO_DAT: "9999-12-31" }]);
  assert.ok(slot(detail, "POPUP"));

  const nobody = await P({ app: APP, id: detail.id, event: "DETAIL", args: ["NOBODY"] });
  rfc.splice(0);
  assert.deepEqual(messageBox(nobody), { type: "error", text: "User NOBODY does not exist" });
});
