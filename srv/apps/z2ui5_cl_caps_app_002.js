// @keywords rfc bapi function module fuba abap sap system cds-rfc node-rfc bapi_user_getlist bapi_user_get_detail bapiret2
// @summary Calls two BAPIs in an SAP system over RFC with @sap/cds-rfc - users with BAPI_USER_GETLIST, one user's details with BAPI_USER_GET_DETAIL - single values, structures and tables in both directions, errors from RETURN.
//
// To CAP, a function module of an SAP system is an action of a remote service,
// and that is what @sap/cds-rfc, SAP's RFC plugin for CAP, makes of it:
// srv/external/SAP_RFC.cds declares BAPI_USER_GETLIST and BAPI_USER_GET_DETAIL
// as actions of the service SAP_RFC, package.json declares the service as
// cds.requires.SAP_RFC (kind rfc), and the app calls a BAPI like a method:
//
//   const sap = await cds.connect.to("SAP_RFC");
//   const { ADDRESS, ACTIVITYGROUPS, RETURN } = await sap.BAPI_USER_GET_DETAIL({ USERNAME: "DEVELOPER" });
//
// The parameters go by their ABAP names: a single value is a value, a
// structure an object, a table an array of objects - in and out. That is
// node-rfc's client.call("BAPI_USER_GET_DETAIL", { USERNAME }), with the
// connection moved into CAP's configuration: an RFC destination on SAP BTP, a
// .env file on your machine - and a mock while you develop,
// srv/external/SAP_RFC.js, which cds watch serves while no credentials are
// configured. The README says how to connect a system.
import cds from "@sap/cds";
import { defineApp, t, z2ui5_cl_ui5_view_builder } from "@cap2ui5/cds-plugin";

const MAX_ROWS = 50;             // BAPI_USER_GETLIST's MAX_ROWS - 0 would mean all

// BAPILOGOND-USTYP
const USER_TYPES = { A: "Dialog", B: "System", C: "Communication", L: "Reference", S: "Service" };

// a row of USERLIST, BAPIUSNAME - the view binds {USERNAME}, {FULLNAME}, ...
const ty_s_user = {
  USERNAME:  "",
  FIRSTNAME: "",
  LASTNAME:  "",
  FULLNAME:  "",
};

// a row of ACTIVITYGROUPS, BAPIAGR - the dates as the view shows them
const ty_s_role = {
  AGR_NAME: "",
  AGR_TEXT: "",
  FROM_DAT: "",
  TO_DAT:   "",
};

