// @keywords odata remote service cds.connect.to cds.ql api_business_partner s4hana business partner mock
// @summary Reads business partners from SAP S/4HANA's OData service with cds.ql: CAP turns the query into the OData request - against a mock of the service while you develop, against the real one once credentials are configured.
// @docs https://cap2ui5.github.io/docs/examples/external-odata
//
// A cap2UI5 app is a CAP handler, so it calls an OData service the way every
// CAP handler does, and nothing in it is cap2UI5's own:
//
//   - the service's model is imported to srv/external/ (cds import),
//   - it is declared in package.json, as cds.requires.API_BUSINESS_PARTNER,
//   - and the app connects to it by that name and runs cds.ql against it.
//
// With credentials configured, a search for "Cust" leaves the process as
//
//   GET .../API_BUSINESS_PARTNER/A_BusinessPartner?$select=BusinessPartner,...
//       &$orderby=BusinessPartner&$top=20
//       &$filter=substringof('Cust',BusinessPartnerFullName)&$inlinecount=allpages
//
// Without them, cds watch MOCKS the service: it serves the same model from the
// in-memory database, filled from srv/external/data/ - so the sample runs as it
// is, and runs against your system without a changed line.
import cds from "@sap/cds";
import { defineApp, t, z2ui5_cl_ui5_view_builder } from "@cap2ui5/cds-plugin";

const { SELECT } = cds.ql;

const TOP = 20;                  // rows per search: $top

// A row as the service sends it. The names are the OData properties, and the
// view binds them uppercased: {BUSINESSPARTNERFULLNAME}.
const ty_s_partner = {
  BusinessPartner:         "",
  BusinessPartnerFullName: "",
  BusinessPartnerCategory: "",
  SearchTerm1:             "",
  CreationDate:            "",
};

const ty_s_address = {
  AddressID:   "",
  StreetName:  "",
  HouseNumber: "",
  PostalCode:  "",
  CityName:    "",
  Country:     "",
};

