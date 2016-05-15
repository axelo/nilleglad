'use strict';
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

app.use(function (req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(`https://${req.get('Host')}${req.url}`);
    }

    next();
});

app.use('/styles.css', express.static('views/styles.css'));
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

app.get('/logout', (req, res) => {
    const cookie = req.headers.cookie;

    if (!cookie) return res.redirect('/');

    maya.logout(cookie)
        .then(result => {
            res.redirect('/login');
        })
        .catch(err => {
            res.status(400);
            res.redirect('/');
        });
})

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
                .replace(new RegExp('\\$\\{total\\}', 'g'), times.total)
                .replace(new RegExp('\\$\\{person\\}', 'g'), person.firstName + ' ' + person.familyName);

            res.setHeader('Content-Type', 'text/html');
            res.send(reportHtml);
    })
    .catch(err => {
        if (err === 'invalid html') {
            return res.redirect('/login');
        }

        console.error('Error', err);

        res.status(500);
        res.send(err);
    })
});

app.listen(3000);

console.log('nilleglad started in', process.env.NODE_ENV || 'development', 'mode');