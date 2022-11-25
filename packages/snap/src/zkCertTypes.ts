/**
 * Data specifically contained in zkKYC
 */
export type ZkKYCContent = {
    surname: string,
    forename : string,
    middleNames: [string],
    
    birthYear: string,
    birthMonth: string,
    birthDay: string,
    
    citizenship: string,

    verificationLevel: string,

    expirationDate: string,

    streetAndNumber: string,
    addressSupplement: string,
    postcode: string,
    town: string,
    region: string,
    country: string,
}
