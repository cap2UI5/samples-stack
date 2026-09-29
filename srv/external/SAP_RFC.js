// SAP_RFC, mocked: what CAP serves in place of the SAP system while no
// credentials are configured - in cds watch and in the tests. CAP finds it the
// way it finds any service implementation, by its name next to the model
// (SAP_RFC.cds), and it answers the two BAPIs of sample Z2UI5_CL_CAPS_APP_002
// the way an ABAP system does: the same parameters and tables, dates as DATS
// (YYYYMMDD), and a failure in RETURN rather than as an exception - over a
// handful of made-up users.
//
// CAP takes this file ONLY while the service is mocked. With credentials
// configured, @sap/cds-rfc calls the system instead - which is what
// `"external": true` in cds.requires.SAP_RFC (package.json) is for: the rfc
// kind does not declare itself external, and without the flag CAP would keep
// choosing this file over the connector, whatever the credentials say.
import cds from "@sap/cds";

const USERS = [
  { USERNAME: "ASCHMIDT", FIRSTNAME: "Anna", LASTNAME: "Schmidt", FULLNAME: "Anna Schmidt",
    DEPARTMENT: "Sales", FUNCTION: "Sales Representative", TEL1_NUMBR: "+49 6227 100", E_MAIL: "anna.schmidt@example.com",
    USTYP: "A", CLASS: "SALES", GLTGV: "20220301", GLTGB: "00000000", LOCK: "",
    ROLES: [
      { AGR_NAME: "Z_SALES_ORDERS",  AGR_TEXT: "Process sales orders", FROM_DAT: "20220301", TO_DAT: "99991231" },
      { AGR_NAME: "Z_CUSTOMERS_DSP", AGR_TEXT: "Display customers",    FROM_DAT: "20220301", TO_DAT: "99991231" },
    ] },
  { USERNAME: "BATCH_JOBS", FIRSTNAME: "", LASTNAME: "Batch Jobs", FULLNAME: "Batch Jobs",
    DEPARTMENT: "IT", FUNCTION: "", TEL1_NUMBR: "", E_MAIL: "",
    USTYP: "B", CLASS: "SYSTEM", GLTGV: "20190101", GLTGB: "00000000", LOCK: "",
    ROLES: [
      { AGR_NAME: "Z_BACKGROUND_JOBS", AGR_TEXT: "Run background jobs", FROM_DAT: "20190101", TO_DAT: "99991231" },
    ] },
  { USERNAME: "DEVELOPER", FIRSTNAME: "", LASTNAME: "Developer", FULLNAME: "Developer",
    DEPARTMENT: "IT", FUNCTION: "ABAP Developer", TEL1_NUMBR: "+49 6227 200", E_MAIL: "developer@example.com",
    USTYP: "A", CLASS: "DEVELOPER", GLTGV: "20240101", GLTGB: "00000000", LOCK: "",
    ROLES: [
      { AGR_NAME: "Z_ABAP_DEVELOPER", AGR_TEXT: "Develop in ABAP",    FROM_DAT: "20240101", TO_DAT: "99991231" },
      { AGR_NAME: "Z_DISPLAY_ALL",    AGR_TEXT: "Display everything", FROM_DAT: "20240101", TO_DAT: "20261231" },
    ] },
  { USERNAME: "JMILLER", FIRSTNAME: "John", LASTNAME: "Miller", FULLNAME: "John Miller",
    DEPARTMENT: "Purchasing", FUNCTION: "Purchaser", TEL1_NUMBR: "+1 312 555 0188", E_MAIL: "john.miller@example.com",
    USTYP: "A", CLASS: "PURCHASING", GLTGV: "20220302", GLTGB: "20261231", LOCK: "LOCAL_LOCK",
    ROLES: [
      { AGR_NAME: "Z_PURCHASE_ORDERS", AGR_TEXT: "Process purchase orders", FROM_DAT: "20220302", TO_DAT: "20261231" },
    ] },
  { USERNAME: "KTANAKA", FIRSTNAME: "Kenji", LASTNAME: "Tanaka", FULLNAME: "Kenji Tanaka",
    DEPARTMENT: "Finance", FUNCTION: "Accountant", TEL1_NUMBR: "+81 3 5555 0142", E_MAIL: "kenji.tanaka@example.com",
    USTYP: "A", CLASS: "FINANCE", GLTGV: "20240214", GLTGB: "00000000", LOCK: "WRNG_LOGON",
    ROLES: [
      { AGR_NAME: "Z_GL_ACCOUNTING", AGR_TEXT: "General ledger accounting", FROM_DAT: "20240214", TO_DAT: "99991231" },
    ] },
  { USERNAME: "MGARCIA", FIRSTNAME: "Maria", LASTNAME: "Garcia", FULLNAME: "Maria Garcia",
    DEPARTMENT: "Sales", FUNCTION: "Sales Manager", TEL1_NUMBR: "+34 91 555 0123", E_MAIL: "maria.garcia@example.com",
    USTYP: "A", CLASS: "SALES", GLTGV: "20231120", GLTGB: "00000000", LOCK: "",
    ROLES: [
      { AGR_NAME: "Z_SALES_ORDERS",  AGR_TEXT: "Process sales orders", FROM_DAT: "20231120", TO_DAT: "99991231" },
      { AGR_NAME: "Z_SALES_MANAGER", AGR_TEXT: "Approve sales orders", FROM_DAT: "20231120", TO_DAT: "99991231" },
    ] },
  { USERNAME: "RFC_CAP", FIRSTNAME: "", LASTNAME: "RFC User for CAP", FULLNAME: "RFC User for CAP",
    DEPARTMENT: "IT", FUNCTION: "", TEL1_NUMBR: "", E_MAIL: "",
    USTYP: "C", CLASS: "SYSTEM", GLTGV: "20250101", GLTGB: "00000000", LOCK: "",
    ROLES: [
      { AGR_NAME: "Z_RFC_USER_DISPLAY", AGR_TEXT: "Read users over RFC", FROM_DAT: "20250101", TO_DAT: "99991231" },
    ] },
];

