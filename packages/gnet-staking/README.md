# GNET staking

Smart contract and operational scripts for GNET staking.

## License

The VotingEscrow contracts and their associated tests are licensed under AGPL-3.0-or-later, as they are forked from https://github.com/BarnBridge/veToken. All other code in this package is licensed under GPL-3.0-or-later.

## Setup

```shell
yarn install
```

## Test

```shell
yarn hardhat test
```

## Deploy

To deploy everything, use the `Staking.m.ts` module.

```shell
yarn hardhat ignition deploy ./ignition/modules/Staking.m.ts --network cassiopeia --verify
```

## Verify

If the contracts were not verified during the deployment with `--verify`, you can also run it in retrospect with the following command (exchange the chainId with the one you want to verify):

```shell
yarn hardhat ignition verify <deployment-id>
```

## Update staking schedule

To add an emission period to the staking contract schedule, you can use the following command.
The `rewards-per-second` argument is the reward per second in wei of the reward token.

```shell
yarn hardhat stakingUpdate --checkpoint "2025-01-03T00:00:00.000Z" --rewards-per-second 42 --network cassiopeia
```
