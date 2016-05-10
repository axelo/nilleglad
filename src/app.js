const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

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

    console.log('Cookies', req.headers.cookie);

    if (!req.headers.cookie) {
        res.redirect('login');
        return;
    }

    console.log('Logged with the cookie', req.headers.cookie);

    maya.timeReportingYearWeek(2016, 16, req.headers.cookie, (times, err) => {
        if (err) return res.redirect('login');
        res.send(times);
    });

});

app.listen(3000);