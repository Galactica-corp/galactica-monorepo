import { ZkCert, ZkCertRequirements } from "./types";


export async function selectZkCert(availableCerts: ZkCert[], req: ZkCertRequirements): Promise<ZkCert> {
    if (availableCerts.length == 0) {
        throw new Error("No zkCerts available. Please import it first.");
    }

    const filteredCerts = availableCerts.filter((value, _i, _a) => {
        console.log("certs: ", JSON.stringify(value, null, 2));
        console.log("a1: ", value.zkCertStandard);
        console.log("a2: ", req.zkCertStandard);
        console.log("ac: ", value.zkCertStandard === req.zkCertStandard);
        return value.zkCertStandard === req.zkCertStandard
    });

    if (filteredCerts.length == 0) {
        throw new Error(`No zkCerts of standard ${req.zkCertStandard} available. Please import it first.`);
    }

    if (filteredCerts.length == 1) {
        return filteredCerts[0];
    }

    // TODO: implement selection using snap_dialog
    throw new Error(`zkCerts selection not implemented yet`);
}
