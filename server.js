/* jshint esversion: 6 */
// Minimal Node.js app for pixelated-app
const express = require('express');
const app = express();
const PORT = process.env.PORT || 4321;

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/', (req, res) => res.send('Pixelated Empathy Home'));

app.listen(PORT, () => console.log(`pixelated-app listening on port ${PORT}`));
  
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="93104627-6895-5eb0-96a4-0c009e1915b5")}catch(e){}}();
//# debugId=93104627-6895-5eb0-96a4-0c009e1915b5