defineApp("Z2UI5_CL_CAPS_APP_002", class {

  pattern = "*";                 // a user name - * and + are wildcards
  rows    = 0;                   // ROWS
  users   = t.table(ty_s_user);  // USERLIST
  source  = "(not connected)";   // what answered: the mock, a host or a destination
  user    = {                    // one user, from ADDRESS, LOGONDATA and ISLOCKED
    USERNAME:   "",
    FULLNAME:   "",
    DEPARTMENT: "",
    FUNCTION:   "",
    E_MAIL:     "",
    TEL1_NUMBR: "",
    USTYP:      "",
    CLASS:      "",
    GLTGV:      "",
    GLTGB:      "",
    LOCKED:     false,
  };
  roles   = t.table(ty_s_role);  // ACTIVITYGROUPS

  async main(client) {

    this.client = client;

    if (client.check_on_init()) {
      await this.read_users();
      this.view_display();

    } else if (client.check_on_navigated()) {
      this.view_display();

    } else if (client.check_on_event("SEARCH")) {
      await this.read_users();

    } else if (client.check_on_event("DETAIL")) {
      await this.read_user(client.get_event_arg());
    }

  }

  // BAPI_USER_GETLIST: two single values and a table in, a single value and
  // tables out. SELECTION_RANGE is a ranges table as ABAP knows it - SIGN,
  // OPTION, LOW, HIGH - and OPTION CP a pattern, as in a SELECT-OPTIONS.
  async read_users() {

    try {

      const sap = await cds.connect.to("SAP_RFC");
      this.source = source_of(sap);

      const pattern = this.pattern.trim().toUpperCase();   // user names are upper case
      const { ROWS, USERLIST, RETURN } = await sap.BAPI_USER_GETLIST({
          MAX_ROWS,
          WITH_USERNAME:   "X",                             // abap_true: the names too, not only the user IDs
          SELECTION_RANGE: pattern ? [ { PARAMETER: "USERNAME", SIGN: "I", OPTION: "CP", LOW: pattern } ] : [] });
      if (this.failed(RETURN)) return;

      this.rows  = ROWS;
      this.users = USERLIST;

    } catch (e) {
      // no connector, no logon, no authorization: the call itself failed
      this.client.message_box_display({ text: `Calling SAP_RFC failed: ${e.message}`, type: "error" });
    }

  }

  // BAPI_USER_GET_DETAIL: a single value in, structures and tables out.
  async read_user(username) {

    try {

      const sap = await cds.connect.to("SAP_RFC");

      const { ADDRESS, LOGONDATA, ISLOCKED, ACTIVITYGROUPS, RETURN } = await sap.BAPI_USER_GET_DETAIL({
          USERNAME: username });
      if (this.failed(RETURN)) return;

      this.user = {
        USERNAME:   username,
        FULLNAME:   ADDRESS.FULLNAME,
        DEPARTMENT: ADDRESS.DEPARTMENT,
        FUNCTION:   ADDRESS.FUNCTION,
        E_MAIL:     ADDRESS.E_MAIL,
        TEL1_NUMBR: ADDRESS.TEL1_NUMBR,
        USTYP:      USER_TYPES[LOGONDATA.USTYP] ?? LOGONDATA.USTYP,
        CLASS:      LOGONDATA.CLASS,
        GLTGV:      dats(LOGONDATA.GLTGV),
        GLTGB:      dats(LOGONDATA.GLTGB),
        LOCKED:     [ ISLOCKED.LOCAL_LOCK, ISLOCKED.GLOB_LOCK, ISLOCKED.WRNG_LOGON ].includes("L"),
      };
      this.roles = ACTIVITYGROUPS.map((r) => ({
        AGR_NAME: r.AGR_NAME,
        AGR_TEXT: r.AGR_TEXT,
        FROM_DAT: dats(r.FROM_DAT),
        TO_DAT:   dats(r.TO_DAT),
      }));
      this.popup_user();

    } catch (e) {
      this.client.message_box_display({ text: `Calling SAP_RFC failed: ${e.message}`, type: "error" });
    }

  }

  // A BAPI does not raise an exception: it reports in RETURN (BAPIRET2), and a
  // message of TYPE E or A means it did nothing. So every call checks it.
  failed(RETURN = []) {

    const errors = RETURN.filter((m) => m.TYPE === "E" || m.TYPE === "A");
    if (errors.length) {
      this.client.message_box_display({ text: errors.map((m) => m.MESSAGE).join("\n"), type: "error" });
    }
    return errors.length > 0;

  }

  view_display() {

    const view = z2ui5_cl_ui5_view_builder.factory()
        .ele({ n: "View", ns: "mvc" })
            .a({ n: "displayBlock", v: "true" })
            .a({ n: "height",       v: "100%" })
            .a({ n: "xmlns",        v: "sap.m" })
            .a({ n: "xmlns:mvc",    v: "sap.ui.core.mvc" });
    const page = view.ele("Shell")
        .ele("Page")
            .a({ n: "title",          v: "cap2UI5 - RFC - Call BAPIs in an SAP System" })
            .a({ n: "showNavButton",  b: this.client.check_app_prev_stack() })
            .a({ n: "navButtonPress", v: this.client._event_nav_app_leave() });

    page.tag("MessageStrip")
        .a({ n: "text",     v: "BAPI_USER_GETLIST and BAPI_USER_GET_DETAIL, called over RFC with @sap/cds-rfc - " +
                               `connected to ${this.client._bind("source")}` })
        .a({ n: "type",     v: "Information" })
        .a({ n: "showIcon", b: true })
        .a({ n: "class",    v: "sapUiSmallMargin" });

    const table = page.ele("Table")
        .a({ n: "items",      v: this.client._bind("users") })
        .a({ n: "noDataText", v: "No user found" });

    const toolbar = table.ele("headerToolbar")
        .ele("OverflowToolbar");
    toolbar.tag("Title")
        .a({ n: "text", v: `Users (${this.client._bind("rows")})` });
    toolbar.tag("ToolbarSpacer");
    toolbar.tag("SearchField")
        .a({ n: "value",       v: this.client._bind("pattern") })
        .a({ n: "search",      v: this.client._event("SEARCH") })
        .a({ n: "placeholder", v: "User name, * as wildcard" })
        .a({ n: "width",       v: "16rem" });

    table.ele("columns")
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "User" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Full Name" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "First Name" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Last Name" });

    // a row press reads that user in full - the second BAPI
    table.ele("items")
        .ele("ColumnListItem")
            .a({ n: "type",  v: "Navigation" })
            .a({ n: "press", v: this.client._event({ val: "DETAIL", arg: "${USERNAME}" }) })
            .ele("cells")
                .tag("Text")
                    .a({ n: "text", v: "{USERNAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{FULLNAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{FIRSTNAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{LASTNAME}" });

    this.client.view_display(view.stringify());

  }

  popup_user() {

    const popup = z2ui5_cl_ui5_view_builder.factory()
        .ele({ n: "FragmentDefinition", ns: "core" })
            .a({ n: "xmlns",      v: "sap.m" })
            .a({ n: "xmlns:core", v: "sap.ui.core" })
            .a({ n: "xmlns:form", v: "sap.ui.layout.form" });
    const dialog = popup.ele("Dialog")
        .a({ n: "title",        v: `User ${this.client._bind("user-USERNAME")}` })
        .a({ n: "contentWidth", v: "40rem" });

    // the export structures ADDRESS, LOGONDATA and ISLOCKED
    const form = dialog.ele({ n: "SimpleForm", ns: "form" })
        .a({ n: "editable", b: false })
        .a({ n: "layout",   v: "ResponsiveGridLayout" })
        .ele({ n: "content", ns: "form" });

    form.tag({ n: "Title", ns: "core" })
        .a({ n: "text", v: "Address" });
    form.tag("Label")
        .a({ n: "text", v: "Full Name" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-FULLNAME") });
    form.tag("Label")
        .a({ n: "text", v: "Department" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-DEPARTMENT") });
    form.tag("Label")
        .a({ n: "text", v: "Function" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-FUNCTION") });
    form.tag("Label")
        .a({ n: "text", v: "E-Mail" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-E_MAIL") });
    form.tag("Label")
        .a({ n: "text", v: "Telephone" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-TEL1_NUMBR") });

    form.tag({ n: "Title", ns: "core" })
        .a({ n: "text", v: "Logon Data" });
    form.tag("Label")
        .a({ n: "text", v: "User Type" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-USTYP") });
    form.tag("Label")
        .a({ n: "text", v: "User Group" });
    form.tag("Text")
        .a({ n: "text", v: this.client._bind("user-CLASS") });
    form.tag("Label")
        .a({ n: "text", v: "Valid From - To" });
    form.tag("Text")
        .a({ n: "text", v: `${this.client._bind("user-GLTGV")} - ${this.client._bind("user-GLTGB")}` });
    form.tag("Label")
        .a({ n: "text", v: "Status" });
    form.tag("ObjectStatus")
        .a({ n: "text",  v: `{= $${this.client._bind("user-LOCKED")} ? 'Locked' : 'Not locked' }` })
        .a({ n: "state", v: `{= $${this.client._bind("user-LOCKED")} ? 'Error' : 'Success' }` });

    // the table ACTIVITYGROUPS
    const table = dialog.ele("Table")
        .a({ n: "items",      v: this.client._bind("roles") })
        .a({ n: "noDataText", v: "No role" });

    table.ele("headerToolbar")
        .ele("Toolbar")
            .tag("Title")
                .a({ n: "text", v: "Roles" });

    table.ele("columns")
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Role" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Description" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Valid From" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Valid To" });

    table.ele("items")
        .ele("ColumnListItem")
            .ele("cells")
                .tag("Text")
                    .a({ n: "text", v: "{AGR_NAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{AGR_TEXT}" })
                .tag("Text")
                    .a({ n: "text", v: "{FROM_DAT}" })
                .tag("Text")
                    .a({ n: "text", v: "{TO_DAT}" });

    dialog.ele("buttons")
        .tag("Button")
            .a({ n: "text",  v: "Close" })
            .a({ n: "type",  v: "Emphasized" })
            .a({ n: "press", v: this.client.follow_up_action(this.client.cs_event.popup_close) });

    this.client.popup_display(popup.stringify());

  }
});

// A DATS value for the view: YYYYMMDD as ISO date, an initial one (00000000)
// as nothing. Connectors deliver DATS as the string ABAP keeps; whatever else
// arrives - an ISO date, a Date - is shown as a date as well.
function dats(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value ?? "");
  if (!/^\d{8}$/.test(s)) return s;
  return s === "00000000" ? "" : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}`;
}

// What answers the calls - shown on the screen, so it is plain whether a call
// reached the mock or a system: a destination by its name, a system by its
// host and client, and never user or password.
function source_of(srv) {
  if (srv.mocked) return `the mock of ${srv.name} - cds watch serves it while no credentials are configured`;
  const { destination, ashost, mshost, client } = srv.options.credentials ?? {};
  if (destination) return `destination ${destination}`;
  return `${ashost ?? mshost}, client ${client}`;
}
