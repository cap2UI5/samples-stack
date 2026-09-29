// The part of SAP S/4HANA's OData V2 service API_BUSINESS_PARTNER that sample
// Z2UI5_CL_CAPS_APP_001 reads: two of its entity sets and the properties the
// sample selects, named and typed as in the service's $metadata and written
// the way `cds import` writes them. For the whole service, import its metadata
// instead - the EDMX from the SAP Business Accelerator Hub, or $metadata of
// your own system:
//
//   cds import API_BUSINESS_PARTNER.edmx --as cds --force
//
// The model is all CAP needs of a remote service. The remote service builds
// the OData requests from it, and cds watch MOCKS the service from it while no
// credentials are configured: the entities become tables of the in-memory
// database, filled from data/API_BUSINESS_PARTNER-*.csv.
@cds.external : true
service API_BUSINESS_PARTNER {

  @cds.external : true
  @cds.persistence.skip : true
  entity A_BusinessPartner {
    key BusinessPartner : String(10) not null;
    BusinessPartnerCategory : String(1);
    BusinessPartnerFullName : String(81);
    SearchTerm1 : String(20);
    @sap.display.format : 'Date'
    CreationDate : Date;
  };

  @cds.external : true
  @cds.persistence.skip : true
  entity A_BusinessPartnerAddress {
    key BusinessPartner : String(10) not null;
    key AddressID : String(10) not null;
    StreetName : String(60);
    HouseNumber : String(10);
    PostalCode : String(10);
    CityName : String(40);
    Country : String(3);
  };

};
