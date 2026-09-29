# AGENTS.md — cap2UI5/samples-stack

The guide for this repository. Read it before changing anything.

## 1. What this repository is, and is not

cap2UI5 samples that need something **beyond a cap2UI5 installation**: a
remote system — an OData service, an SAP system reachable over RFC. It is
cap2UI5's counterpart of [abap2UI5/samples-stack](https://github.com/abap2UI5/samples-stack),
and the line is the same one: a sample that runs on cap2UI5 alone belongs in
[cap2UI5/samples](https://github.com/cap2UI5/samples), not here.

It is a **runnable CAP project, not an npm package**, unlike cap2UI5/samples.
A sample here is more than its app module: it needs its system's model in
`srv/external/` and its entry in `cds.requires`, and a package the plugin
loads apps from brings neither along.

What a sample shows is that calling another system from a cap2UI5 app is
**CAP's job**: an app is a CAP handler, and it reaches a system through CAP's
remote services — `cds.connect.to`, `cds.ql`, `cds.requires`. So a sample uses
CAP's own means and nothing of its own around them: no wrapper, no client
library of its own, no connection code in the app.

## 2. Layout

```
srv/apps/                 one sample, one file. The plugin loads EVERY .js here as an app
                          module, so nothing else goes here - no shared helpers
srv/external/             the remote systems:
  <SERVICE>.cds             the model - in the shape `cds import` writes (§5)
  <SERVICE>.js              its mock, where rows are not enough (an RFC service)
  data/<SERVICE>-*.csv      its mock's rows (an OData service)
test/
  server.mjs              the project served in-process, and the abap2UI5 wire
  samples.test.mjs        every sample against the mocks
  remote.test.mjs         every sample through the real protocols, far ends faked
  fixtures/               the faked far ends that are not HTTP servers
package.json              cds.requires - one entry per remote system
```

## 3. Naming

A sample is `Z2UI5_CL_CAPS_APP_<nnn>`, in `srv/apps/z2ui5_cl_caps_app_<nnn>.js`,
numbered in this repository. **`CAPS`, not `SMPS`**: numbers are handed out per
repository and the prefix is what qualifies them (abap2UI5/samples-stack's
rule), and the samples here have no ABAP original — they call CAP's remote
services, which ABAP does not have. `Z2UI5_CL_SMPS_APP_<nnn>` stays reserved
for a translation of an abap2UI5/samples-stack sample, which would keep its
original's name, as cap2UI5/samples keeps abap2UI5/samples'. Name a sample by
its class in prose, never by its number alone.

A remote service is named for what it is: an API by its own name, as `cds
import` names it (`API_BUSINESS_PARTNER`), a connection by what it reaches
(`SAP_RFC`). The name is the `cds.requires` key, the CDS service and the
production destination at once.

## 4. The rule every sample follows: mocked AND remote

- **It runs without the system.** `cds watch` (`--with-mocks`) mocks every
  remote service that has no credentials, and the sample works against the
  mock as it is — somebody without the system can still try it.
- **It runs against the system with credentials alone.** A `.env` file or a
  destination, and not a line of the sample changes. That is the point of the
  whole repository; a sample that needs an `if (mocked)` has missed it.
- **The mock behaves like the system where the sample depends on it.** The
  RFC mock reports a missing user in `RETURN` and sends dates as `YYYYMMDD`,
  because the ABAP system does; a mock that threw instead would teach the
  wrong error handling.
- **It is tested both ways** (§6): `samples.test.mjs` against the mock,
  `remote.test.mjs` through the protocol a real system is reached by, with
  only the far end faked — the assertions are about what the system would
  receive.
- **The screen says who answered** — the mock, a URL, a destination, a host —
  and never shows a credential.
- **No credential in the repository.** `.env`, `.cdsrc-private.json` and
  `default-env.json` are git-ignored; the README shows the keys, never values.

## 5. The model of a remote system

- **The shape `cds import` writes**, trimmed to what the samples use, with a
  header comment that says so and how to import the whole interface. A reader
  who imports the real thing must get a file that looks like the one here.
- **Names and types are the system's.** A property, a parameter, a DDIC field
  that the system does not have is a sample that fails against it while every
  test here is green. Take them from the service's metadata or the function
  module's interface, never from memory alone.
- **An RFC service needs `"external": true` in `cds.requires`.** CAP's service
  factory calls the kind's implementation (`@sap/cds-rfc`) only for a service
  it knows as external, and the `rfc` kind does not say it is one - without
  the flag CAP prefers `<SERVICE>.js` next to the model, the mock, even with
  credentials configured. `remote.test.mjs` fails if the flag goes.
- **An RFC service keeps `@protocol: 'rfc'`** (the importer writes it). CAP
  knows no such protocol, so it serves the mock without an HTTP endpoint and
  logs `ignoring unknown protocol: rfc` - which is the point: without the
  annotation the mocked BAPIs would be callable over OData by anybody who can
  reach the server.

## 6. Build and verify

```sh
npm install
npm run lint         # eslint: no-undef and no-unused-vars, nothing else
npm test             # node --test test/*.test.mjs
```

CI (`.github/workflows/test.yml`) runs exactly these, on the Node.js version of
`.nvmrc`, without a lockfile - as cap2UI5 and cap2UI5/samples do, the run tests
what an install gets today.

- The tests play the frontend's part, one POST per roundtrip (`test/server.mjs`,
  the same wire as cap2UI5/samples). `serve( )` passes `--with-mocks`: a
  service with credentials is called, one without is mocked.
