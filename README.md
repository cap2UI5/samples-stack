# cap2UI5 — samples-stack

**Learn how cap2UI5 plays with the rest of your stack: an app that reads an
OData service, and an app that calls a function module in an SAP system.**

A [cap2UI5](https://github.com/cap2UI5/cap2UI5) app is a CAP handler, so it
reaches another system the way every CAP handler does — CAP's remote services:
the system's interface is imported as a CDS model, declared in `cds.requires`,
and the app `cds.connect.to`s it by name. Nothing in these samples is
cap2UI5's own; what they show is that none of it has to be.

Every sample here needs something **beyond a cap2UI5 installation** — an OData
service, an SAP system reachable over RFC. And every sample **runs without
it**: `cds watch` mocks the system while no credentials are configured, and
once they are, the same app talks to the real one — not a line of it changes.
The top of each sample's screen says which of the two answered.

## Which sample do I need?

| You want to … | Sample | To connect a real system you need |
|---|---|---|
| Read an OData service — business partners from SAP S/4HANA, with `cds.ql` | [`Z2UI5_CL_CAPS_APP_001`](srv/apps/z2ui5_cl_caps_app_001.js) — [OData](#01--odata-read-an-odata-service) | `API_BUSINESS_PARTNER` of an S/4HANA system — or its sandbox on the SAP Business Accelerator Hub and an API key |
| Call a function module — a BAPI — in an SAP system over RFC | [`Z2UI5_CL_CAPS_APP_002`](srv/apps/z2ui5_cl_caps_app_002.js) — [RFC](#02--rfc-call-a-function-module-in-an-sap-system) | an ABAP system reachable over RFC, a user allowed to read users, and an RFC connector |

## Run it

```bash
npm install
cds watch            # needs @sap/cds-dk (npm i -g @sap/cds-dk) - or: npm run mocked
```

`cds watch` prints the address of every sample. Log in as `alice` with an
empty password (CAP's mocked development user), then open
<http://localhost:4004/sap/bc/z2ui5?app_start=Z2UI5_CL_CAPS_APP_001> or
<http://localhost:4004/sap/bc/z2ui5?app_start=Z2UI5_CL_CAPS_APP_002>.

The log shows what is mocked:

```
[cds] - mocking API_BUSINESS_PARTNER { at: [ '/odata/v4/api-business-partner' ], ... }
[adapters] - ignoring unknown protocol: rfc
[cds] - mocking SAP_RFC { ..., impl: 'srv/external/SAP_RFC.js' }
```

(The `rfc` line is CAP noticing that an RFC service has no HTTP endpoint: the
mock of the SAP system answers the apps, not the browser. The mock of the
OData service does both — its rows are at
<http://localhost:4004/odata/v4/api-business-partner/A_BusinessPartner>.)

```
srv/
  apps/                           the samples - one app, one file
  external/
    API_BUSINESS_PARTNER.cds      the OData service's model          ─┐ what cds import
    SAP_RFC.cds                   the SAP system's function modules  ─┘ makes of a system
    SAP_RFC.js                    the SAP system, mocked
    data/                         the OData service, mocked - its rows
package.json                      cds.requires: API_BUSINESS_PARTNER, SAP_RFC
```

## 01 — OData: read an OData service

[`Z2UI5_CL_CAPS_APP_001`](srv/apps/z2ui5_cl_caps_app_001.js) lists business
partners of SAP S/4HANA's OData service `API_BUSINESS_PARTNER`, filters them by
name and category, and shows a partner's addresses on a row press.

The app writes a query as it would against an entity of its own database:

```js
const bupa = await cds.connect.to("API_BUSINESS_PARTNER");
const { A_BusinessPartner } = bupa.entities;
const partners = await bupa.run(SELECT.from(A_BusinessPartner)
    .columns("BusinessPartner", "BusinessPartnerFullName", ...)
    .where`contains(BusinessPartnerFullName, ${this.search})`
    .orderBy("BusinessPartner")
    .limit(20));
```

and CAP's remote service sends it as OData V2:

```
GET /sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner
    ?$select=BusinessPartner,BusinessPartnerFullName,...&$orderby=BusinessPartner&$top=20
    &$filter=substringof('Cust',BusinessPartnerFullName)&$inlinecount=allpages
```

Three pieces make that work, all of them CAP's:

1. **The model** — [`srv/external/API_BUSINESS_PARTNER.cds`](srv/external/API_BUSINESS_PARTNER.cds),
   what `cds import` writes from the service's `$metadata`, trimmed to what
   the sample reads. For the whole service: download the EDMX from the
   [SAP Business Accelerator Hub](https://api.sap.com/api/API_BUSINESS_PARTNER/overview)
   and `cds import API_BUSINESS_PARTNER.edmx --as cds --force`.
2. **The declaration** — `cds.requires.API_BUSINESS_PARTNER` in
   [`package.json`](package.json): `kind: "odata-v2"` and the model.
3. **The call** — `cds.connect.to("API_BUSINESS_PARTNER")` and `cds.ql`.

### Connect the real service

Credentials make the difference: with them, CAP stops mocking the service and
calls it. Put them in a `.env` file in the project root — it is git-ignored —
and restart `cds watch`.

**No S/4HANA system at hand? The sandbox.** The SAP Business Accelerator Hub
runs `API_BUSINESS_PARTNER` as a sandbox for everybody with an SAP account: log
on to [api.sap.com](https://api.sap.com), copy your API key, and

```properties
cds.requires.API_BUSINESS_PARTNER.credentials.url=https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER
cds.requires.API_BUSINESS_PARTNER.credentials.headers.APIKey=<your API key>
```

**Your own SAP S/4HANA system**, with a user that may read business partners:

```properties
cds.requires.API_BUSINESS_PARTNER.credentials.url=https://<host>:<port>/sap/opu/odata/sap/API_BUSINESS_PARTNER
cds.requires.API_BUSINESS_PARTNER.credentials.username=<user>
cds.requires.API_BUSINESS_PARTNER.credentials.password=<password>
```

The service has to be active in the system (`/IWFND/MAINT_SERVICE`).

**On SAP BTP**, the `[production]` profile in `package.json` points the service
at the destination `S4HANA`: create it in the BTP cockpit and bind the app to
the Destination service (and the Connectivity service, if the system is
on-premise, behind the Cloud Connector).

### Worth knowing

- **The comparison is the service's.** `contains( )` becomes `substringof( )`,
  and SAP Gateway compares case-sensitively; the mock — SQLite — does not.
- **A remote call can fail where the own database does not.** The sample
  catches it and says what happened in a message box — an uncaught error would
  answer the roundtrip with `roundtrip failed` and nothing else.
- **The call happens inside the roundtrip**, so the user waits for it: the
  sample reads the first page when it starts and then only on an event, and
  keeps `$top` small.
- **The row fields are the OData property names**, and the view binds them
  uppercased: `BusinessPartnerFullName` is `{BUSINESSPARTNERFULLNAME}`.
- **Every user of the app reads with the credentials of `.env`.** For more than
  a demo, restrict the app with `cds.requires.cap2ui5.roles`, or use a
  destination with principal propagation, so that S/4HANA checks the actual
  user.

## 02 — RFC: call a function module in an SAP system

[`Z2UI5_CL_CAPS_APP_002`](srv/apps/z2ui5_cl_caps_app_002.js) calls two BAPIs
that every ABAP system has: `BAPI_USER_GETLIST` for a list of users — a pattern
like `D*` goes in as a ranges table — and, on a row press,
`BAPI_USER_GET_DETAIL` for one user: address, logon data, lock status, roles.
Between them they pass what a function module can take and give — single
values, structures and tables, in both directions — and read the errors from
`RETURN`, where a BAPI reports them.

### From node-rfc to `@sap/cds-rfc`

The classic way to call a BAPI from Node.js is
[node-rfc](https://github.com/SAP-archive/node-rfc), as in Martin Maruskin's
[How to call BAPI in SAP from nodejs app](https://blog.maruskin.eu/2018/04/how-to-call-bapi-in-sap-from-nodejs-app.html)
— in node-rfc's last form:

```js
const client = new Client({ ashost, sysnr, client, user, passwd });
await client.open();
const result = await client.call("BAPI_USER_GET_DETAIL", { USERNAME: "DEVELOPER" });
```

SAP has since archived node-rfc (the npm package is deprecated, the repository
read-only — [SAP-archive/node-rfc#329](https://github.com/SAP-archive/node-rfc/issues/329)).
Its place in a CAP project is [`@sap/cds-rfc`](https://www.npmjs.com/package/@sap/cds-rfc),
SAP's RFC plugin for CAP: a function module becomes an **action of a remote
service**, and the call reads almost as before —

```js
const sap = await cds.connect.to("SAP_RFC");
const { ADDRESS, ACTIVITYGROUPS, RETURN } = await sap.BAPI_USER_GET_DETAIL({ USERNAME: "DEVELOPER" });
```

— while the connection moved out of the code, into CAP's configuration: a
`.env` file on your machine, an RFC destination on SAP BTP, and a mock while you
develop. The parameters keep their ABAP names; a single value is a value, a
structure an object, a table an array of objects.

The pieces:

1. **The model** — [`srv/external/SAP_RFC.cds`](srv/external/SAP_RFC.cds), in
   the shape `cds import --from rfc` writes: each function module an action,
   its import and table parameters the action's parameters (annotated with
   their kind), its exports and tables the result type. Trimmed to what the
   sample uses; for a function module's whole interface, import it from your
   system (connection as below):

   ```bash
   cds import --from rfc --as cds --name BAPI_USER_GET_DETAIL --destination SAP_RFC --force
   ```

   `@sap/cds-rfc` passes exactly the parameters the model declares — one it
   does not declare never reaches the system.
2. **The declaration** — `cds.requires.SAP_RFC` in [`package.json`](package.json):
   `kind: "rfc"`, the model, and `"external": true`. The rfc kind does not
   declare itself external, and without the flag CAP would keep choosing the
   mock next to the model over `@sap/cds-rfc` — whatever the credentials say.
3. **The mock** — [`srv/external/SAP_RFC.js`](srv/external/SAP_RFC.js): what
   CAP serves as `SAP_RFC` while no credentials are configured. It answers the
   two BAPIs as an ABAP system does — dates as `YYYYMMDD`, an unknown user as
   an `E` message in `RETURN`, not as an exception.
4. **The call** — `cds.connect.to("SAP_RFC")` and the BAPI as a method.

### Connect the real system

**1. Credentials**, in a `.env` file in the project root — it is git-ignored:

```properties
cds.requires.SAP_RFC.credentials.ashost=<application server host>
cds.requires.SAP_RFC.credentials.sysnr=00
cds.requires.SAP_RFC.credentials.client=100
cds.requires.SAP_RFC.credentials.user=<user>
cds.requires.SAP_RFC.credentials.passwd=<password>
```

RFC goes to the system's gateway, port `33<sysnr>` — `3300` for system
number `00`.

**2. A connector.** `@sap/cds-rfc` speaks RFC through a connector library,
which is not on npmjs.com — without one, the sample says
`Calling SAP_RFC failed: Cannot find module '@sap-rfc/node-rfc-library'`.
There are two:

- **SAP's `@sap-rfc/node-rfc-library`** — for SAP customers with an *SAP Build
  Code* license, from SAP's own npm registry (the
  [Repository Based Shipment Channel](https://help.sap.com/docs/RBSC/0a64be17478d4f5ba45d14ab62b0d74c/175673b12feb41739df4f041db52fe76.html)),
  Linux and Windows only. Configure the registry for the `@sap-rfc` scope in
  `.npmrc` as the [`@sap/cds-rfc` README](https://www.npmjs.com/package/@sap/cds-rfc)
  shows, then `npm install`: it is an optional dependency of `@sap/cds-rfc` and
  comes along. This is also the one for SAP BTP through the Cloud Connector.
- **[open-rfc](https://github.com/marianfoo/open-rfc)** — a community connector
  without the SAP NW RFC SDK, written in plain JavaScript and published on
  npmjs.com, which replaces SAP's below an unchanged `@sap/cds-rfc`. It is a
  **beta** (0.x), and its beta covers direct connections to an application
  server with user and password, on S/4HANA 2023 and NetWeaver 7.50. Add to
  `package.json`

  ```json
  "overrides": {
    "@sap/cds-rfc": {
      "@sap-rfc/node-rfc-library": "npm:open-rfc@0.2.4"
    }
  }
  ```

  and `npm install`.

**3. Authorizations** for the RFC user: `S_RFC` for the function group
`SU_USER` (the two BAPIs), and `S_USER_GRP` with activity `03` for the user
groups it may read.

**On SAP BTP**, the `[production]` profile in `package.json` points `SAP_RFC` at
the destination `SAP_RFC`: an RFC destination, through the Cloud Connector for
an on-premise system, with the app bound to the Destination and Connectivity
services.

### Your own function module

Import it — `cds import --from rfc --as cds --name Z_MY_FUNCTION --destination SAP_RFC`
adds it to `srv/external/SAP_RFC.cds` — and call it:
`await sap.Z_MY_FUNCTION({ ... })`. A name with a namespace, `/ABC/MY_FUNCTION`,
is not a JavaScript method name: `await sap.send("/ABC/MY_FUNCTION", { ... })`.
The function module has to be remote-enabled.

### Worth knowing

- **A BAPI does not raise.** It reports in `RETURN` (`BAPIRET2`), and a message
  of type `E` or `A` means it did nothing — the sample checks it after every
  call. An exception is for what did not reach the BAPI at all: no connector,
  no logon, no authorization for the RFC.
- **Every user of the app calls with the RFC user's authorizations** — the SAP
  system checks the RFC user, not the one in front of the screen. For more than
  a demo, restrict the app with `cds.requires.cap2ui5.roles`, or use an RFC
  destination with principal propagation.
- **Classic RFC is not encrypted** without SNC — keep the connection inside a
  trusted network.
- **Dates arrive as ABAP keeps them**, `YYYYMMDD` (`DATS`), and `00000000` means
  none; the sample shows them as ISO dates.

## Tests

```bash
npm test             # both samples over the wire - against the mocks, and through the real protocols
npm run lint
```

The tests play the frontend's part — one POST per roundtrip, as
[cap2UI5/samples](https://github.com/cap2UI5/samples) does — in two files:

- [`test/samples.test.mjs`](test/samples.test.mjs) runs both samples against the
  mocks, as `cds watch` serves them, and checks every view they display with
  the [abap2UI5 linter](https://github.com/abap2UI5/linter): each control and
  property has to exist in UI5 1.71.
- [`test/remote.test.mjs`](test/remote.test.mjs) configures credentials, so
  nothing is mocked, and fakes only the far ends: an HTTP server that answers
  as S/4HANA's OData service, and a stand-in for the RFC connector below
  `@sap/cds-rfc`. What it asserts is what the systems would receive — the
  OData requests, the RFC parameters by kind.

## The learning path

|  | Repository | What you learn |
|---|---|---|
| 1️⃣ | [**cap2UI5/samples**](https://github.com/cap2UI5/samples) | the abap2UI5 basics as cap2UI5 apps — bindings, events, popups, navigation |
| 2️⃣ | **cap2UI5/samples-stack** — 📍 *you are here* | how cap2UI5 plays with your stack — OData services, function modules in SAP systems |

The same idea for ABAP is [abap2UI5/samples-stack](https://github.com/abap2UI5/samples-stack).
