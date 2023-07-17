class MessageHandler {
    constructor(config, ipfsHelper, web3Helper, pinataHelper, liabilityManager) {
      this.config = config;
      this.ipfsHelper = ipfsHelper;
      this.web3Helper = web3Helper;
      this.pinataHelper = pinataHelper;
      this.liabilityManager = liabilityManager;
      this.demand = {};
      this.offer = {};
      this.ipfsHelper.subscribe(this.config.ipfs_topic, this.onMsg.bind(this));
    }
  
    onMsg = async (msg) => {
      const stringMsg = String.fromCharCode(...Array.from(msg.data));
      const jsonMsg = JSON.parse(stringMsg);
  
      if (msg.from === this.config.ipfs_id_dapp) {
        this.demand = jsonMsg;
        await this.checkPairMsgs();
      } else if (msg.from === this.config.ipfs_id_agent) {
        if (jsonMsg.result) {
          const resultHash = jsonMsg.result;
          await this.liabilityManager.minNFT(resultHash);
          await this.liabilityManager.finalizeLiability(resultHash);
          return;
        } else {
          this.offer = jsonMsg;
          await this.checkPairMsgs();
        }
      }
    }
  
    checkPairMsgs = async () => {
      if (this.demand && this.offer) {
        const blockNumber = await this.web3Helper.getBlockNumber();
        const demandModel = this.demand.model;
        const offerModel = this.offer.model;
        const demandObjective = this.demand.objective;
        const offerObjective = this.offer.objective;
  
        if (demandModel === offerModel && demandObjective === offerObjective && this.demand.deadline > blockNumber) {
          await this.liabilityManager.createLiability(this.demand, this.offer);
          await this.sendPubsubMsg({ liability: this.liabilityManager.liabilityAddress }, this.config.ipfs_topic);
        }
      }
    }
  
    sendPubsubMsg = async (msg, topic) => {
      const jsonMsg = JSON.stringify(msg);
      await this.ipfsHelper.publish(topic, jsonMsg);
    }
}

export default MessageHandler;