import { buildEddsa } from "circomlibjs";

import { ZkCert, ZkCertRequirements } from "./types";
import { MerkleProof, ZKCertificate } from "zkkyc";


export async function selectZkCert(availableCerts: ZkCert[], req: ZkCertRequirements): Promise<ZKCertificate> {
    if (availableCerts.length == 0) {
        throw new Error("No zkCerts available. Please import it first.");
    }

    let filteredCerts = availableCerts.filter((value) => {return value.zkCertStandard === req.zkCertStandard});

    if (filteredCerts.length == 0) {
        throw new Error(`No zkCerts of standard ${req.zkCertStandard} available. Please import it first.`);
    }
    
    let selected : ZkCert;

    if (filteredCerts.length == 1) {
        selected = filteredCerts[0];
    }
    else {
        // TODO: implement selection using snap_dialog
        throw new Error(`zkCerts selection not implemented yet`);
    }

    const eddsa = await buildEddsa();
    const zkCert = new ZKCertificate(
        selected.holderCommitment,
        selected.zkCertStandard,
        eddsa,
        selected.randomSalt,
        selected.content,
        selected.providerData,
    );

    return zkCert;
}
