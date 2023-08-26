import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as dotenv from "dotenv";
import { db } from '../db';

dotenv.config({ path: __dirname+'/.env' });

export const adminRoute = Router();

function createActor(name: string, domain: string, pubkey: string) {
  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],

    id: `https://${domain}/u/${name}`,
    type: "Person",
    preferredUsername: `${name}`,
    inbox: `https://${domain}/api/inbox`,
    outbox: `https://${domain}/u/${name}/outbox`,
    followers: `https://${domain}/u/${name}/followers`,

    publicKey: {
      id: `https://${domain}/u/${name}#main-key`,
      owner: `https://${domain}/u/${name}`,
      publicKeyPem: pubkey,
    },
  };
}

function createWebfinger(name: string, domain: string) {
  return {
    subject: `acct:${name}@${domain}`,

    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `https://${domain}/u/${name}`,
      },
    ],
  };
}

adminRoute.post("/create", function (req: Request, res: Response) {
  console.log(req.body);
  // pass in a name for an account, if the account doesn't exist, create it!
  const account = req.body.account;
  const password = req.body.password;
  console.log(account);
  if (account === undefined) {
    console.log('Bad request. Please make sure "account" is a property in the POST body.');
    return res.status(400).json({
      msg: 'Bad request. Please make sure "account" is a property in the POST body.',
    });
  }
  //let db = req.app.get("db");
  const domain : string = process.env.DOMAIN ?? 'localhost';
  // create keypair
  crypto.generateKeyPair(
    "rsa",
    {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    },
    (err, publicKey, privateKey) => {
      let actorRecord = createActor(account, domain, publicKey);
      let webfingerRecord = createWebfinger(account, domain);
      const apikey = crypto.randomBytes(16).toString("hex");
      try {
        console.log(password);
        const result = db
          .prepare(
            "insert or replace into accounts(name, password, actor, apikey, pubkey, privkey, webfinger) values(?, ?, ?, ?, ?, ?, ?)"
          )
          .run(
            `${account}@${domain}`,
            password,
            JSON.stringify(actorRecord),
            apikey,
            publicKey,
            privateKey,
            JSON.stringify(webfingerRecord)
          );
        console.log(result);
        res.status(201).json({msg: 'ok', apikey}).end();
        console.log("/api/admin/create returned HTTP 201");
      } catch (e) {
        console.log(e);
        res.status(200).json({ error: e });
      }
    }
  );
});
