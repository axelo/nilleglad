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

    maya.getCookie((cookie, err) => {
        if (err) {
            res.status(400);
            res.redirect('login');
            return;
        }

        maya.login(req.body.Username, req.body.Password, cookie, (body, err) => {
            if (err) {
                res.status(400);
                res.redirect('login');
                return;
            }

            res.header('set-cookie', cookie);
            res.redirect('/');
        });
    });
});

app.get('/', function(req, res) {

    if (!req.headers.cookie) {
        res.redirect('login');
        return;
    }

    maya.timeReportingYearWeek(2016, 16, req.headers.cookie, (times, err) => {
        if (err) return res.redirect('login');

        res.setHeader('Content-Type', 'text/html');

        const reportHtmlTemplate = fs.readFileSync('views/report.html', 'UTF-8').toString();

        const reportHtml = reportHtmlTemplate
            .replace(new RegExp('\\$\\{weekNo\\}', 'g'), '16')
            .replace(new RegExp('\\$\\{visby\\}', 'g'), times.visby)
            .replace(new RegExp('\\$\\{notVisby\\}', 'g'), times.distans);

        res.send(reportHtml);
    });

});

app.listen(3000);