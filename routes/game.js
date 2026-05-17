// routes/game.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

router.post('/move', gameController.submitMove);

module.exports = router;