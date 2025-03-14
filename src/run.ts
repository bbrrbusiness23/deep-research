import * as fs from 'fs/promises';
import express from 'express';
import bodyParser from 'body-parser';
import { getModel } from './ai/providers';
import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateFeedback } from './feedback';

// Create an Express app
const app = express();
// Use the port provided by environment or default to 10000
const port = process.env.PORT || 10000;

// Use middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve the form on the homepage
app.get('/', (req, res) => {
  res.send(`
    <h1>Deep Research</h1>
    <form method="POST" action="/research">
