import json
from tkinter.messagebox import NO
import ipfs_api
import base64
import argparse
import web3
import eth_abi


def download_abi() -> tuple:
    with open("abi/Factory.json") as f:
        factory = json.load(f)
    with open("abi/Lighthouse.json") as f:
        lighthouse = json.load(f)
    with open("abi/Liability.json") as f:
        liability = json.load(f)
    return factory["abi"], lighthouse["abi"], liability["abi"]


class Provider:
    def __init__(self, config_path: str) -> None:
        self.config: dict = self._read_configuration(config_path)
        self.w3 = web3.Web3(web3.Web3.HTTPProvider(self.config["http_node_provider"]))
        ipfs_api.pubsub_subscribe(self.config["ipfs_topic"], self.on_message)

    def _read_configuration(self, path: str) -> dict | None:
        """Internal method. Loads the configuration.
        :param config_path: Path to the configuration file.
        :return: Python dict with the config
        """

        try:
            with open(path) as f:
                content = f.read()
                config = json.loads(content)
                return config
        except Exception as e:
            print(f"Couldn't load the configuration file: {e}")

    def on_message(self, msg: dict) -> None:
        """IPFS Pubsub callback. Saves demand and offer."""

        if msg["senderID"] == self.config["ipfs_id_dapp"]:
            self.demand = json.loads(msg["data"].decode("utf-8"))
        elif msg["senderID"] == self.config["ipfs_id_agent"]:
            self.offer = json.loads(msg["data"].decode("utf-8"))
        self.check_pair_messages()

    def check_pair_messages(self):
        """Creates liability if the demand and the offer are matched"""
        if self.demand and self.offer:
            if (
                (self.demand["model"] == self.offer["model"])
                and (self.demand["objective"] == self.offer["objective"])
                and (self.demand["deadline"] > self.w3.eth.get_block("latest"))
            ):
                self.factory_abi, self.lighthouse_abi, self.liability = download_abi()
                self.create_liability()

    def _encode_parameters(self, msg: dict) -> bytes:
        return eth_abi.encode(
            ["bytes", "bytes", "address", "uint256", "address", "address", "uint256", "uint256", "address", "bytes"],
            [
                msg.model,
                msg.objective,
                msg.token,
                msg.cost,
                msg.validator,
                msg.lighthouse,
                msg.lighthouseFee,
                msg.deadline,
                msg.sender,
                msg.signature.signature,
            ],
        )

    def create_liability(self) -> None:
        """Creates liability."""
        
        lighthouse = self.w3.eth.contract(address=self.config["lighthouse_contract_address"], abi=self.lighthouse_abi)
        factory = self.w3.eth.contract(address=self.config["factory_contract_address"], abi=self.factory_abi)
        encoded_demand = self._encode_parameters(self.demand)
        encoded_demand = self._encode_parameters(self.offer)

        tx = lighthouse.functions.createLiability(encoded_demand, encoded_demand).buildTransaction(
            {"from": self.config["provider_address"], "gas": 1000000000}
        )
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.config["provider_pk"])
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)


def run() -> None:
    """Main function of the script. Read config path as argument from command line."""

    parser = argparse.ArgumentParser(description="Add config path.")
    parser.add_argument("config_path", type=str, help="config path")
    args = parser.parse_args()
    Provider(args.config_path)


if __name__ == "__main__":
    run()
