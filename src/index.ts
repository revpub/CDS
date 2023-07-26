import express from 'express';
import { outboxRoute } from './routes/outbox';
import bodyParser from 'body-parser';

const port = 8080;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({type: 'application/ld+json'}))

app.use("/outbox", outboxRoute);

app.listen(port, () => console.log(`Server listening on port ${port}`))