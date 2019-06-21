#!/usr/local/bin/node

const bot = require('circle-github-bot');
const fs = require('fs');
const path = require('path');
const R = require('ramda');

const packageJSON = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const requiredScores = R.path(['lighthouse', 'requiredScores'])(packageJSON);
const reportsDir = process.argv[3];
let success = true; // refactor

// Get reports

const parseFile = file => {
  return JSON.parse(fs.readFileSync(path.resolve(reportsDir, file), 'utf8'));
};

const mapFile = (reports, file) => {
  return R.ifElse(
    R.endsWith('html'),
    R.assoc('html', R.__, reports),
    R.pipe(
      R.curry(parseFile),
      R.assoc('json', R.__, reports)
    )
  )(file);
};

const reducedReports = R.reduce(mapFile, {}, fs.readdirSync(reportsDir));
console.log('Reports:', reducedReports);

// Add scores

const scores = Object.keys(requiredScores).reduce((scores, category) => {
  return {
    ...scores,
    [category]: reducedReports.json.categories[category].score * 100,
  };
}, {});

const formatMessage = (score, required) => {
  const category = score[0];
  const percent = score[1];

  if (percent < required) {
    success = false;
  }

  return R.ifElse(
    R.lt(R.__, required),
    R.always(`❌ ${category}: ${percent}/${required}`),
    R.always(`✅ ${category}: ${percent}/${required}`)
  )(percent);
};

const addMessage = (messages, score) => {
  const required = requiredScores[score[0]];
  const message = formatMessage(score, required);
  return [...messages, message];
};

const messages = R.reduce(addMessage, [])(R.toPairs(scores));
const messageString = R.join('\n', messages);
console.log(messageString);
bot.create().comment(process.env.GH_AUTH_TOKEN, messageString);

if (!success) {
  return process.exit(1);
}
