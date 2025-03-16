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

// Create an Express app (this is like your mailman)
const app = express();
// Use the port that Vercel tells us, or 10000 if nothing is given
const port = process.env.PORT || 10000;

// Tell our app to read form data (like when you fill out a form)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// This is the homepage (the front door)
app.get('/', (req, res) => {
  res.send(`
    <h1>Deep Research</h1>
    <form method="POST" action="/research">
      <label>What would you like to research?</label><br/>
      <input type="text" name="query" required /><br/><br/>
      
      <label>Enter research breadth (default 4):</label><br/>
      <input type="number" name="breadth" value="4" /><br/><br/>
      
      <label>Enter research depth (default 2):</label><br/>
      <input type="number" name="depth" value="2" /><br/><br/>
      
      <label>Mode (report or answer, default report):</label><br/>
      <input type="text" name="mode" value="report" /><br/><br/>
      
      <button type="submit">Start Research</button>
    </form>
  `);
});

// When someone sends the form (like giving a letter), we answer it
app.post('/research', async (req, res) => {
  const initialQuery = req.body.query;
  const breadth = parseInt(req.body.breadth, 10) || 4;
  const depth = parseInt(req.body.depth, 10) || 2;
  const mode = req.body.mode && req.body.mode.trim().toLowerCase() === 'answer' ? 'answer' : 'report';

  let combinedQuery = initialQuery;
  console.log('Using model:', getModel().modelId);
  console.log('Starting research...');

  try {
    // Do the research magic!
    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
    });

    let outputHtml = '';
    if (mode === 'report') {
      // Make a long report
      const report = await writeFinalReport({
        prompt: combinedQuery,
        learnings,
        visitedUrls,
      });
      await fs.writeFile('report.md', report, 'utf-8');
      outputHtml = `<h2>Final Report</h2><pre>${report}</pre>`;
    } else {
      // Make a short answer
      const answer = await writeFinalAnswer({
        prompt: combinedQuery,
        learnings,
      });
      await fs.writeFile('answer.md', answer, 'utf-8');
      outputHtml = `<h2>Final Answer</h2><pre>${answer}</pre>`;
    }

    res.send(`
      <h1>Research Completed</h1>
      ${outputHtml}
      <br/><a href="/">Back to Form</a>
    `);
  } catch (error: any) {
    console.error(error);
    res.status(500).send(`<h1>Error occurred</h1><p>${error.message}</p>`);
  }
});

// When testing at home, start the server (this won't run on Vercel)
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});


// Export a handler function for Vercel (this is like giving Vercel the door key)
export default function handler(req, res) {
  return app(req, res);
}
