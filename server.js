/* jshint esversion: 6 */
// Minimal Node.js app for pixelated-app
const express = require('express');
const app = express();
const PORT = process.env.PORT || 4321;

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/', (req, res) => res.send('Pixelated Empathy Home'));

app.listen(PORT, () => console.log(`pixelated-app listening on port ${PORT}`));
  