# PierChat

<p align="center">
  <img src="https://github.com/vicenterendo/PierChat/assets/76400414/3f302c08-98c5-4f17-aeaa-fb2d33cd2c4e" />
</p>

<!-- <p align="center">
  <img src="https://github.com/vicenterendo/PierChat/blob/main/assets/banner-med.png?raw=true" />
</p> -->

### What is `PierChat`?
`PierChat` is a data transfering app that allows clients to securely and quickly chat and transfer data without a relay server.
 
The objective of this project is to allow users to transfer files and other information quicker than server-based solutions by making P2P accessible to less tech-savy people. 
PierChat is faster than WeTransfer or any other cloud-based service due to the file not having to be uploaded ( buffered ) to the server and only downloaded to the receiving end once the full file has finished uploading. Instead, the data is directly sent to the other pier, making only one transfer necessary.

---

### How does it work?
#### [`Pier-to-Pier`](https://en.wikipedia.org/wiki/Peer-to-peer)
PierChat uses a decentralized communications model called `Pier-to-Pier` or `P2P`, which works by establishing a connection directly from a client to another client with the help of a special `NAT Translation Server`, but still without the information being relayed through any servers. 
You can learn more about how P2P works on [this](https://en.wikipedia.org/wiki/Peer-to-peer) wikipedia article.

#### [`The Server`](https://github.com/vicenterendo/PierChat-Server/)
Although the clients communicate via P2P, PierChat uses a code-based system for matching clients so a central server is required purely for identity verification and encryption.
As this is open-source and I do not have resources to host official servers, I will leave it up to the community to host their own servers in a community/private server system.
You can find the code for the server, as well as it's releases, in [this](https://github.com/vicenterendo/PierChat-Server/) repository.


