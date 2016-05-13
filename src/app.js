const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
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
    if (!req.headers.cookie) return res.redirect('/login');

    maya
        .timeReportingYearWeek(req.headers.cookie, 2016, 16)
        .then(times => {
            const reportHtmlTemplate = fs.readFileSync('views/report.html', 'UTF-8').toString();

            const reportHtml = reportHtmlTemplate
                .replace(new RegExp('\\$\\{weekNo\\}', 'g'), '16')
                .replace(new RegExp('\\$\\{visby\\}', 'g'), times.visby)
                .replace(new RegExp('\\$\\{notVisby\\}', 'g'), times.distans);

            res.setHeader('Content-Type', 'text/html');
            res.send(reportHtml);
        })
        .catch(err => {
            res.status(400);
            res.redirect('/login');
        })
});

app.listen(3000);