- **Every view and popup a sample displays goes through the abap2UI5 linter's
  property gate** (`ui5Findings( )`, `@abap2ui5/linter`): every control,
  property, aggregation and event against the UI5 metadata at 1.71, the
  release the abap2UI5 family supports. A property that does not exist is not
  an error in the browser - it renders as nothing - so this is the one place
  it shows. The linter's render gate needs a browser and stays out of
  `npm test`; run it by hand on the XML when a view changes shape.
- `remote.test.mjs` gives both services credentials before the server starts,
  answers OData from an HTTP server in the test process, and points
  `@sap-rfc/node-rfc-library` - the connector `@sap/cds-rfc` loads - at
  `test/fixtures/node-rfc-library.cjs` with `module.registerHooks`
  (Node.js ≥ 22.15). The stand-in implements what `@sap/cds-rfc` uses of the
  connector and nothing more; if a new `@sap/cds-rfc` needs more, the test
  says so.
- **Do not call `cds.test.log( )` in a test that serves `SAP_RFC` mocked.** CAP
  skips an unknown protocol by returning what the logger's `warn( )` returns -
  nothing, until the log is captured; captured, the warning itself is kept as
  an endpoint and the server does not start ("Cannot find impl for protocol
  adapter: undefined").

## 7. A sample's file

- **The header** is the cap2UI5/samples one: `// @keywords` (what somebody
  would type who does not know the sample exists), `// @summary` (one
  sentence), `// @docs` where a documentation page exists — then prose: what
  the sample demonstrates, and where the system comes from.
- **The view** is built with `z2ui5_cl_ui5_view_builder` in the house chain
  layout — one call per line, four spaces per tree level, `end( )` in the
  column of the `ele( )` it closes — as the translated samples of
  cap2UI5/samples write it. Page titles read `cap2UI5 - <Technology> - <What>`.
- **Every remote call is caught** and ends in a message box that says what
  happened; uncaught, the roundtrip answers `roundtrip failed` and the user
  learns nothing. A BAPI's `RETURN` is checked after every call — a BAPI
  reports there and does not raise.
- **The call is part of the roundtrip**, so the user waits for it: read once in
  `check_on_init( )`, again only on an event, never in the render branch.
- **Anything the frontend sends is input**: event arguments and bound values
  go into `cds.ql` as parameters and into RFC as values, never into query text.

## 8. When you add a sample

1. Check that it needs a remote system. If it does not, it belongs in
   cap2UI5/samples.
2. Name it `Z2UI5_CL_CAPS_APP_<next number>` (§3).
3. Its system: the model in `srv/external/` (§5), the `cds.requires` entry,
   the mock — rows in `srv/external/data/`, or `<SERVICE>.js` where rows are
   not enough.
4. Tests in both files (§6): what the sample shows, against the mock; what
   the system receives, in `remote.test.mjs`.
5. The README: a row in *Which sample do I need?*, and a section with how it
   works, how to connect the real system, and what is worth knowing.
6. `npm run lint && npm test`.

Commit messages say why. The history of this project is its evidence.
