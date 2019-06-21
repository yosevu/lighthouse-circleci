#!/usr/local/bin/node

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

  console.log('score', { percent }, { required }, percent < required);
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
  return [...messages, formatMessage(score, required)];
};

const messages = R.reduce(addMessage, [])(R.toPairs(scores));

console.log(R.join('\n', messages));

if (!success) {
  return process.exit(1);
}
