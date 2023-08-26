import express from 'express';
import { db } from './db';
import fs from 'fs';
import * as path from 'path';
import basicAuth from 'express-basic-auth';
import { routes } from './routes/index';
import bodyParser from 'body-parser';
import cors from 'cors';
import https from 'https';
import * as dotenv from "dotenv";

// const rootCas = require('ssl-root-cas').create();
// rootCas.addFile(path.resolve('/Users/default/root/ca/intermediate/certs/intermediate.cert.pem'));
// https.globalAgent.options.ca = rootCas;


dotenv.config({ path: __dirname + '/.env' });

// const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;
const app = express();
//const db = new Database("bot-node.db");
let sslOptions: any;

try {
  sslOptions = {
    ca: fs.readFileSync('' + process.env.CA_CERT_PATH, 'utf8'),
    key: fs.readFileSync('' + process.env.PRIVKEY_PATH, 'utf8'),
    cert: fs.readFileSync('' + process.env.CERT_PATH, 'utf8'),
    servername: 'localhost'
  };
} catch (err) {
  if (err === -2) {
    console.log("No SSL key and/or cert found, not enabling https server");
  } else {
    console.log(err);
  }
}

function asyncAuthorizer(username: string, password: string, cb: any) {
  console.log('got here');
  let isAuthorized = false;
  const isPasswordAuthorized = username === process.env.USER;
  const isUsernameAuthorized = password === process.env.PASS;
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized;
  if (isAuthorized) {
    return cb(null, true);
  } else {
    return cb(null, false);
  }
}

// basic http authorizer
let basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true,
});

// if there is no `accounts` table in the DB, create an empty table
db.prepare("DROP TABLE IF EXISTS accounts").run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, password TEXT, privkey TEXT, pubkey TEXT, webfinger TEXT, actor TEXT, apikey TEXT, followers TEXT, messages TEXT)"
).run();
// if there is no `messages` table in the DB, create an empty table
db.prepare(
  "CREATE TABLE IF NOT EXISTS messages (guid TEXT PRIMARY KEY, message TEXT)"
).run();

app.set("db", db);
app.set("domain", process.env.DOMAIN);
app.set("port-https", process.env.PORT_HTTPS || 8443);

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(bodyParser.json({ type: "application/activity+json" })); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get("/", (req, res) => res.send("Hello World!"));

app.use('/api', cors(), routes.api);
app.use("/api/user", routes.user);
app.use("/u", cors(), routes.user);
app.use("/m", cors(), routes.message);
app.use("/api/inbox", cors(), routes.inbox);
app.use("/.well-known/webfinger", cors(), routes.webfinger);
app.use(
  "/api/admin",
  cors(), 
  //cors({ credentials: true, origin: true }),
  //basicUserAuth,
  routes.admin
);

https.createServer(sslOptions, app).listen(app.get('port-https'), function () {
  console.log("Express server listening on port " + app.get('port-https'));
});