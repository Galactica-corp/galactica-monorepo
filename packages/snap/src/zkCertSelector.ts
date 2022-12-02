import { ZkCert, ZkCertRequirements } from "./types";


export async function selectZkCert(availableCerts: ZkCert[], req: ZkCertRequirements): Promise<ZkCert> {
    if (availableCerts.length == 0) {
        throw new Error("No zkCerts available. Please import it first.");
    }

    let filteredCerts = availableCerts.filter((value) => {return value.zkCertStandard === req.zkCertStandard});

    if (filteredCerts.length == 0) {
        throw new Error(`No zkCerts of standard ${req.zkCertStandard} available. Please import it first.`);
    }
    
    let selectedCert : ZkCert;

    if (filteredCerts.length == 1) {
        selectedCert = filteredCerts[0];
    }
    else {
        // TODO: implement selection using snap_dialog
        throw new Error(`zkCerts selection not implemented yet`);
    }

    return selectedCert;
}
