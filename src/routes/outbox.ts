import { Router } from 'express';
import {v4 as uuidv4} from 'uuid';
import { db } from '../database';
import * as ItemRepository from '../itemRepository';
import { NewItem } from '../types';

export const outboxRoute = Router();

async function createItem(object: any) {
  console.log('createItem()');

  let myuuid = uuidv4();
  console.log(object.content + ' ' + myuuid);

  await ItemRepository.createItemTable();
  await ItemRepository.createItem({content: object.content});
}

outboxRoute.post('/', async (req: any, res: any) => {
  if (req.body.type == 'Create') {
    if (req.body.object != null) {
      if (req.body.object.type == 'Item') {
        createItem(req.body.object);
      }
    }
  }
  res.end("Success");
});