defineApp("Z2UI5_CL_CAPS_APP_001", class {

  search    = "";
  category  = "";                // BusinessPartnerCategory: 1 person, 2 organization, 3 group - "" all
  partners  = t.table(ty_s_partner);
  count     = 0;                 // every hit, not only the TOP shown
  source    = "(not connected)"; // what answered: the mock, a URL or a destination
  partner   = "";                // whose addresses the popup shows
  addresses = t.table(ty_s_address);

  async main(client) {

    this.client = client;

    if (client.check_on_init()) {
      await this.read_partners();
      this.view_display();

    } else if (client.check_on_navigated()) {
      this.view_display();

    } else if (client.check_on_event("SEARCH")) {
      await this.read_partners();

    } else if (client.check_on_event("ADDRESSES")) {
      await this.read_addresses(client.get_event_arg());
    }

  }

  // One query, written as against the project's own database. The remote
  // service translates it: columns to $select, where to $filter, orderBy to
  // $orderby, limit to $top, and count to $inlinecount.
  async read_partners() {

    try {

      const bupa = await cds.connect.to("API_BUSINESS_PARTNER");
      const { A_BusinessPartner } = bupa.entities;
      this.source = source_of(bupa);

      const query = SELECT.from(A_BusinessPartner)
          .columns("BusinessPartner", "BusinessPartnerFullName", "BusinessPartnerCategory", "SearchTerm1", "CreationDate")
          .orderBy("BusinessPartner")
          .limit(TOP);
      if (this.search) query.where`contains(BusinessPartnerFullName, ${this.search})`;
      if (this.category) query.where({ BusinessPartnerCategory: this.category });
      query.SELECT.count = true;

      const partners = await bupa.run(query);
      this.partners = partners;
      this.count    = partners.$count ?? partners.length;

    } catch (e) {
      // a remote service fails in ways the own database does not - say what happened
      this.client.message_box_display({ text: `Calling API_BUSINESS_PARTNER failed: ${e.message}`, type: "error" });
    }

  }

  async read_addresses(business_partner) {

    try {

      const bupa = await cds.connect.to("API_BUSINESS_PARTNER");
      const { A_BusinessPartnerAddress } = bupa.entities;

      this.addresses = await bupa.run(SELECT.from(A_BusinessPartnerAddress)
          .columns("AddressID", "StreetName", "HouseNumber", "PostalCode", "CityName", "Country")
          .where({ BusinessPartner: business_partner }));
      this.partner = this.partners.find((p) => p.BusinessPartner === business_partner)?.BusinessPartnerFullName
          ?? business_partner;
      this.popup_addresses();

    } catch (e) {
      this.client.message_box_display({ text: `Calling API_BUSINESS_PARTNER failed: ${e.message}`, type: "error" });
    }

  }

  view_display() {

    const view = z2ui5_cl_ui5_view_builder.factory()
        .ele({ n: "View", ns: "mvc" })
            .a({ n: "displayBlock", v: "true" })
            .a({ n: "height",       v: "100%" })
            .a({ n: "xmlns",        v: "sap.m" })
            .a({ n: "xmlns:mvc",    v: "sap.ui.core.mvc" })
            .a({ n: "xmlns:core",   v: "sap.ui.core" });
    const page = view.ele("Shell")
        .ele("Page")
            .a({ n: "title",          v: "cap2UI5 - OData - Business Partners from SAP S/4HANA" })
            .a({ n: "showNavButton",  b: this.client.check_app_prev_stack() })
            .a({ n: "navButtonPress", v: this.client._event_nav_app_leave() });

    page.tag("MessageStrip")
        .a({ n: "text",     v: "Read with cds.ql from the OData service API_BUSINESS_PARTNER - " +
                               `connected to ${this.client._bind("source")}` })
        .a({ n: "type",     v: "Information" })
        .a({ n: "showIcon", b: true })
        .a({ n: "class",    v: "sapUiSmallMargin" });

    const table = page.ele("Table")
        .a({ n: "items",      v: this.client._bind("partners") })
        .a({ n: "noDataText", v: "No business partner found" });

    const toolbar = table.ele("headerToolbar")
        .ele("OverflowToolbar");
    toolbar.tag("Title")
        .a({ n: "text", v: `Business Partners (${this.client._bind("count")})` });
    toolbar.tag("ToolbarSpacer");
    toolbar.ele("Select")
        .a({ n: "selectedKey", v: this.client._bind("category") })
        .a({ n: "change",      v: this.client._event("SEARCH") })
        .tag({ n: "Item", ns: "core" })
            .a({ n: "key",  v: "" })
            .a({ n: "text", v: "All Categories" })
        .tag({ n: "Item", ns: "core" })
            .a({ n: "key",  v: "1" })
            .a({ n: "text", v: "Person" })
        .tag({ n: "Item", ns: "core" })
            .a({ n: "key",  v: "2" })
            .a({ n: "text", v: "Organization" })
        .tag({ n: "Item", ns: "core" })
            .a({ n: "key",  v: "3" })
            .a({ n: "text", v: "Group" });
    toolbar.tag("SearchField")
        .a({ n: "value",       v: this.client._bind("search") })
        .a({ n: "search",      v: this.client._event("SEARCH") })
        .a({ n: "placeholder", v: "Name contains" })
        .a({ n: "width",       v: "16rem" });

    table.ele("columns")
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Business Partner" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Name" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Category" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Search Term" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Created On" });

    // a row press asks for that partner's addresses - a second request
    table.ele("items")
        .ele("ColumnListItem")
            .a({ n: "type",  v: "Navigation" })
            .a({ n: "press", v: this.client._event({ val: "ADDRESSES", arg: "${BUSINESSPARTNER}" }) })
            .ele("cells")
                .tag("Text")
                    .a({ n: "text", v: "{BUSINESSPARTNER}" })
                .tag("Text")
                    .a({ n: "text", v: "{BUSINESSPARTNERFULLNAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{= ${BUSINESSPARTNERCATEGORY} === '1' ? 'Person' : " +
                                       "${BUSINESSPARTNERCATEGORY} === '2' ? 'Organization' : 'Group' }" })
                .tag("Text")
                    .a({ n: "text", v: "{SEARCHTERM1}" })
                .tag("Text")
                    .a({ n: "text", v: "{CREATIONDATE}" });

    this.client.view_display(view.stringify());

  }

  popup_addresses() {

    const popup = z2ui5_cl_ui5_view_builder.factory()
        .ele({ n: "FragmentDefinition", ns: "core" })
            .a({ n: "xmlns",      v: "sap.m" })
            .a({ n: "xmlns:core", v: "sap.ui.core" });
    const dialog = popup.ele("Dialog")
        .a({ n: "title",        v: `Addresses - ${this.client._bind("partner")}` })
        .a({ n: "contentWidth", v: "40rem" });

    const table = dialog.ele("Table")
        .a({ n: "items",      v: this.client._bind("addresses") })
        .a({ n: "noDataText", v: "No address" });

    table.ele("columns")
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Street" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Postal Code" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "City" })
        .end()
        .ele("Column")
            .tag("Text")
                .a({ n: "text", v: "Country" });

    table.ele("items")
        .ele("ColumnListItem")
            .ele("cells")
                .tag("Text")
                    .a({ n: "text", v: "{STREETNAME} {HOUSENUMBER}" })
                .tag("Text")
                    .a({ n: "text", v: "{POSTALCODE}" })
                .tag("Text")
                    .a({ n: "text", v: "{CITYNAME}" })
                .tag("Text")
                    .a({ n: "text", v: "{COUNTRY}" });

    dialog.ele("buttons")
        .tag("Button")
            .a({ n: "text",  v: "Close" })
            .a({ n: "type",  v: "Emphasized" })
            .a({ n: "press", v: this.client.follow_up_action(this.client.cs_event.popup_close) });

    this.client.popup_display(popup.stringify());

  }
});

// What answers the queries - shown on the screen, so it is plain whether a
// search reached the mock or a system: a URL without user info and query, a
// destination by its name, and never a credential.
function source_of(srv) {
  if (srv.mocked) return `the mock of ${srv.name} - cds watch serves it while no credentials are configured`;
  const { url, destination } = srv.options.credentials ?? {};
  if (destination) return `destination ${destination}`;
  let u;
  try { u = new URL(url); } catch { return srv.name; }   // no url, or not one: the query's error says so
  return u.origin + u.pathname;
}
