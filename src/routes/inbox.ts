import { Router, Request, Response } from 'express'; 
import crypto from 'crypto';
import { Message, MessageObject } from './api';
import { db } from '../db';
import axios from "axios";

export const inboxRoute = Router();

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
        console.log('Response THIS IS THE POST:', response.status);
      })
      .catch((error) => {
        console.log('Error THIS IS THE POST:', error);
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

function parseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch(e) {
    return null;
  }
}

inboxRoute.post('/', function (req: Request, res: Response) {
  // pass in a name for an account, if the account doesn't exist, create it!
  const domain : string = process.env.DOMAIN ?? 'localhost';
  console.log("req.body.actor", req.body.actor);
  const myURL = new URL(req.body.actor);
  let targetDomain = myURL.hostname;
  // TODO: add "Undo" follow event
  if (typeof req.body.object === 'string' && req.body.type === 'Follow') {
    let name = req.body.object.replace(`https://${domain}/u/`,'');
    sendAcceptMessage(req.body, name, domain, req, res, targetDomain);
    // Add the user to the DB of accounts that follow the account
    // get the followers JSON for the user
    let result: any = db.prepare('select followers from accounts where name = ?').get(`${name}@${domain}`);
    if (result === undefined || result == null) {
      console.log(`No record found for ${name}.`);
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
      }
      catch(e) {
        console.log('error', e);
      }
    }
  }
});
