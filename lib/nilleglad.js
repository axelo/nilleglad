'use strict';

const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const vecka = require('vecka');
const fs = require('fs');
const configurationFile = 'config.json';

let weekNo, mayaUsername, mayaPassword, config;
let mayaProject = 'RAÄ Systemutveckling';

try {
    config = JSON.parse(fs.readFileSync(configurationFile));
}
catch (err) {
}

if (process.argv.length === 2 + 2) {
    weekNo = parseInt(process.argv[2]);
    mayaUsername = process.argv[3];
    mayaPassword = process.argv[4] || '';
}
else if (config) {
    weekNo = vecka.nu();
    mayaUsername = config.username;
    mayaPassword = config.password;
    mayaProject = config.project;
}
else {
    return console.error('Usage: nilleglad veckonummer Maya-användarnamn [Maya-lösenord]');
}

if (weekNo < 1 || weekNo > 52) {
    return console.error('Veckonummer måste vara mellan 1 och 52');
}

console.info('Hämtar rapporterad RAÄ-tid för vecka', weekNo + '..');

getCookie((cookie, err) => {
    if (err) return console.error('Misslyckades med att hämta sessionskaka');

    login(mayaUsername, mayaPassword, cookie, (body, err) => {
        if (err) return console.error('Misslyckades med att logga in');

        timeReportingYearWeek(2016, weekNo, cookie, (times, err) => {
            if (err) return console.error('Misslyckades med att hämta inrapporterad tid');

            console.info(mailContents(weekNo, times));
        });
    }); 
});

function mailContents(weekNo, times) {
    return `
Hej, rapport för v${weekNo}

Visby: ${times.visby}h
Sthlm: ${times.distans}h
Tot: ${times.visby + times.distans}h

Mvh
`;
}

function getCookie(cb) {
    https.request({
        hostname: 'maya.decerno.se',
        port: 443,
        path: '/maya/ASP/Login/login.asp',
        agent: false,
        headers: {
            'User-Agent': 'nilleglad',
            accept: '*/*'
        },
        method: 'HEAD'
    }, res => {
        if (res.statusCode !== 200) return cb(undefined, res.statusCode);

        const cookie = (res.headers['set-cookie'] || '').toString().split('; ')[0];

        cb(cookie);
    }).on('error', err => {
        cb(undefined, err);
    }).end();
}

function parseRaaTimes(html) {
    const $ = cheerio.load(html);

    const rows = $('tr:not(:first-child)', 'form[name="projActForm"] > table:first-child');
    const raaRows = rows.filter((i, tr) => $('a', tr).text().startsWith(mayaProject));

    const raaVisbyRows = raaRows.filter((i, tr) => $('td', tr).text().indexOf('Visby') > -1);
    const raaDistansRows = raaRows.filter((i, tr) => $('td', tr).text().indexOf('distans') > -1);

    const visbyTime = $('td[id^=activityProjTotal]', raaVisbyRows)
        .map((i, totTimeTd) => parseFloat($(totTimeTd).text())).get()
        .reduce((sum, time) => sum += time, 0);

    const distansTime = $('td[id^=activityProjTotal]', raaDistansRows)
        .map((i, totTimeTd) => parseFloat($(totTimeTd).text())).get()
        .reduce((sum, time) => sum += time, 0);

    return {
        distans: distansTime,
        visby: visbyTime
    };
}

function timeReportingYearWeek(year, weekNo, cookie, cb) {
    const postData = querystring.stringify({
        startWeek: year + '-' + ((weekNo < 10 ? '0' : '') + weekNo),
        formMode: '',
        ProjectID: '',
        TaskRecordNo: '',
        RecordNo: '',
        weekNo: '',
        startDate: '',
        endDate: '',
        fromAttest: '',
        fromOrderNotReady: '',
        fromFakturaAttest: ''
    });

    postFormData('/maya/ASP/PersonPlanning/TimeReportingAttestDayDate.asp', postData, cookie, (body, err) => {
        if (err) return cb(undefined, err);

        cb(parseRaaTimes(body));
    });
}

function login(username, password, cookie, cb) {
    const postData = querystring.stringify({
        Username: username,
        Password: password
    });

    postFormData('/maya/ASP/Login/loginAuthorizer.asp', postData, cookie, cb);
}

function postFormData(path, formData, cookie, cb) {
    const req = https.request({
        hostname: 'maya.decerno.se',
        port: 443,
        path: path,
        agent: false,
        headers: {
            'User-Agent': 'nilleglad',
            accept: '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
            'Content-Length': Buffer.byteLength(formData)
        },
        method: 'POST',
        encoding: null
    }, res => {
        if (res.statusCode !== 200) return cb(undefined, { statusCode: res.statusCode, headers: res.headers });

        const buffers = [];

        res.on('data', chunk => buffers.push(chunk));
        res.on('end', () => {
            const bodyBuffer = Buffer.concat(buffers);
            const body = iconv.decode(bodyBuffer, 'win1252');

            cb(body);
        });
    });

    req.on('error', err => cb(undefined, err));

    req.write(formData)
    req.end();
}