export default class SAP_RFC extends cds.ApplicationService {

  init() {

    // MAX_ROWS 0 means all; USERLIST carries the names only WITH_USERNAME = X.
    // Of SELECTION_RANGE the mock reads PARAMETER USERNAME - the real BAPI
    // reads every parameter of BAPI_USER_GET_DETAIL (ADDRESS, LOGONDATA, ...).
    this.on("BAPI_USER_GETLIST", (req) => {
      const { MAX_ROWS = 0, WITH_USERNAME = "", SELECTION_RANGE = [] } = req.data;
      const ranges = SELECTION_RANGE.filter((r) => r.PARAMETER === "USERNAME");
      const hits = USERS.filter((u) => in_range(u.USERNAME, ranges)).slice(0, MAX_ROWS > 0 ? MAX_ROWS : undefined);
      return {
        ROWS:            hits.length,
        SELECTION_RANGE,
        USERLIST:        hits.map((u) => ({
          USERNAME:  u.USERNAME,
          FIRSTNAME: WITH_USERNAME === "X" ? u.FIRSTNAME : "",
          LASTNAME:  WITH_USERNAME === "X" ? u.LASTNAME : "",
          FULLNAME:  WITH_USERNAME === "X" ? u.FULLNAME : "",
        })),
        RETURN:          [],
      };
    });

    // An unknown user is not an exception: the export structures stay initial
    // and RETURN says why, as the ABAP system answers it.
    this.on("BAPI_USER_GET_DETAIL", (req) => {
      const u = USERS.find((user) => user.USERNAME === req.data.USERNAME);
      if (!u) {
        return {
          LOGONDATA:      {},
          ADDRESS:        {},
          ISLOCKED:       {},
          ACTIVITYGROUPS: [],
          RETURN:         [bapiret2("E", "01", "124", `User ${req.data.USERNAME} does not exist`, req.data.USERNAME)],
        };
      }
      const lock = (flag) => (u.LOCK === flag ? "L" : "U");
      return {
        LOGONDATA:      { GLTGV: u.GLTGV, GLTGB: u.GLTGB, USTYP: u.USTYP, CLASS: u.CLASS },
        ADDRESS:        { FIRSTNAME: u.FIRSTNAME, LASTNAME: u.LASTNAME, FULLNAME: u.FULLNAME, DEPARTMENT: u.DEPARTMENT,
                          FUNCTION: u.FUNCTION, TEL1_NUMBR: u.TEL1_NUMBR, E_MAIL: u.E_MAIL },
        ISLOCKED:       { WRNG_LOGON: lock("WRNG_LOGON"), LOCAL_LOCK: lock("LOCAL_LOCK"), GLOB_LOCK: lock("GLOB_LOCK"), NO_USER_PW: "U" },
        ACTIVITYGROUPS: u.ROLES.map((r) => ({ ...r, ORG_FLAG: "" })),
        RETURN:         [],
      };
    });

    return super.init();
  }

}

// SELECTION_RANGE for one parameter, as ABAP evaluates a range: included when
// an I row matches (or there is none), unless an E row matches. OPTION EQ, NE,
// BT and CP - * for any string, + for one character.
function in_range(value, ranges) {
  const hit = ({ OPTION, LOW = "", HIGH = "" }) => {
    switch (OPTION) {
      case "EQ": return value === LOW;
      case "NE": return value !== LOW;
      case "BT": return value >= LOW && value <= HIGH;
      case "CP": return new RegExp(`^${LOW.replace(/[.*+?^${}()|[\]\\]/g,
        (c) => (c === "*" ? ".*" : c === "+" ? "." : `\\${c}`))}$`).test(value);
      default:   return false;
    }
  };
  const including = ranges.filter((r) => r.SIGN !== "E");
  const excluding = ranges.filter((r) => r.SIGN === "E");
  return (!including.length || including.some(hit)) && !excluding.some(hit);
}

// one row of BAPIRET2, the return structure every BAPI reports in
function bapiret2(TYPE, ID, NUMBER, MESSAGE, MESSAGE_V1 = "") {
  return { TYPE, ID, NUMBER, MESSAGE, LOG_NO: "", LOG_MSG_NO: "000000", MESSAGE_V1, MESSAGE_V2: "", MESSAGE_V3: "",
           MESSAGE_V4: "", PARAMETER: "", ROW: 0, FIELD: "", SYSTEM: "" };
}
