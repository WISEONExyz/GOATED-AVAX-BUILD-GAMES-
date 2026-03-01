# Avalanche Bounty Marketplace Starter

Starter codebase for a decentralized bounty marketplace on Avalanche C-Chain (Fuji testnet).

## What is included

- `BountyFactory` contract that deploys and indexes `Bounty` contracts
- `Bounty` contract with:
  - bounty metadata (title, description, reward, deadline)
  - AVAX escrow on creation
  - contributor submissions by URI (IPFS/Arweave/etc.)
  - poster approval flow
  - automatic payout to winner
  - poster cancel flow only when submission count is zero
- Solidity events:
  - `BountyCreated`
  - `SubmissionAdded`
  - `WinnerSelected`
  - `FundsReleased`
  - `BountyCanceled`
- Hardhat Fuji network config
- React + Ethers frontend with Core Wallet and WalletConnect

## Environment variables

Root `.env` (copy from `.env.example`):

```bash
PRIVATE_KEY=0xyour_deployer_private_key
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=your_snowtrace_key
```

Frontend `frontend/.env` (copy from `frontend/.env.example`):

```bash
VITE_FACTORY_ADDRESS=0xYourDeployedFactoryAddress
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## Commands

```bash
# root
npm install
npm run compile
npm test
npm run deploy:fuji

# frontend
cd frontend
npm install
npm run dev
```

## Avalanche best practices

- Use separate deployer wallets for testnet and mainnet.
- Never commit `.env` files or private keys.
- Verify network/chain ID before transacting (`43113` Fuji, `43114` Mainnet).
- Verify contracts on Snowtrace after deployment.
- Keep reentrancy protections and stricter input limits for production hardening.
