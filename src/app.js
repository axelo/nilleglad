const Promise = require('bluebird');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const fs = Promise.promisifyAll(require('fs'));
const vecka = require('vecka');

const maya = require('./maya.js');

app.use(bodyParser.urlencoded({
    extended: true
})); 

app.use('/login', express.static('views/login.html'));

app.post('/login',  (req, res) => {
    maya
        .login(req.body.Username, req.body.Password)
        .then(cookie => {
            res.header('set-cookie', cookie);
            res.redirect('/');
        })
        .catch(err => {
            res.status(400);
            res.redirect('/login');
        })
});

app.get('/', function(req, res) {
    const cookie = req.headers.cookie;

    if (!cookie) return res.redirect('/login');

    const year = new Date().getFullYear();
    const week = vecka.nu();

    Promise.join(
        maya.person(cookie),
        maya.timeReportingYearWeek(cookie, year, week),
        fs.readFileAsync('views/report.html', 'UTF-8'),
        (person, times, reportHtmlTemplateBuffer) => {
            const reportHtmlTemplate = reportHtmlTemplateBuffer.toString();

            const reportHtml = reportHtmlTemplate
                .replace(new RegExp('\\$\\{weekNo\\}', 'g'), week)
                .replace(new RegExp('\\$\\{visby\\}', 'g'), times.visby)
                .replace(new RegExp('\\$\\{notVisby\\}', 'g'), times.distans)
                .replace(new RegExp('\\$\\{person\\}', 'g'), person.firstName + ' ' + person.familyName);

            res.setHeader('Content-Type', 'text/html');
            res.send(reportHtml);
    })
    .catch(err => {
        console.error('Error', err);

        res.status(500);
        res.send(err);
    })
});

app.listen(3000);