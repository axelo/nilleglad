const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const maya = require('./maya.js');

const MAYA_PASSWORD = '';

app.use(bodyParser.urlencoded({
    extended: true
})); 

app.use('/login', express.static('views/login.html'));

app.post('/login',  (req, res) => {
    res.send('POST request to the homepage: ' + req.body.Username);
});

app.get('/', function(req, res) {

    console.dir(req.headers.cookie);

    res.redirect('/login');

    /*if (!req.headers.cookie) {
        return maya.getCookie()
    }

    mayaTimesForWeek(2016, 16, 'axelolsson', MAYA_PASSWORD, (times, err) => {
        if (err) return res.send(err);
        res.send(times);
    })*/

});

app.listen(3000);