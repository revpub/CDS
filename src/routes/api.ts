import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import axios from "axios";

export interface MessageObject {
    id: string;
    type: string;
    published: string;
    attributedTo: string;
    content: string;
    to: string[];
    actor?: string;
};

export interface Message {
    '@context': string;
    id: string;
    type: string;
    actor: string;
    to?: string[];
    cc?: string[];
    object: MessageObject;
};

export interface FollowActivity {
  '@context': string;
  id: string;
  type: string;
  actor: string;
  object: string;
};

export const apiRoute = Router();

apiRoute.post('/sendMessage', function (req: Request, res: Response) {
  console.log(req);
  const domain : string = process.env.DOMAIN ?? 'localhost';
  console.log(req.body);
  let account = req.body.account;
  let apiKey = req.body.apiKey;
  let message = req.body.message;
  // check to see if your API key matches
  let result : any = db.prepare('select apikey from accounts where name = ?').get(`${account}@${domain}`);
  if (result.apikey === apiKey) {
    sendCreateMessage(message, account, domain, req, res);
  }
  else {
    res.status(403).json({msg: 'wrong api key'});
  }
});

apiRoute.post('/follow', function (req: Request, res: Response) {
  const actorDomain : string = process.env.DOMAIN ?? 'localhost';
  console.log(req.body);
  const actorName = req.body.account;
  const apiKey = req.body.apiKey;
  const accountToFollow = req.body.accountToFollow;
  // check to see if your API key matches
  let result : any = db.prepare('select apikey from accounts where name = ?').get(`${actorName}@${actorDomain}`);
  if (result.apikey === apiKey) {
    const tokens = accountToFollow.split("@");
    const targetName = tokens[0];
    const targetDomain = tokens[1];
    const followActivity = createFollowActivity(targetName, targetDomain, actorName, actorDomain, req, res);
    let inbox = `https://${targetDomain}/u/${targetName}/inbox`;
    signAndSendFollow(followActivity, targetDomain, actorName, actorDomain, req, res, inbox);
  }
  else {
    res.status(403).json({msg: 'wrong api key'});
  }
});

function signAndSend(message: Message, name: string, domain: string, req: Request, res: Response, targetDomain: string, inbox: string) {
  // get the private key
  let inboxFragment = inbox.replace('https://'+targetDomain,'');
  let result: any = db.prepare('select privkey from accounts where name = ?').get(`${name}@${domain}`);
  if (result === undefined || result == null) {
    console.log(`No record found for ${name}.`);
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
        console.log('Response Status Code:', response.status);
        if (response.status === 200) {
          console.log(`Sent message to an inbox at ${targetDomain}!`);
        }
      })
      .catch((error) => {
        console.log('Error:', error);
      });
  }
}

function signAndSendFollow(followActivity: FollowActivity, targetDomain: string, actorName: string, actorDomain: string, req: Request, res: Response, inbox: string) {
  // get the private key
  let inboxFragment = inbox.replace('https://'+targetDomain,'');
  let result: any = db.prepare('select privkey from accounts where name = ?').get(`${actorName}@${actorDomain}`);
  if (result === undefined || result == null) {
    console.log(`No record found for ${actorName}.`);
  }
  else {
    let privkey = result.privkey;
    const digestHash = crypto.createHash('sha256').update(JSON.stringify(followActivity)).digest('base64');
    const signer = crypto.createSign('sha256');
    let d = new Date();
    let stringToSign = `(request-target): post ${inboxFragment}\nhost: ${targetDomain}\ndate: ${d.toUTCString()}\ndigest: SHA-256=${digestHash}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(privkey);
    const signature_b64 = signature.toString('base64');
    console.log("https://${actorDomain}/u/${actorName}", `https://${actorDomain}/u/${actorName}`);
    let header = `keyId="https://${actorDomain}/u/${actorName}",headers="(request-target) host date digest",signature="${signature_b64}"`;
    console.log('Inbox:', inbox);

    const url = inbox;

    const data = followActivity;

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
        console.log('Response Status Code:', response.status);
        if (response.status === 200) {
          console.log(`Sent follow activity to an inbox at ${targetDomain}!`);
        }
        res.status(200).json({msg: 'ok'}).end();
      })
      .catch((error) => {
        console.log('Error:', error);
      });
  }
}

function createMessage(text: string, name: string, domain: string, req: Request, res: Response, follower: string): Message {
  const guidCreate = crypto.randomBytes(16).toString('hex');
  const guidNote = crypto.randomBytes(16).toString('hex');
  let d = new Date();

  let noteMessage: MessageObject = {
    'id': `https://${domain}/m/${guidNote}`,
    'type': 'Note',
    'published': d.toISOString(),
    'attributedTo': `https://${domain}/u/${name}`,
    'content': text,
    'to': ['https://www.w3.org/ns/activitystreams#Public'],
  };

  let createMessage: Message = {
    '@context': 'https://www.w3.org/ns/activitystreams',

    'id': `https://${domain}/m/${guidCreate}`,
    'type': 'Create',
    'actor': `https://${domain}/u/${name}`,
    'to': ['https://www.w3.org/ns/activitystreams#Public'],
    'cc': [follower],

    'object': noteMessage
  };

  db.prepare('insert or replace into messages(guid, message) values(?, ?)').run( guidCreate, JSON.stringify(createMessage));
  db.prepare('insert or replace into messages(guid, message) values(?, ?)').run( guidNote, JSON.stringify(noteMessage));

  return createMessage;
}

function createFollowActivity(targetName: string, targetDomain: string, actorName: string, actorDomain: string, req: Request, res: Response): FollowActivity {

  const guidFollow = crypto.randomBytes(16).toString('hex');
  let d = new Date();

  let followActivity: FollowActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${actorDomain}/m/${guidFollow}`,
    'type': 'Follow',
    'actor': `https://${actorDomain}/u/${actorName}`,
    'object': `https://${targetDomain}/u/${targetName}`
  };

  return followActivity;

}

function sendCreateMessage(text: string, name: string, domain: string, req: Request, res: Response) {
  let result: any = db.prepare('select followers from accounts where name = ?').get(`${name}@${domain}`);
  let followers = JSON.parse(result.followers);
  console.log(followers);
  console.log('type',typeof followers);
  if (followers === null) {
    console.log('aaaa');
    res.status(400).json({msg: `No followers for account ${name}@${domain}`});
  }
  else {
    for (let follower of followers) {
      let inbox = follower+'/inbox';
      let myURL = new URL(follower);
      let targetDomain = myURL.host;
      let message = createMessage(text, name, domain, req, res, follower);
      signAndSend(message, name, domain, req, res, targetDomain, inbox);
    }
    res.status(200).json({msg: 'ok'});
  }
}
