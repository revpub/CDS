import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';

export const webfingerRoute = Router();

interface RequestParams {}

interface ResponseBody {}

interface RequestBody {}

interface RequestQuery {
  resource: string;
}

function getHandler(
  req: Request<RequestParams, ResponseBody, RequestBody, RequestQuery>,
  res: Response,
  next: NextFunction
) {
  let resource = req.query.resource;
  if (!resource || !resource.includes('acct:')) {
    return res.status(400).send('Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.');
  }
  else {
    let name = resource.replace('acct:','');
    let result : any = db.prepare('select webfinger from accounts where name = ?').get(name);
    if (result === undefined || result == null) {
      return res.status(404).send(`No record found for ${name}.`);
    }
    else {
      res.json(JSON.parse(result.webfinger));
    }
  }
}

webfingerRoute.route('/').get(getHandler);
