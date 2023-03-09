# Galactica Snap

This Metamask Snap adds Galactica Network features to Metamaks.
- Self custody for zero-knowledge certificates, such as zkKYC
- Generation of zero-knowledge proof on your local machine for compliance, selective disclosures and reputation proofs

For more details, check out https://galactica.com/

## Installation

- Install the Metamask Flask browser extention (Development version of Metamask): https://metamask.io/flask/
- As a user: Visit any dApp or website requiring Galactica's zero-knowledge features. There you can connect with Metamask and it will ask you for permission to install this Snap. It is identified with the name of this package on NPM `npm:@galactica-corp/snap`.
- As a developer: Integrate the galactica snap on your web front-end by using the snapId `npm:@galactica-corp/snap` in the [requestSnaps call](https://docs.metamask.io/guide/snaps-rpc-api.html#unrestricted-methods).
