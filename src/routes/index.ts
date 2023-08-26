import {adminRoute} from './admin';
import {userRoute} from './user';
import {apiRoute} from './api';
import {messageRoute} from './message';
import {inboxRoute} from './inbox';
import {webfingerRoute} from './webfinger';

export const routes = {
  user: userRoute,
  api: apiRoute,
  message: messageRoute,
  inbox: inboxRoute,
  webfinger: webfingerRoute,
  admin: adminRoute
};