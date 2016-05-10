'use strict';

const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

const mayaProjectNames = [
    'RAÄ Systemutveckling',
    'Raä - Frontend'
];

/*function timesForWeek(year, weekNo, mayaUsername, mayaPassword, cookie, cb) {
    if (!Number.isInteger(year) || year < 0) throw 'År måste vara ett positivt heltal';
    if (!Number.isInteger(weekNo) || weekNo < 1 || weekNo > 52) throw 'Veckonummer måste vara ett heltal mellan 1 och 52';

    if (err) return cb(undefined, 'Misslyckades med att hämta sessionskaka');

    login(mayaUsername, mayaPassword, cookie, (body, err) => {
        if (err) return cb(undefined, 'Misslyckades med att logga in');

        timeReportingYearWeek(year, weekNo, cookie, (times, err) => {
            if (err) return cb(undefined, 'Misslyckades med att hämta inrapporterad tid');

            cb(times);
        });
    });
}*/

/*function mailContents(weekNo, times) {
    return `
Hej, rapport för v${weekNo}

Visby: ${times.visby}h
Sthlm: ${times.distans}h
Tot: ${times.visby + times.distans}h

Mvh
`;
}*/

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

function parseRaaTimes(mayaProjectNames, html) {
    const $ = cheerio.load(html);

    const rows = $('tr:not(:first-child)', 'form[name="projActForm"] > table:first-child');
    const raaRows = rows.filter((i, tr) => mayaProjectNames.filter(pname => $('a', tr).text().startsWith(pname)).length > 0);

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

        cb(parseRaaTimes(mayaProjectNames, body));
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

module.exports = {
    getCookie,
    login,
    timeReportingYearWeek
};
