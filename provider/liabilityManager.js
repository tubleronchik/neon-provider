class LiabilityManager {
  constructor(config, ipfsHelper, web3Helper, pinataHelper) {
    this.config = config;
    this.ipfsHelper = ipfsHelper;
    this.web3Helper = web3Helper;
    this.pinataHelper = pinataHelper;
    this.liabilityAddress = '';
  }

  createLiability = async (demand, offer) => {
    const lighthouseABI = await this.ipfsHelper.downloadFile('abi/Lighthouse.json');
    const lighthouse = new this.web3Helper.web3.eth.Contract(lighthouseABI, this.config.lighthouse_contract_address);

    const dEncoded = this.encodeDemand(demand);
    const oEncoded = this.encodeOffer(offer);

    const nonce = await this.web3Helper.getTransactionCount(this.config.providerAddress, 'pending');

    try {
      const tx = await lighthouse.methods.createLiability(dEncoded, oEncoded).send({
        from: this.config.providerAddress,
        gas: 1000000000,
        nonce: nonce,
      });

      const liabilityReceipt = await this.web3Helper.getTransactionReceipt(tx.transactionHash);
      const liabilityAddressHex = liabilityReceipt.logs[2].topics[1];
      const liabilityAddressDec = '0x' + liabilityAddressHex.slice(26);
      this.liabilityAddress = this.web3Helper.web3.utils.toChecksumAddress(liabilityAddressDec);
      console.log(`Liability address: ${this.liabilityAddress}`);
      return this.liabilityAddress;
    } catch (error) {
      console.error("Couldn't create liability!");
      console.log(error);
    }
  }

  finalizeLiability = async (resultHash) => {
    console.log('Finalizing liability...');
    const result = {
      address: this.liabilityAddress,
      result: resultHash,
      success: true,
    };
    const hash = this.web3Helper.web3.utils.soliditySha3(
      { t: 'address', v: result.address },
      { t: 'bytes', v: this.web3Helper.web3.utils.toHex(result.result) },
      { t: 'bool', v: result.success }
    );
    const signature = await this.web3Helper.signMessage(hash);
    const nonce = await this.web3Helper.getTransactionCount(this.config.providerAddress, 'pending');

    try {
      const lighthouseABI = await this.ipfsHelper.downloadFile('abi/Lighthouse.json');
      const lighthouse = new this.web3Helper.web3.eth.Contract(lighthouseABI, this.config.lighthouse_contract_address);
      const tx = await lighthouse.methods.finalizeLiability(result.address, this.web3Helper.web3.utils.toHex(result.result), result.success, signature.signature).send({
        from: this.config.providerAddress,
        gas: 1000000000,
        nonce: nonce,
      });
      console.log(`Liability ${this.liabilityAddress} finalized! Tx hash: ${tx.transactionHash}`);
    } catch (error) {
      console.error("Couldn't finalize liability!");
      console.log(error);
    }

    await this.ipfsHelper.sendPubsubMsg({ finalized: true }, this.config.ipfs_topic);
  }

  async createMetadata(resultHash) {
    const output = await this.ipfsHelper.listFiles(resultHash);
    const fullPath = output[0];
    const img = `${this.config.pinata_endpoint}${fullPath}/AUSTIN.jpg`;
    const description = `${this.config.pinata_endpoint}${fullPath}`;
    const metadata = { description: description, image: img, name: 'SpotNFT' };
    return metadata;
  }

  minNFT = async (resultHash) => {
    console.log('Minting NFT....');
    const metadata = await this.createMetadata(resultHash);
    const { IpfsHash } = await this.pinataHelper.pinJSONToIPFS(metadata);
    const nftABI = await this.ipfsHelper.downloadFile('abi/SpotNFT.json');
    const nft = new this.web3Helper.web3.eth.Contract(nftABI, this.config.nft_contract_address);
    const tokenURI = `${this.config.pinata_endpoint}${IpfsHash}`;
    const nonce = await this.web3Helper.getTransactionCount(this.config.providerAddress, 'pending');

    try {
      const tx = await nft.methods.mintNFT(this.demand.sender, tokenURI).send({
        from: this.config.providerAddress,
        gas: 1000000000,
        nonce: nonce,
      });

      const receipt = await this.web3Helper.getTransactionReceipt(tx.transactionHash);
      const logs = receipt.logs;
      const tokenId = this.web3Helper.web3.utils.hexToNumber(logs[0].topics[3]);
      console.log(`NFT id: ${tokenId}`);
      return tokenId;
    } catch (error) {
      console.error("Couldn't mint NFT!");
      console.log(error);
    }
  }

  encodeDemand(demand) {
    return this.web3Helper.encodeParameters(
      [
        'bytes',
        'bytes',
        'address',
        'uint256',
        'address',
        'address',
        'uint256',
        'uint256',
        'address',
        'bytes',
      ],
      [
        demand.model,
        demand.objective,
        demand.token,
        demand.cost,
        demand.lighthouse,
        demand.validator,
        demand.validatorFee,
        demand.deadline,
        demand.sender,
        demand.signature.signature,
      ]
    );
  }

  encodeOffer(offer) {
    return this.web3Helper.encodeParameters(
      [
        'bytes',
        'bytes',
        'address',
        'uint256',
        'address',
        'address',
        'uint256',
        'uint256',
        'address',
        'bytes',
      ],
      [
        offer.model,
        offer.objective,
        offer.token,
        offer.cost,
        offer.validator,
        offer.lighthouse,
        offer.lighthouseFee,
        offer.deadline,
        offer.sender,
        offer.signature.signature,
      ]
    );
  }
}

export default LiabilityManager;