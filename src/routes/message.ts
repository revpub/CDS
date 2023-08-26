import { Router, Request, Response } from 'express';
import { db } from '../db';

export const messageRoute = Router();

messageRoute.get('/:guid', function (req: Request, res: Response) {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  }
  else {
    let result: any = db.prepare('select message from messages where guid = ?').get(guid);
    if (result === undefined || result == null) {
      return res.status(404).send(`No record found for ${guid}.`);
    }
    else {
      res.json(JSON.parse(result.message));
    }
  }
});
