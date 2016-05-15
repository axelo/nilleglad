'use strict';
const Promise = require('bluebird');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const fs = Promise.promisifyAll(require('fs'));
const vecka = require('vecka');

const maya = require('./maya.js');

function mailBody(week, times, person) {
    return `Hej,

Tidrapport för v${week}

Visby: ${times.visby}h
Stockholm: ${times.distans}h

Totalt: ${times.total}h

Mvh
${person.firstName} ${person.familyName}`;
}

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
    const refererUrl = (req.headers.referer || '');
    const backUrl = refererUrl.indexOf('?referer=') < 0
        ? '/'
        : refererUrl.substring(refererUrl.indexOf('?referer=') + '?referer='.length);

    maya
        .login(req.body.Username, req.body.Password)
        .then(cookie => {
            res.header('set-cookie', cookie);
            res.redirect(backUrl);
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
});

app.get('/:year/:week', function(req, res) {
    const cookie = req.headers.cookie;

    if (!cookie) return res.redirect('/login');

    const year = parseInt(req.params.year);
    const week = parseInt(req.params.week);

    Promise.join(
        maya.person(cookie),
        maya.timeReportingYearWeek(cookie, year, week),
        fs.readFileAsync('views/report.html', 'UTF-8'),
        (person, times, reportHtmlTemplateBuffer) => {
            const mail = mailBody(week, times, person);
            const mailString = '\'' + mail.replace(/\n/g, '\\n') + '\'';
            const mailBr = mail.replace(/\n/g, '<br>');
            const mailHref = mail.replace(/\n/g, '%0D%0A');
            
            const reportHtml = reportHtmlTemplateBuffer.toString()
                .replace(new RegExp('\\$\\{week\\}', 'g'), week)
                .replace(new RegExp('\\$\\{mailString\\}', 'g'), mailString)
                .replace(new RegExp('\\$\\{mailBr\\}', 'g'), mailBr)
                .replace(new RegExp('\\$\\{mailHref\\}', 'g'), mailHref);

            res.setHeader('Content-Type', 'text/html');
            res.send(reportHtml);
    })
    .catch(err => {
        if (err === 'invalid html' || err.res) {
            return res.redirect('/login?referer=' + req.url);
        }

        console.error('Error', err);

        res.status(500);
        res.send(err);
    })
});

app.get('*', function(req, res) {
    const year = new Date().getFullYear();
    const week = vecka.nu();

    res.redirect(`/${year}/${week}`);
});

app.listen(3000);

console.log('nilleglad started in', process.env.NODE_ENV || 'development', 'mode');