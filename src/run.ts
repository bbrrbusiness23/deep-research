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
// Use the port that Render gives us, or use 10000 if nothing is given
const port = process.env.PORT || 10000;

// Tell our app to read form data (like when you fill out a form on a webpage)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// This is what you see when you visit the homepage ("/")
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

// When you click the button, the form sends data to this URL (/research)
app.post('/research', async (req, res) => {
  // Get what the user typed in the form
  const initialQuery = req.body.query;
  const breadth = parseInt(req.body.breadth, 10) || 4;
  const depth = parseInt(req.body.depth, 10) || 2;
  const mode = req.body.mode && req.body.mode.trim().toLowerCase() === 'answer' ? 'answer' : 'report';

  let combinedQuery = initialQuery;
  // (Optionally: You could add follow-up questions here if needed.)

  console.log('Using model:', getModel().modelId);
  console.log('Starting research...');

  try {
    // Run the deep research process
    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
    });

    let outputHtml = '';
    if (mode === 'report') {
      // Create a full report
      const report = await writeFinalReport({
        prompt: combinedQuery,
        learnings,
        visitedUrls,
      });
      // Save the report to a file
      await fs.writeFile('report.md', report, 'utf-8');
      outputHtml = `<h2>Final Report</h2><pre>${report}</pre>`;
    } else {
      // Create a short answer
      const answer = await writeFinalAnswer({
        prompt: combinedQuery,
        learnings,
      });
      await fs.writeFile('answer.md', answer, 'utf-8');
      outputHtml = `<h2>Final Answer</h2><pre>${answer}</pre>`;
    }

    // Send the result back to your web browser
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

// Tell our app to start listening for web traffic on the chosen port
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
