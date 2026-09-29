// A stand-in for @sap-rfc/node-rfc-library, the connector @sap/cds-rfc talks
// RFC through - the part of it @sap/cds-rfc uses and nothing more: RFCClient,
// open( credentials ) and a connection that executes, commits and closes.
// remote.test.mjs points the module id here (module.registerHooks), so the
// sample's calls run through @sap/cds-rfc exactly as against a system, and
// what arrives here is what the system would have received.
//
// Every call is recorded in globalThis.__rfc for the test to read - of the
// credentials the names and the address, never the password.
const calls = (globalThis.__rfc ??= []);

const bapiret2 = (TYPE, MESSAGE) => ({ TYPE, ID: "01", NUMBER: "124", MESSAGE });

// the answers of an ABAP system, DATS as it sends them: YYYYMMDD
const ANSWERS = {
  BAPI_USER_GETLIST: ({ table }) => ({
    ROWS:            1,
    SELECTION_RANGE: table.SELECTION_RANGE ?? [],
    USERLIST:        [{ USERNAME: "DEVELOPER", FIRSTNAME: "", LASTNAME: "Developer", FULLNAME: "Developer" }],
    RETURN:          [],
  }),
  BAPI_USER_GET_DETAIL: ({ import: { USERNAME } }) => (USERNAME !== "DEVELOPER"
    ? { LOGONDATA: {}, ADDRESS: {}, ISLOCKED: {}, ACTIVITYGROUPS: [],
        RETURN: [bapiret2("E", `User ${USERNAME} does not exist`)] }
    : { LOGONDATA:      { GLTGV: "20240101", GLTGB: "00000000", USTYP: "A", CLASS: "DEVELOPER" },
        ADDRESS:        { FIRSTNAME: "", LASTNAME: "Developer", FULLNAME: "Developer", DEPARTMENT: "IT",
                          FUNCTION: "ABAP Developer", TEL1_NUMBR: "", E_MAIL: "developer@example.com" },
        ISLOCKED:       { WRNG_LOGON: "U", LOCAL_LOCK: "U", GLOB_LOCK: "U", NO_USER_PW: "U" },
        ACTIVITYGROUPS: [{ AGR_NAME: "Z_ABAP_DEVELOPER", FROM_DAT: "20240101", TO_DAT: "99991231",
                           AGR_TEXT: "Develop in ABAP", ORG_FLAG: "" }],
        RETURN:         [] }),
};

class RFCClient {
  async open({ ashost, sysnr, client, lang, ...rest }) {
    calls.push({ open: { ashost, sysnr, client, lang, also: Object.keys(rest).sort() } });
    return {
      async execute(name, params) {
        calls.push({ execute: name, params });
        return ANSWERS[name](params);
      },
      async commit() { calls.push({ commit: true }); },
      async rollback() { calls.push({ rollback: true }); },
      async close() { calls.push({ close: true }); },
    };
  }
}

module.exports = { RFCClient };
