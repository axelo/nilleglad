'use strict';
const Promise = require('bluebird');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const fs = Promise.promisifyAll(require('fs'));
const vecka = require('vecka');

const maya = require('./maya.js');

const reportTag = {
    report: newTag('report'),
    week: newTag('week'),
    year: newTag('year'),
    mailTo: newTag('mailTo')
};

function newTag(name) {
    return new RegExp('\\$\\{' + name + '\\}', 'g');
}

function getYear(date) {
    return date.getFullYear();
}

function getWeekNumber(date) {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getUTCDay() + 6) % 7;

    target.setUTCDate(target.getUTCDate() - dayNumber + 3);
    
    const firstThursday = target.valueOf();
    
    target.setUTCMonth(0, 1);

    if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }

    return Math.ceil((firstThursday - target) /  (7 * 24 * 3600 * 1000)) + 1;
}

function getReport(cookie, year, week) {
    return Promise.join(
        maya.person(cookie),
        maya.timeReportingYearWeek(cookie, year, week),
        (person, times) => {
            return {
                year,
                week,
                person,
                times
            };
        });
}

function sendHtml(htmlPromise, req, res) {
    htmlPromise
        .then(html => {
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        })
        .catch(err => {
            if (err === 'invalid html' || err.res || err.statusCode) {
                return res.redirect('/login?referer=' + req.url);
            }

            console.error('Error', err);

            res.status(500);
            res.send(err);
        });
}

function renderReport(cookie, year, week) {
    return Promise.join(
        getReport(cookie, year, week),
        fs.readFileAsync('views/report.html', 'UTF-8'),
        (report, reportHtmlTemplateBuffer) => {
            const mailTo = process.env.MAILTO || 'roger@cool.com';

            return reportHtmlTemplateBuffer.toString()
                .replace(reportTag.report, JSON.stringify(report))
                .replace(reportTag.week, report.week)
                .replace(reportTag.year, report.year)
                .replace(reportTag.mailTo, mailTo);
    });
}

app.use(bodyParser.urlencoded({
    extended: true
})); 

app.use('/styles.css', express.static('views/styles.css'));
app.use('/webapp.js', express.static('views/webapp.js'));
app.use('/login', express.static('views/login.html'));

app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(`https://${req.get('Host')}${req.url}`);
    }

    const cookie = req.headers.cookie;

    if (!cookie && req.url !== '/login') return res.redirect('/login');

    next();
});

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
            res.redirect('login');
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

app.get('/api/:year(\\d\\d\\d\\d)-:week(\\d\\d?)', (req, res) => {
    const year = parseInt(req.params.year);
    const week = parseInt(req.params.week);

    getReport(req.headers.cookie, year, week)
        .then(report => res.json(report))
        .catch(err => res.status(400).json({ message: err.body }));
});

app.get('/:year(\\d\\d\\d\\d)-:week(\\d\\d?)', (req, res) => {
    const year = parseInt(req.params.year);
    const week = parseInt(req.params.week);

    sendHtml(renderReport(req.headers.cookie, year, week), req, res);
});

app.get('/', (req, res) => {
    const now = new Date();
    const year = getYear(now);
    const week = getWeekNumber(now);

    sendHtml(renderReport(req.headers.cookie, year, week), req, res)
});

app.get('*', (req, res) => {
    res.redirect('/');
});

const port = process.env.PORT || 3000;

app.listen(port);

console.log('nilleglad started in', process.env.NODE_ENV || 'development', 'mode', 'on port', port);
