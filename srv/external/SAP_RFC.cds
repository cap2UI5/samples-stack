// The RFC interface of an SAP system, as far as sample Z2UI5_CL_CAPS_APP_002
// calls it: two BAPIs that every ABAP system has, BAPI_USER_GETLIST and
// BAPI_USER_GET_DETAIL. Written in the shape `cds import --from rfc` writes -
// the function module is an action of the service, its import and table
// parameters are the action's parameters, and what it exports and returns in
// its tables is the result type - trimmed to the parameters and fields the
// sample uses. For a function module's whole interface, import it from your
// system (the connection as in the README, then):
//
//   cds import --from rfc --as cds --name BAPI_USER_GET_DETAIL --destination SAP_RFC --force
//
// @sap/cds-rfc passes the parameters an action declares - by their
// @RFCParameterType, as import, changing or table parameters - and the
// connector checks the values against the function module's interface in the
// system. So this model decides WHICH parameters the app can pass; a parameter
// it does not declare never reaches the system. While no credentials are
// configured, cds watch mocks the service with SAP_RFC.js next to this file.
@cds.external : true
@protocol : 'rfc'
service SAP_RFC {
  action BAPI_USER_GETLIST(
    /** Maximum Number of Lines of Hits */
    @RFCParameterType : 'Import'
    MAX_ROWS : Integer,
    /** Read User with Name */
    @RFCParameterType : 'Import'
    WITH_USERNAME : String(1),
    /** Search for Users with a Ranges Table */
    @RFCParameterType : 'Table'
    SELECTION_RANGE : many DDIC.BAPIUSSRGE,
    /** User List */
    @RFCParameterType : 'Table'
    USERLIST : many DDIC.BAPIUSNAME,
    /** Return Parameter */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2
  ) returns BAPI_USER_GETLIST.ResultType;

  type BAPI_USER_GETLIST.ResultType {
    /** No. of users selected */
    @RFCParameterType : 'Export'
    ROWS : Integer;
    /** Search for Users with a Ranges Table */
    @RFCParameterType : 'Table'
    SELECTION_RANGE : many DDIC.BAPIUSSRGE;
    /** User List */
    @RFCParameterType : 'Table'
    USERLIST : many DDIC.BAPIUSNAME;
    /** Return Parameter */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
  };

  action BAPI_USER_GET_DETAIL(
    /** User Name */
    @RFCParameterType : 'Import'
    USERNAME : String(12) not null,
    /** Activity Groups */
    @RFCParameterType : 'Table'
    ACTIVITYGROUPS : many DDIC.BAPIAGR,
    /** Return Structure */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2
  ) returns BAPI_USER_GET_DETAIL.ResultType;

  type BAPI_USER_GET_DETAIL.ResultType {
    /** Structure with Logon Data */
    @RFCParameterType : 'Export'
    LOGONDATA : DDIC.BAPILOGOND;
    /** Address Data */
    @RFCParameterType : 'Export'
    ADDRESS : DDIC.BAPIADDR3;
    /** User Lock */
    @RFCParameterType : 'Export'
    ISLOCKED : DDIC.BAPISLOCKD;
    /** Activity Groups */
    @RFCParameterType : 'Table'
    ACTIVITYGROUPS : many DDIC.BAPIAGR;
    /** Return Structure */
    @RFCParameterType : 'Table'
    RETURN : many DDIC.BAPIRET2;
  };

  type DDIC.BAPIUSSRGE {
    PARAMETER : String(32);
    FIELD : String(30);
    SIGN : String(1);
    OPTION : String(2);
    LOW : String(132);
    HIGH : String(132);
  };

  type DDIC.BAPIUSNAME {
    USERNAME : String(12);
    FIRSTNAME : String(40);
    LASTNAME : String(40);
    FULLNAME : String(80);
  };

  type DDIC.BAPIRET2 {
    TYPE : String(1);
    ID : String(20);
    @RFCAbapType : 'N'
    NUMBER : String(3);
    MESSAGE : String(220);
    LOG_NO : String(20);
    @RFCAbapType : 'N'
    LOG_MSG_NO : String(6);
    MESSAGE_V1 : String(50);
    MESSAGE_V2 : String(50);
    MESSAGE_V3 : String(50);
    MESSAGE_V4 : String(50);
    PARAMETER : String(32);
    ROW : Integer;
    FIELD : String(30);
    SYSTEM : String(10);
  };

  type DDIC.BAPILOGOND {
    GLTGV : Date;
    GLTGB : Date;
    USTYP : String(1);
    CLASS : String(12);
  };

  type DDIC.BAPIADDR3 {
    FIRSTNAME : String(40);
    LASTNAME : String(40);
    FULLNAME : String(80);
    DEPARTMENT : String(40);
    FUNCTION : String(40);
    TEL1_NUMBR : String(30);
    E_MAIL : String(241);
  };

  type DDIC.BAPISLOCKD {
    WRNG_LOGON : String(1);
    LOCAL_LOCK : String(1);
    GLOB_LOCK : String(1);
    NO_USER_PW : String(1);
  };

  type DDIC.BAPIAGR {
    AGR_NAME : String(30);
    FROM_DAT : Date;
    TO_DAT : Date;
    AGR_TEXT : String(80);
    ORG_FLAG : String(1);
  };
};
