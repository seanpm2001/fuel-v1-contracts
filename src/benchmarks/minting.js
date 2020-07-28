// 100k Points Claims One-off points burning
const { test, utils } = require('@fuel-js/environment');
const { chunk, pack, combine } = require('@fuel-js/struct');
const { bytecode, abi, errors } = require('../builds/Fuel.json');
const Proxy = require('../builds/Proxy.json');
const ERC20 = require('../builds/ERC20.json');
const { BlockHeader, RootHeader, Leaf,
    merkleTreeRoot, transactions, hashes } = require('@fuel-js/protocol/src/block');
const tx = require('@fuel-js/protocol/src/transaction');
const { Deposit } = require('@fuel-js/protocol/src/deposit');
const { defaults } = require('../tests/harness');
const ethers = require('ethers');
const gasPrice = require('@fuel-js/gasprice');
const rootDeployment = require('./produce');

module.exports = test('100k Points Claims', async t => { try {
  // attempt actual deployment
  if (process.env['fuel_v1_network']) {
    console.error('Benchmarking on network: ' + process.env['fuel_v1_network']);
    t.setProvider(ethers.getDefaultProvider(process.env['fuel_v1_network'], {
      infrua: process.env['fuel_v1_default_infura'],
    }));
    t.setPrivateKey(process.env['fuel_v1_default_operators'].split(',')[0]);
  }

  // set tx overrides object
  t.setOverrides({
    gasLimit: 6000000,
    gasPrice: (await gasPrice(t.getProvider())).safe,
  });

  const outputsPerDispersalTx = 8;
  const numberOfUsers = 100000;
  const transactionsToSimulate = numberOfUsers / outputsPerDispersalTx;
  const ethereumBlockSize = 8000000;
  let cumulativeGasUsed = utils.bigNumberify(0);

  const producer = t.getWallets()[0].address;
  const contract = await t.deploy(abi, bytecode,
      defaults(producer, utils.parseEther('.01')), t.getWallets()[0], t.getOverrides());

  let tokenId = '0x00';
  let transaction = await tx.Transaction({
    override: true,
    witnesses: [ t.getWallets()[0] ],
    metadata: [ tx.Metadata() ],
    data: [ tx.UTXO() ],
    inputs: [ tx.Input() ],
    outputs: [tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    }), tx.OutputTransfer({
      amount: utils.parseEther('5.0'),
      token: tokenId,
      owner: [producer],
    })],
    contract,
  });

  const transactions = (new Array(transactionsToSimulate))
    .fill(0)
    .map(() => transaction);

  const { rootHashes, gasUsed } = await rootDeployment(transactions, {
    provider: t.getProvider(),
    wallet: t.getWallets()[0],
    tokenId,
    operators: process.env['fuel_v1_default_seed']
      || ethers.Wallet.createRandom().signingKey.mnemonic,
    contract,
  });
  cumulativeGasUsed = cumulativeGasUsed.add(gasUsed);

  const _testReduction = (await t.getProvider().getNetwork()).name === 'unknown'
    ? 0
    : 7; // 7 blocks back
  const currentBlock = utils.bigNumberify(await t.getProvider().getBlockNumber()).sub(_testReduction);
  const currentBlockHash = (await t.getProvider().getBlock(currentBlock.toNumber())).hash;

  console.log('submitting at current block', currentBlock, currentBlockHash, _testReduction);

  // Block 1
  let block = await contract.commitBlock(currentBlock, currentBlockHash, 1, rootHashes.slice(0, 128), {
    ...t.getOverrides(),
    value: await contract.BOND_SIZE(),
  });
  block = await block.wait();

  // Block 2
  if (rootHashes.slice(128, 128 + 128).length) {
    block = await contract.commitBlock(currentBlock, currentBlockHash, 2, rootHashes.slice(128, 128 + 128), {
      ...t.getOverrides(),
      value: await contract.BOND_SIZE(),
    });
    block = await block.wait();
  }

  cumulativeGasUsed = cumulativeGasUsed.add(block.cumulativeGasUsed);

  t.ok(1, `Claims Processed: ${transactionsToSimulate * outputsPerDispersalTx}`);
  t.ok(1, `Transactions Submitted: ${transactionsToSimulate}`);
  t.ok(1, `Roots committed: ${rootHashes.length}`);
  t.ok(1, `Blocks committed: 2`);
  t.ok(1, `Cumulative gas used: ${cumulativeGasUsed.toString(rootHashes)}`);
  t.ok(1, `Ethereum blocks used: ${cumulativeGasUsed.div(ethereumBlockSize)}`);
  t.ok(1, `@$100 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(100)} USD`);
  t.ok(1, `@$50 USD per Block: $${cumulativeGasUsed.div(ethereumBlockSize).mul(50)} USD`);

} catch (error) { t.error(error, errors); } });
