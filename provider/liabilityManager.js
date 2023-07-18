import MSG_TYPES from "../consts/constants"

class LiabilityManager {
  constructor(config, ipfsHelper, web3Helper, pinataHelper) {
    this.config = config;
    this.ipfsHelper = ipfsHelper;
    this.web3Helper = web3Helper;
    this.pinataHelper = pinataHelper;
    this.liabilityAddress = '';

    this.createLiability = this.createLiability.bind(this);
    this.finalizeLiability = this.finalizeLiability.bind(this);
    this.minNFT = this.minNFT.bind(this);
  }

  async createLiability(demand, offer) {
    const d_encoded = this.web3Helper.encodeParameters(MSG_TYPES, 
      [demand.model
        , demand.objective
        , demand.token
        , demand.cost
        , demand.lighthouse
        , demand.validator
        , demand.validatorFee
        , demand.deadline
        , demand.sender
        , demand.signature.signature
    ])
    const o_encoded = this.encodeParameters(MSG_TYPES, 
      [offer.model
        , offer.objective
        , offer.token
        , offer.cost
        , offer.validator
        , offer.lighthouse
        , offer.lighthouseFee
        , offer.deadline
        , offer.sender
        , offer.signature.signature
    ])
    this.lighthouse = await this.web3Helper.getLighthouse(this.config.lighthouse_contract_address)
    const nonce = await this.web3Helper.getTransactionCount(this.config.providerAddress)
    try {
      let tx = await this.lighthouse.methods.createLiability(d_encoded, o_encoded).send({ from: config.provider_address, gas: 1000000000, nonce: nonce })

      const liability_receipt = await this.web3Helper.getTransactionReceipt(tx["transactionHash"])
      const liability_address_hex = liability_receipt["logs"][2]["topics"][1]
      const liability_address_dec = "0x" + liability_address_hex.slice(26)

      this.liabilityAddress = this.web3Helper.toChecksumAddress(liability_address_dec)
      console.log(`Liability address: ${this.liabilityAddress}`)

      return this.liabilityAddress

    } catch(error) {
        console.error("Couldn't create liability:")
        console.log(error)
      }
  }

  async finalizeLiability(resultHash) {
    console.log('Finalizing liability...');
    const result = {
      address: this.liabilityAddress,
      result: resultHash,
      success: true,
    };
    const hash = this.web3Helper.web3.utils.soliditySha3(
      { t: 'address', v: result.address },
      { t: 'bytes', v: this.web3Helper.w3.utils.toHex(result.result) },
      { t: 'bool', v: result.success }
    )
    const signature = await this.web3Helper.signMessage(hash, this.config.spot_pk)
    const nonce = await this.web3Helper.getTransactionCount(this.config.provider_address)

    try {
      const tx = await this.lighthouse.methods.finalizeLiability(result.address, this.web3Helper.web3.utils.toHex(result.result), result.success, signature.signature).send({
        from: this.config.provider_address,
        gas: 1000000000,
        nonce: nonce,
      })
      console.log(`Liability ${this.liabilityAddress} finalized! Tx hash: ${tx.transactionHash}`)
    } catch (error) {
      console.error("Couldn't finalize liability!")
      console.log(error)
    }

    await this.ipfsHelper.publish({ finalized: true }, this.config.ipfs_topic)
  }


  async minNFT(resultHash, demand) {
    console.log('Minting NFT....')
    const metadata = await this.ipfsHelper.createMetadata(resultHash)
    const { IpfsHash } = await this.pinataHelper.pinJSONToIPFS(metadata)

    const nft = new this.web3Helper.getNFTContract(this.config.nft_contract_address)
    const tokenURI = `${this.config.pinata_endpoint}${IpfsHash}`

    const nonce = await this.web3Helper.getTransactionCount(this.config.providerAddress)

    try {
      const tx = await nft.methods.mintNFT(demand.sender, tokenURI).send({
        from: this.config.provider_address,
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
}

export default LiabilityManager;