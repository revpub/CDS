import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Message, MessageObject } from './api';
import { db } from '../db';
import axios from "axios";

export const userRoute = Router();

function parseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch(e) {
    return null;
  }
}

function signAndSend(message: Message, name: string, domain: string, req: Request, res: Response, targetDomain: string) { 
  // get the URI of the actor object and append 'inbox' to it
  let inbox = message.object.actor + '/inbox';
  let inboxFragment = inbox.replace('https://'+targetDomain,'');
  // get the private key
  let result: any = db.prepare('select privkey from accounts where name = ?').get(`${name}@${domain}`);
  if (result === undefined || result == null) {
    return res.status(404).send(`No record found for ${name}.`);
  }
  else {
    let privkey = result.privkey;
    const digestHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('base64');
    const signer = crypto.createSign('sha256');
    let d = new Date();
    let stringToSign = `(request-target): post ${inboxFragment}\nhost: ${targetDomain}\ndate: ${d.toUTCString()}\ndigest: SHA-256=${digestHash}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(privkey);
    const signature_b64 = signature.toString('base64');
    let header = `keyId="https://${domain}/u/${name}",headers="(request-target) host date digest",signature="${signature_b64}"`;

    const url = inbox;

    const data = message;

    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
          "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        'Host': targetDomain,
        'Date': d.toUTCString(),
        'Digest': `SHA-256=${digestHash}`,
        'Signature': header
      },
    };

    axios
      .post(url, data, config)
      .then((response) => {
        console.log('users.ts:signAndSend() Response:', response.status);
      })
      .catch((error) => {
        console.log('users.ts:signAndSend() Error:', error);
      });

    return res.status(200);
  }
}

function sendAcceptMessage(thebody: MessageObject, name: string, domain: string, req: Request, res: Response, targetDomain: string) {
  const guid = crypto.randomBytes(16).toString('hex');
  let message: Message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${domain}/${guid}`,
    'type': 'Accept',
    'actor': `https://${domain}/u/${name}`,
    'object': thebody,
  };
  signAndSend(message, name, domain, req, res, targetDomain);
}

userRoute.post("/login", function (req: Request, res: Response) {
  console.log("got here");

  const account = req.body.account;
  const password = req.body.password;

  let result: any = db
    .prepare("select * from accounts where name = ?")
    .get(`${account}`);
  console.log(result);

  if (result === undefined || result == null) {
    return res.status(400).json({
      msg: "Account does not exist",
    });
  } else if (result.password != password) {
    return res.status(400).json({
      msg: "Password doesn't match",
    });
  } else {
    res.status(200).json({ msg: "ok" });
  }
});

userRoute.get("/:name", function (req: Request, res: Response) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send("Bad request.");
  } else {
    const domain : string = process.env.DOMAIN ?? 'localhost';
    let username = name;
    name = `${name}@${domain}`;
    let result: any = db
      .prepare("select actor from accounts where name = ?")
      .get(name);
    if (result === undefined || result == null) {
      return res.status(404).send(`No record found for ${name}.`);
    } else {
      let tempActor = JSON.parse(result.actor);
      // Added this followers URI for Pleroma compatibility, see https://github.com/dariusk/rss-to-activitypub/issues/11#issuecomment-471390881
      // New Actors should have this followers URI but in case of migration from an old version this will add it in on the fly
      if (tempActor.followers === undefined) {
        tempActor.followers = `https://${domain}/u/${username}/followers`;
      }
      res.json(tempActor);
    }
  }
});

userRoute.get("/:name/followers", function (req: Request, res: Response) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send("Bad request.");
  } else {
    const domain : string = process.env.DOMAIN ?? 'localhost';
    let result: any = db
      .prepare("select followers from accounts where name = ?")
      .get(`${name}@${domain}`);
    console.log(result);
    result.followers = result.followers || "[]";
    let followers = JSON.parse(result.followers);
    let followersCollection = {
      type: "OrderedCollection",
      totalItems: followers.length,
      id: `https://${domain}/u/${name}/followers`,
      first: {
        type: "OrderedCollectionPage",
        totalItems: followers.length,
        partOf: `https://${domain}/u/${name}/followers`,
        orderedItems: followers,
        id: `https://${domain}/u/${name}/followers?page=1`,
      },
      "@context": ["https://www.w3.org/ns/activitystreams"],
    };
    res.json(followersCollection);
  }
});

userRoute.get("/:name/outbox", function (req: Request, res: Response) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send("Bad request.");
  } else {
    const domain : string = process.env.DOMAIN ?? 'localhost';
    let messages: Message[] = [];
    let outboxCollection = {
      type: "OrderedCollection",
      totalItems: messages.length,
      id: `https://${domain}/u/${name}/outbox`,
      first: {
        type: "OrderedCollectionPage",
        totalItems: messages.length,
        partOf: `https://${domain}/u/${name}/outbox`,
        orderedItems: messages,
        id: `https://${domain}/u/${name}/outbox?page=1`,
      },
      "@context": ["https://www.w3.org/ns/activitystreams"],
    };
    res.json(outboxCollection);
  }
});

userRoute.get("/:name/inbox", function (req: Request, res: Response) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send("Bad request.");
  } else {
    const domain : string = process.env.DOMAIN ?? 'localhost';
    let messages: Message[] = [];
    let inboxCollection = {
      type: "OrderedCollection",
      totalItems: messages.length,
      id: `https://${domain}/u/${name}/inbox`,
      first: {
        type: "OrderedCollectionPage",
        totalItems: messages.length,
        partOf: `https://${domain}/u/${name}/inbox`,
        orderedItems: messages,
        id: `https://${domain}/u/${name}/inbox?page=1`,
      },
      "@context": ["https://www.w3.org/ns/activitystreams"],
    };
    res.json(inboxCollection);
  }
});

userRoute.post("/:name/inbox", function (req: Request, res: Response) {
  const name: string = req.params.name;
  if (!name) {
    return res.status(400).send("Bad request.");
  } 
  const domain : string = process.env.DOMAIN ?? 'localhost';
  const inboxUrl: string = `https://${domain}/u/${name}/inbox`;
  const myURL = new URL(req.body.actor);
  const targetDomain = myURL.hostname;
  console.log('POSTed something to an inbox: ', inboxUrl, req.body.type);

   //TODO: Put this in its own function
   // Received follow message from another actor
  if (typeof req.body.object === 'string' && req.body.type === 'Follow') {
    // First accept the follow
    sendAcceptMessage(req.body, name, domain, req, res, targetDomain); // TODO: make sure this is good
    // Then add this new follower to this account's followers list
    let result: any = db.prepare('select followers from accounts where name = ?').get(`${name}@${domain}`);
    if (result === undefined || result == null) {
      console.log(`No record found for ${name}.`);
      return res.status(400).send(`No record found for ${name}`);
    }
    else {
      // update followers
      let followers = parseJSON(result.followers);
      if (followers) {
        followers.push(req.body.actor);
        // unique items
        followers = [...new Set(followers)];
      }
      else {
        followers = [req.body.actor];
      }
      let followersText = JSON.stringify(followers);
      try {
        // update into DB
        let newFollowers = db.prepare('update accounts set followers=? where name = ?').run(followersText, `${name}@${domain}`);
        console.log('updated followers!', newFollowers);
        return res.status(200).end();
      }
      catch(e) {
        console.log('error', e);
        return res.status(400).send(`Unable to update followers for ${name}`);
      }
    }
  }

  else if (req.body.type === 'Accept') {
    return res.status(200).end();
  }

});
